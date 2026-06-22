import { randomUUID } from 'crypto';
import { PostingLog, PostingSourceModule, PostingSourceType } from '../../../domain/accounting/entities/PostingLog';
import { IPostingLogRepository } from '../../../repository/interfaces/accounting/IPostingLogRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { IAccountingBridge, FinancialEvent, PreBuiltVoucherEvent } from '../contracts/IAccountingBridge';

export class LegacyAccountingBridgeAdapter implements IAccountingBridge {
  constructor(
    private readonly subledgerPostingService: SubledgerVoucherPostingService,
    private readonly companyModuleRepo?: ICompanyModuleRepository,
    private readonly postingLogRepo?: IPostingLogRepository
  ) {}

  async recordFinancialEvent(event: FinancialEvent) {
    if (!event.subledgerVoucher) return { mode: 'minimal' as const, voucher: null };

    if (await this.shouldUseFullPosting(event.subledgerVoucher.companyId)) {
      const voucher = await this.subledgerPostingService.postInTransaction(event.subledgerVoucher, event.transaction);
      return { mode: 'full' as const, voucher };
    }

    const eventLogId = await this.recordMinimalJournal(event);
    return { mode: 'minimal' as const, voucher: null, eventLogId };
  }

  /**
   * FUP-5: settlement/payment receipts that were assembled and posted to a `VoucherEntity` by the
   * caller. Full mode runs the caller's real posting action verbatim (byte-identical to the legacy
   * direct-gateway path); minimal mode skips the GL voucher and records a minimal journal.
   */
  async recordPreBuiltVoucher(event: PreBuiltVoucherEvent) {
    if (await this.shouldUseFullPosting(event.companyId)) {
      await event.postFull();
      return { mode: 'full' as const, voucher: event.voucher };
    }

    const eventLogId = await this.recordMinimalJournalForVoucher(event);
    return { mode: 'minimal' as const, voucher: null, eventLogId };
  }

  private async recordMinimalJournalForVoucher(event: PreBuiltVoucherEvent): Promise<string | undefined> {
    if (!this.postingLogRepo) return undefined;

    const v = event.voucher;
    const metadata = (v.metadata || {}) as Record<string, any>;
    const sourceModule = normalizeSourceModule(metadata.sourceModule);
    const sourceType = normalizeSourceType(metadata.sourceType || metadata.referenceType || event.kind);
    const sourceId = String(metadata.sourceInvoiceId || metadata.sourceId || metadata.referenceId || v.reference || v.voucherNo || event.kind);
    const id = `fj_${randomUUID()}`;

    await this.postingLogRepo.create(
      new PostingLog({
        id,
        companyId: event.companyId,
        sourceModule,
        sourceType,
        sourceId,
        sourceDocNumber: v.reference || v.voucherNo,
        strategy: `MinimalJournal:${event.kind}`,
        voucherIds: [],
        decisions: [],
        warnings: [
          'Not linked to accounting (accounting engine not initialized): settlement/payment recorded in minimal-journal mode; no ledger voucher was posted.',
        ],
        postedAt: new Date(),
        postedBy: v.createdBy,
      }),
      event.transaction
    );

    return id;
  }

  /**
   * Full posting depends on the Accounting **Engine** being ready (`initialized`), NOT on the
   * cosmetic Accounting **App/UI** toggle (`isEnabled`). See PR1 (done/102) + the engines-vs-modules
   * rule: the engine is always-on and posts under the hood whenever it has a chart of accounts;
   * the module on/off switch only controls UI visibility and must never gate posting. Minimal mode
   * is the explicit fallback for a company that genuinely has no accounting engine initialized
   * ("not linked to accounting").
   */
  private async shouldUseFullPosting(companyId: string): Promise<boolean> {
    if (!this.companyModuleRepo) return true;
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return Boolean(accountingModule?.initialized);
  }

  private async recordMinimalJournal(event: FinancialEvent): Promise<string | undefined> {
    if (!this.postingLogRepo || !event.subledgerVoucher) return undefined;

    const voucher = event.subledgerVoucher;
    const metadata = voucher.metadata || {};
    const sourceModule = normalizeSourceModule(metadata.sourceModule);
    const sourceType = normalizeSourceType(metadata.sourceType || metadata.referenceType || event.kind);
    const sourceId = String(metadata.sourceId || metadata.referenceId || voucher.reference || voucher.voucherNo || event.kind);
    const id = `fj_${randomUUID()}`;

    await this.postingLogRepo.create(
      new PostingLog({
        id,
        companyId: voucher.companyId,
        sourceModule,
        sourceType,
        sourceId,
        sourceDocNumber: voucher.reference || voucher.voucherNo,
        strategy: `MinimalJournal:${event.kind}`,
        voucherIds: [],
        decisions: [],
        warnings: [
          'Not linked to accounting (accounting engine not initialized): financial event recorded in minimal-journal mode; no ledger voucher was posted.',
        ],
        postedAt: new Date(),
        postedBy: voucher.createdBy,
      }),
      event.transaction
    );

    return id;
  }
}

function normalizeSourceModule(value: unknown): PostingSourceModule {
  return value === 'sales' || value === 'purchases' || value === 'inventory' || value === 'accounting' || value === 'pos'
    ? value
    : 'accounting';
}

function normalizeSourceType(value: unknown): PostingSourceType {
  const normalized = typeof value === 'string' ? value : 'MANUAL_VOUCHER';
  const allowed = new Set<PostingSourceType>([
    'SALES_INVOICE',
    'SALES_RETURN',
    'DELIVERY_NOTE',
    'SALES_RECEIPT',
    'PURCHASE_INVOICE',
    'PURCHASE_RETURN',
    'GOODS_RECEIPT',
    'PURCHASE_PAYMENT',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'OPENING_STOCK',
    'MANUAL_VOUCHER',
    'POS_SALE',
    'POS_RETURN',
    'POS_SHIFT',
  ]);
  return allowed.has(normalized as PostingSourceType) ? normalized as PostingSourceType : 'MANUAL_VOUCHER';
}
