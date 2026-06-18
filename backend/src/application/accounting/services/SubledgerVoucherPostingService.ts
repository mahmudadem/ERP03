import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { VoucherPostingStrategyFactory } from '../../../domain/accounting/factories/VoucherPostingStrategyFactory';
import { IPostingPolicy } from '../../../domain/accounting/policies/IPostingPolicy';
import { AccountingPolicyConfig } from '../../../domain/accounting/policies/PostingPolicyTypes';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { PeriodLockService } from './PeriodLockService';
import { PostingGateway } from './PostingGateway';

export interface PostSubledgerVoucherInput {
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
  /**
   * The source document's REAL approval state. When `false`, the posting is presented to the
   * guard as NOT approved, so an active ApprovalRequiredPolicy rejects it before any ledger write.
   * Omitted/`true` → treated as approved, so existing callers are unaffected (safe-by-default).
   * The posting path must NOT forge approval; approval is earned by clearing the guard (Law 7).
   */
  approved?: boolean;
  postingLockPolicy?: PostingLockPolicy;
  strategyPayload?: Record<string, any>;
  baseCurrencyOverride?: string;
}

export interface SubledgerAccountingPolicyRegistry {
  getConfig(companyId: string): Promise<AccountingPolicyConfig>;
  getEnabledPolicies(companyId: string): Promise<IPostingPolicy[]>;
}

export class SubledgerVoucherPostingService {
  private readonly validationService: VoucherValidationService;

  constructor(
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly accountRepo?: IAccountRepository,
    validationService?: VoucherValidationService,
    private readonly periodLockService?: PeriodLockService,
    private readonly policyRegistry?: SubledgerAccountingPolicyRegistry
  ) {
    this.validationService = validationService || new VoucherValidationService();
  }

  async postInTransaction(
    input: PostSubledgerVoucherInput,
    transaction?: unknown
  ): Promise<VoucherEntity> {
    if (this.periodLockService) {
      await this.periodLockService.assertPostingAllowed(
        input.companyId,
        input.date,
        input.metadata?.periodLockOverride
      );
    }

    const baseCurrency = (
      input.baseCurrencyOverride
      || (await this.companyCurrencyRepo.getBaseCurrency(input.companyId))
      || input.currency
      || 'USD'
    ).toUpperCase();

    const voucherCurrency = (input.currency || baseCurrency).toUpperCase();
    const parsedRate = Number(input.exchangeRate);
    const effectiveExchangeRate = voucherCurrency === baseCurrency
      ? 1
      : (parsedRate > 0 ? parsedRate : 1);

    const strategy = VoucherPostingStrategyFactory.getStrategy(input.voucherType);
    const strategyInput = {
      ...(input.strategyPayload || {}),
      currency: voucherCurrency,
      exchangeRate: effectiveExchangeRate,
      lines: input.lines || [],
    };
    const voucherLines = await strategy.generateLines(strategyInput, input.companyId, baseCurrency);
    if (voucherLines.length < 2) {
      throw new Error('Subledger voucher must have at least two lines');
    }

    const totalDebit = roundMoney(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = roundMoney(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Subledger voucher is not balanced: debit=${totalDebit}, credit=${totalCredit}`);
    }

    const now = new Date();
    const draftApprovedVoucher = new VoucherEntity(
      randomUUID(),
      input.companyId,
      input.voucherNo || `V-${Date.now()}`,
      input.voucherType,
      input.date,
      input.description || '',
      voucherCurrency,
      baseCurrency,
      effectiveExchangeRate,
      voucherLines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      input.metadata || {},
      input.createdBy,
      now,
      input.createdBy,
      now,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      input.reference || null
    );

    const postedVoucher = draftApprovedVoucher.post(
      input.createdBy,
      now,
      input.postingLockPolicy || PostingLockPolicy.FLEXIBLE_LOCKED
    );

    // The full rulebook + the ledger write go through the single sanctioned choke point. The guard
    // derives approval from the caller's REAL state (`input.approved`), never the voucher's own
    // stamp (Law 7), so an active ApprovalRequiredPolicy rejects an unapproved subledger posting
    // before any ledger row is written.
    //
    // INTERIM fail-closed for inventory (see planning/briefs/20260615-approval-record-redesign.md):
    // historically `approved` defaulted to TRUE when omitted — a fail-OPEN default that let
    // inventory GL postings (valued transfer, stock adjustment, opening stock) silently bypass an
    // active ApprovalRequiredPolicy in strict mode. Until the approval-record redesign lands, when
    // an inventory-origin posting does NOT state its approval, resolve the REAL requirement from the
    // accounting config instead of assuming approved. An explicit `input.approved` (Sales/Purchases)
    // always wins; other omitting callers keep the legacy default to avoid unrelated blast radius
    // (DN/GRN are tracked for the full redesign, not changed here).
    const approved = await this.resolveApproved(input);

    const gateway = new PostingGateway(
      this.ledgerRepo,
      this.validationService,
      this.policyRegistry,
      this.accountRepo
    );
    await gateway.record(
      postedVoucher,
      {
        userId: input.createdBy,
        approved,
        enforcePolicies: true,
      },
      transaction
    );

    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
  }

  /**
   * Decide the approval state to present to the guard. Precedence:
   *  1. Explicit `input.approved` from the caller (Sales/Purchases) — always honored.
   *  2. Inventory-origin postings that omit it — resolve the REAL requirement from accounting
   *     config (fail closed): if approval is required for this voucher type, present NOT approved so
   *     ApprovalRequiredPolicy blocks it instead of the old fail-open default silently posting.
   *  3. Any other omitting caller — legacy default (approved) to avoid unrelated blast radius.
   * Interim measure; the full fix removes the boolean entirely (see the redesign brief).
   */
  private async resolveApproved(input: PostSubledgerVoucherInput): Promise<boolean> {
    if (input.approved !== undefined) return input.approved;

    const isInventoryOrigin = input.metadata?.sourceModule === 'inventory';
    if (isInventoryOrigin && this.policyRegistry) {
      const config = await this.policyRegistry.getConfig(input.companyId);
      const exempt = (config as any).approvalExemptVoucherTypes ?? [];
      const approvalRequired = !!(config as any).approvalRequired && !exempt.includes(input.voucherType);
      return !approvalRequired;
    }

    return true;
  }

  async deleteVoucherInTransaction(
    companyId: string,
    voucherId: string,
    transaction?: unknown
  ): Promise<void> {
    if (!voucherId) return;
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) {
      throw new Error(
        `Cannot delete ledger rows for missing voucher ${voucherId}; guarded deletion requires voucher context`
      );
    }

    const gateway = new PostingGateway(
      this.ledgerRepo,
      this.validationService,
      this.policyRegistry,
      this.accountRepo
    );
    await gateway.deleteVoucherLedger(
      voucher,
      {
        userId:
          (voucher as any).updatedBy ||
          (voucher as any).postedBy ||
          (voucher as any).createdBy ||
          'system',
        approved: true,
      },
      transaction
    );
    await this.voucherRepo.delete(companyId, voucherId, transaction);
  }

  async deleteVouchersInTransaction(
    companyId: string,
    voucherIds: Array<string | null | undefined>,
    transaction?: unknown
  ): Promise<void> {
    const uniqueIds = Array.from(new Set((voucherIds || []).filter((id): id is string => !!id)));
    for (const voucherId of uniqueIds) {
      await this.deleteVoucherInTransaction(companyId, voucherId, transaction);
    }
  }
}
