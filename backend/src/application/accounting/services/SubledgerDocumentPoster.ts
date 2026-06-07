import { VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { AccountMappingError, AccountRole } from '../../../domain/accounting/errors/AccountMappingError';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';

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
  constructor(private readonly postingService: ISubledgerPostingService) {}

  /**
   * Validate the plan, assemble balanced voucher lines, and post. Returns the
   * created voucher's id.
   */
  async post(plan: SubledgerPostingPlan, transaction?: unknown): Promise<{ id: string }> {
    const lines = this.assembleLines(plan);
    return this.postingService.postInTransaction(
      {
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
      },
      transaction
    );
  }

  /**
   * Pure assembly step (exposed for unit tests):
   *   1. Drop zero-amount entries (a line with no value posts nothing).
   *   2. Refuse any entry whose account role was not configured — uniform
   *      AccountMappingError instead of an unbalanced voucher.
   *   3. Accumulate entries that share the same (account, side) so a voucher
   *      has one line per account-side, not one per source line.
   *   4. Assert the assembled lines balance (debit base == credit base, and the
   *      same for doc) — a clearer failure than the downstream balance check.
   */
  assembleLines(plan: SubledgerPostingPlan): SubledgerVoucherLine[] {
    const buckets = new Map<string, SubledgerVoucherLine>();

    for (const entry of plan.entries) {
      const base = roundMoney(entry.baseAmount || 0);
      const doc = roundMoney(entry.docAmount || 0);
      // A zero-value entry contributes nothing — skip before the account check
      // so an unconfigured-but-unused role (e.g. tax with 0 tax) never blocks.
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

      const key = `${entry.accountId}|${entry.side}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.baseAmount = roundMoney(existing.baseAmount + base);
        existing.docAmount = roundMoney(existing.docAmount + doc);
      } else {
        buckets.set(key, {
          accountId: entry.accountId,
          side: entry.side,
          baseAmount: base,
          docAmount: doc,
          notes: entry.notes,
          metadata: entry.metadata,
        });
      }
    }

    const lines = Array.from(buckets.values());
    if (lines.length < 2) {
      throw new Error(
        `Subledger voucher ${plan.voucherNo} must have at least two lines after assembly (got ${lines.length}).`
      );
    }

    this.assertBalanced(lines, plan.voucherNo);
    return lines;
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
