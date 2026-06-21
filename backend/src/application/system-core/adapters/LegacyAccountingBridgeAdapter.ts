import { randomUUID } from 'crypto';
import { PostingLog, PostingSourceModule, PostingSourceType } from '../../../domain/accounting/entities/PostingLog';
import { IPostingLogRepository } from '../../../repository/interfaces/accounting/IPostingLogRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { IAccountingBridge, FinancialEvent } from '../contracts/IAccountingBridge';

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

  private async shouldUseFullPosting(companyId: string): Promise<boolean> {
    if (!this.companyModuleRepo) return true;
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return Boolean(accountingModule?.isEnabled);
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
          'Accounting App disabled: financial event recorded in minimal-journal mode; no ledger voucher was posted.',
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
