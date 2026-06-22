import { VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { AccountMappingError, AccountRole } from '../../../domain/accounting/errors/AccountMappingError';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { IAccountingBridge } from '../../system-core/contracts/IAccountingBridge';

/**
 * Task 178 — the shared "subledger document → ledger voucher" assembler.
 *
 * Stage A: built and unit-tested, wired to nothing yet. SalesInvoice,
 * PurchaseInvoice, SalesReturn and PurchaseReturn each currently re-implement
 * the same middle layer of posting — resolve an account per role, throw (or,
 * historically, silently skip) when a role's account is missing, accumulate
 * debit/credit lines per account, then hand off to the posting service. That
 * duplication is why one "missing tax account" bug shipped in four different
 * flavours (report 180). This service owns that middle layer once.
 *
 * What it does NOT own: account-id RESOLUTION (code → id), inventory/stock
 * writes, settlement, or the document's own status transitions. Callers
 * pre-resolve account ids (they need their repos) and declare a posting plan;
 * the poster validates the plan, assembles balanced voucher lines, and posts
 * through the injected posting service. Audit hand-off is folded in during the
 * per-document migration (Stages B–D), not here.
 */

export type VoucherSide = 'Debit' | 'Credit';

/** The canonical assembled voucher line — replaces the three duplicate
 *  `VoucherAccumulatedLine` interfaces in the SI/PI/PR use cases. */
export interface SubledgerVoucherLine {
  accountId: string;
  side: VoucherSide;
  baseAmount: number;
  docAmount: number;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * One declared posting entry. `accountId` may be `undefined` when the role was
 * not configured — the poster turns that into a uniform `AccountMappingError`
 * rather than letting it become a silently-unbalanced voucher.
 */
export interface SubledgerPostingEntry {
  role: AccountRole;
  accountId: string | undefined;
  side: VoucherSide;
  baseAmount: number;
  docAmount: number;
  notes?: string;
  metadata?: Record<string, any>;
  /** Context used to build a helpful AccountMappingError if `accountId` is missing. */
  missingAccountContext?: {
    itemId?: string;
    lineNo?: number;
    fallbackChain?: string[];
    hint?: string;
  };
}

export interface SubledgerPostingPlan {
  companyId: string;
  voucherType: VoucherType;
  voucherNo: string;
  date: string;
  description: string;
  currency: string;
  exchangeRate: number;
  entries: SubledgerPostingEntry[];
  createdBy: string;
  /** The document's REAL approval state — forwarded to the guard (Law 7). */
  approved: boolean;
  metadata?: Record<string, any>;
  reference?: string | null;
  postingLockPolicy?: PostingLockPolicy;
  baseCurrencyOverride?: string;
}

/**
 * The minimal surface of the existing `SubledgerVoucherPostingService` the
 * poster depends on. Declared as an interface so the poster can be unit-tested
 * with a mock and is not coupled to the concrete posting service.
 */
export interface ISubledgerPostingService {
  postInTransaction(
    input: {
      companyId: string;
      voucherType: VoucherType;
      voucherNo: string;
      date: string;
      description: string;
      currency: string;
      exchangeRate: number;
      lines: Array<Record<string, any>>;
      metadata?: Record<string, any>;
      reference?: string | null;
      createdBy: string;
      approved?: boolean;
      postingLockPolicy?: PostingLockPolicy;
      baseCurrencyOverride?: string;
    },
    transaction?: unknown
  ): Promise<{ id: string }>;
}

/** Two amounts are equal for ledger purposes when within half a minor unit. */
const BALANCE_EPSILON = 0.001;

export class SubledgerDocumentPoster {
  /**
   * FUP-3: when `bridge` is provided, document vouchers route through the accounting bridge
   * (full-vs-minimal decision — no GL voucher when the Accounting App is disabled) and `post`
   * returns `null` in minimal mode. Without a bridge it falls back to the direct posting service,
   * preserving legacy behavior for existing unit tests.
   */
  constructor(
    private readonly postingService: ISubledgerPostingService,
    private readonly bridge?: IAccountingBridge
  ) {}

  /**
   * Validate the plan, assemble balanced voucher lines, and post. Returns the created voucher's id,
   * or `null` when the bridge recorded the event in minimal mode (no GL voucher posted).
   */
  async post(plan: SubledgerPostingPlan, transaction?: unknown): Promise<{ id: string } | null> {
    const lines = this.assembleLines(plan);
    const input = {
      companyId: plan.companyId,
      voucherType: plan.voucherType,
      voucherNo: plan.voucherNo,
      date: plan.date,
      description: plan.description,
      currency: plan.currency,
      exchangeRate: plan.exchangeRate,
      lines,
      metadata: plan.metadata,
      reference: plan.reference ?? null,
      createdBy: plan.createdBy,
      approved: plan.approved,
      postingLockPolicy: plan.postingLockPolicy,
      baseCurrencyOverride: plan.baseCurrencyOverride,
    };

    if (this.bridge) {
      const result = await this.bridge.recordFinancialEvent({
        kind: String(plan.voucherType),
        subledgerVoucher: input,
        transaction,
      });
      return result.voucher ? { id: result.voucher.id } : null;
    }

    return this.postingService.postInTransaction(input, transaction);
  }

  /**
   * Pure assembly step (exposed for unit tests). Maps entries 1:1 to voucher
   * lines, **preserving caller granularity** (per-line notes + metadata for
   * drill-down — e.g. a Purchase Invoice keeps one debit line per source line).
   * Callers that want one line per account (e.g. Sales Invoice revenue/tax
   * buckets) pre-fold their entries with {@link accumulateByAccount}.
   *
   *   1. Drop zero-amount entries (a line with no value posts nothing) — so an
   *      unconfigured-but-unused role (e.g. tax with 0 tax) never blocks.
   *   2. Refuse any non-zero entry whose account role was not configured —
   *      uniform AccountMappingError instead of a silently-unbalanced voucher.
   *   3. Assert the lines balance (debit == credit in base AND doc) — a clearer
   *      failure than the downstream balance check.
   */
  assembleLines(plan: SubledgerPostingPlan): SubledgerVoucherLine[] {
    const lines: SubledgerVoucherLine[] = [];

    for (const entry of plan.entries) {
      const base = roundMoney(entry.baseAmount || 0);
      const doc = roundMoney(entry.docAmount || 0);
      if (base === 0 && doc === 0) continue;

      if (!entry.accountId) {
        const ctx = entry.missingAccountContext ?? {};
        throw new AccountMappingError({
          companyId: plan.companyId,
          itemId: ctx.itemId,
          accountRole: entry.role,
          fallbackChain: ctx.fallbackChain ?? [],
          lineNo: ctx.lineNo,
          hint: ctx.hint,
        });
      }

      lines.push({
        accountId: entry.accountId,
        side: entry.side,
        baseAmount: base,
        docAmount: doc,
        notes: entry.notes,
        metadata: entry.metadata,
      });
    }

    if (lines.length < 2) {
      throw new Error(
        `Subledger voucher ${plan.voucherNo} must have at least two lines after assembly (got ${lines.length}).`
      );
    }

    this.assertBalanced(lines, plan.voucherNo);
    return lines;
  }

  /**
   * Optional pre-fold: sum entries that share the same (account, side) into one
   * entry, for callers that want one voucher line per account rather than per
   * source line (Sales Invoice revenue/tax/discount buckets, returns). Replaces
   * the `addToBucket` helper duplicated across the SI/SR use cases. Keeps the
   * role/notes/metadata of the first entry for each (account, side) group.
   * Entries with no `accountId` are passed through untouched so
   * {@link assembleLines} still raises the proper AccountMappingError.
   */
  static accumulateByAccount(entries: SubledgerPostingEntry[]): SubledgerPostingEntry[] {
    const buckets = new Map<string, SubledgerPostingEntry>();
    const passthrough: SubledgerPostingEntry[] = [];
    for (const entry of entries) {
      if (!entry.accountId) {
        passthrough.push(entry);
        continue;
      }
      const key = `${entry.accountId}|${entry.side}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.baseAmount = roundMoney(existing.baseAmount + (entry.baseAmount || 0));
        existing.docAmount = roundMoney(existing.docAmount + (entry.docAmount || 0));
      } else {
        buckets.set(key, { ...entry });
      }
    }
    return [...buckets.values(), ...passthrough];
  }

  private assertBalanced(lines: SubledgerVoucherLine[], voucherNo: string): void {
    let debitBase = 0;
    let creditBase = 0;
    let debitDoc = 0;
    let creditDoc = 0;
    for (const line of lines) {
      if (line.side === 'Debit') {
        debitBase += line.baseAmount;
        debitDoc += line.docAmount;
      } else {
        creditBase += line.baseAmount;
        creditDoc += line.docAmount;
      }
    }
    debitBase = roundMoney(debitBase);
    creditBase = roundMoney(creditBase);
    debitDoc = roundMoney(debitDoc);
    creditDoc = roundMoney(creditDoc);

    if (Math.abs(debitBase - creditBase) > BALANCE_EPSILON) {
      throw new Error(
        `Subledger voucher ${voucherNo} is not balanced in base currency: debit=${debitBase}, credit=${creditBase}.`
      );
    }
    if (Math.abs(debitDoc - creditDoc) > BALANCE_EPSILON) {
      throw new Error(
        `Subledger voucher ${voucherNo} is not balanced in document currency: debit=${debitDoc}, credit=${creditDoc}.`
      );
    }
  }
}
