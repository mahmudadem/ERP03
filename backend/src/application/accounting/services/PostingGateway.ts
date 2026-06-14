import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { IPostingPolicy } from '../../../domain/accounting/policies/IPostingPolicy';
import {
  AccountingPolicyConfig,
  PostingPolicyContext,
} from '../../../domain/accounting/policies/PostingPolicyTypes';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';

/**
 * Registry contract the gateway needs to run the policy set. Mirrors the shape the subledger and
 * manual posting paths already depend on, so any existing `AccountingPolicyRegistry` satisfies it.
 */
export interface PostingGatewayPolicyRegistry {
  getConfig(companyId: string): Promise<AccountingPolicyConfig>;
  getEnabledPolicies(companyId: string): Promise<IPostingPolicy[]>;
}

/**
 * The caller's posting intent. The gateway never infers approval from the voucher's own status —
 * approval is asserted by the caller from the source document's REAL state (Law 7). This prevents a
 * posting path from forging an APPROVED stamp to slip past the approval policy.
 */
export interface PostingContext {
  /** Acting user — drives user-scoped policies (e.g. AccountAccessPolicy). */
  userId: string;
  /**
   * The source document's REAL approval state. `false` → the approval policy sees the posting as
   * NOT approved and rejects it before any ledger write. Omitted/`true` → treated as approved.
   */
  approved?: boolean;
  /**
   * When `false`, the policy set is skipped for this write. This is an EXPLICIT, auditable
   * exemption — `exemptionReason` is required so every policy-skip is greppable and reviewable.
   * The iron laws (validateCore / validateAccounts) ALWAYS run regardless.
   */
  enforcePolicies?: boolean;
  /** Required when `enforcePolicies === false`. Documents WHY this write skips the policy set. */
  exemptionReason?: string;
  /** Optional correlation id for structured rejection logging. */
  correlationId?: string;
}

/**
 * PostingGateway — the single, mandatory choke point in front of every ledger mutation.
 *
 * Stage 4 of the posting-authority hardening (see docs/architecture/posting-authority.md): nothing
 * may call ledger mutation repository methods directly. Every posting path constructs a gateway
 * and calls one of its mutation methods, which runs the applicable rulebook before touching the
 * ledger. An architecture test (tests/architecture/PostingAuthority.test.ts) forbids any other
 * caller of `recordForVoucher`, `deleteForVoucher`, or `markReconciled`, so the door cannot be
 * bypassed.
 *
 * Exemptions are not silent: a caller that legitimately skips the policy set (e.g. a system-
 * generated settlement or year-end closing voucher) must pass `enforcePolicies: false` with an
 * `exemptionReason`. Folding those exemptions into the policy set is tracked as Stage 4b.
 */
export class PostingGateway {
  constructor(
    private readonly ledgerRepo: ILedgerRepository,
    private readonly validationService: VoucherValidationService,
    private readonly policyRegistry?: PostingGatewayPolicyRegistry,
    private readonly accountRepo?: IAccountRepository
  ) {}

  /**
   * Validate then write. The ONLY sanctioned path to the ledger.
   * @param voucher A POSTED voucher (the caller is responsible for the DRAFT→APPROVED→POSTED
   *   state transition; the gateway enforces the rulebook, not the lifecycle).
   */
  async record(
    voucher: VoucherEntity,
    ctx: PostingContext,
    transaction?: unknown
  ): Promise<void> {
    await this.validateRecordIntent(voucher, ctx);

    await this.ledgerRepo.recordForVoucher(voucher, transaction);
  }

  /**
   * Replace all ledger rows for an already-posted voucher. This is the sanctioned path for
   * editable-posted-voucher resyncs: policy validation and ledger delete+record happen behind the
   * same guarded door.
   */
  async replaceForVoucher(
    voucher: VoucherEntity,
    ctx: PostingContext,
    transaction?: unknown
  ): Promise<void> {
    await this.validateRecordIntent(voucher, ctx);
    await this.ledgerRepo.deleteForVoucher(voucher.companyId, voucher.id, transaction);
    await this.ledgerRepo.recordForVoucher(voucher, transaction);
  }

  /**
   * Remove ledger rows for an existing voucher. Used by approved cancel/delete/unpost flows.
   * Deletion does not rerun core voucher balancing because historical malformed vouchers may need
   * cleanup, but it does run the central policy set unless the caller records an explicit exemption.
   */
  async deleteVoucherLedger(
    voucher: VoucherEntity,
    ctx: PostingContext,
    transaction?: unknown
  ): Promise<void> {
    await this.validatePolicyIntent(voucher, ctx);
    await this.ledgerRepo.deleteForVoucher(voucher.companyId, voucher.id, transaction);
  }

  /**
   * Mark a ledger entry as reconciled. Bank reconciliation does not have a voucher policy context,
   * but it is still a ledger mutation and must go through the only ledger door.
   */
  async markLedgerEntryReconciled(input: {
    companyId: string;
    ledgerEntryId: string;
    reconciliationId: string;
    bankStatementLineId: string;
    userId: string;
  }): Promise<void> {
    if (!input.userId || !input.userId.trim()) {
      throw new Error('PostingGateway: markReconciled requires an acting user');
    }

    await this.ledgerRepo.markReconciled(
      input.companyId,
      input.ledgerEntryId,
      input.reconciliationId,
      input.bankStatementLineId
    );
  }

  private async validateRecordIntent(voucher: VoucherEntity, ctx: PostingContext): Promise<void> {
    // Iron laws — always, no exemption.
    this.validationService.validateCore(voucher, ctx.correlationId);
    if (this.accountRepo) {
      await this.validationService.validateAccounts(voucher, this.accountRepo);
    }

    await this.validatePolicyIntent(voucher, ctx);
  }

  private async validatePolicyIntent(voucher: VoucherEntity, ctx: PostingContext): Promise<void> {
    if (ctx.enforcePolicies === false) {
      // Explicit, auditable exemption. The reason is mandatory so the skip is greppable.
      if (!ctx.exemptionReason || !ctx.exemptionReason.trim()) {
        throw new Error(
          'PostingGateway: enforcePolicies=false requires an exemptionReason documenting the skip'
        );
      }
      return;
    }

    await this.runPolicies(voucher, ctx);
  }

  private async runPolicies(voucher: VoucherEntity, ctx: PostingContext): Promise<void> {
    if (!this.policyRegistry) {
      return;
    }

    const config = await this.policyRegistry.getConfig(voucher.companyId);
    const policies = await this.policyRegistry.getEnabledPolicies(voucher.companyId);
    if (policies.length === 0) {
      return;
    }

    const approved = ctx.approved !== false;
    const context: PostingPolicyContext = {
      companyId: voucher.companyId,
      voucherId: voucher.id,
      userId: ctx.userId,
      voucherType: voucher.type,
      voucherDate: voucher.date,
      voucherNo: voucher.voucherNo,
      baseCurrency: voucher.baseCurrency,
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      // Approval is derived from the caller's REAL state, never the voucher's own stamp (Law 7).
      status: approved ? voucher.status : VoucherStatus.DRAFT,
      isApproved: approved && voucher.isApproved,
      lines: voucher.lines,
      metadata: voucher.metadata,
      postingPeriodNo: voucher.postingPeriodNo,
    };

    await this.validationService.validatePolicies(
      context,
      policies,
      config.policyErrorMode || 'FAIL_FAST',
      ctx.correlationId
    );
  }
}
