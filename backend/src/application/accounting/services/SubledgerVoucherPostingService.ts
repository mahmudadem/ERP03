import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { VoucherPostingStrategyFactory } from '../../../domain/accounting/factories/VoucherPostingStrategyFactory';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';

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
  postingLockPolicy?: PostingLockPolicy;
  strategyPayload?: Record<string, any>;
}

export class SubledgerVoucherPostingService {
  private readonly validationService: VoucherValidationService;

  constructor(
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly accountRepo?: IAccountRepository,
    validationService?: VoucherValidationService
  ) {
    this.validationService = validationService || new VoucherValidationService();
  }

  async postInTransaction(
    input: PostSubledgerVoucherInput,
    transaction?: unknown
  ): Promise<VoucherEntity> {
    const baseCurrency = (
      (await this.companyCurrencyRepo.getBaseCurrency(input.companyId))
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

    this.validationService.validateCore(postedVoucher);
    if (this.accountRepo) {
      await this.validationService.validateAccounts(postedVoucher, this.accountRepo);
    }

    await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
  }

  async deleteVoucherInTransaction(
    companyId: string,
    voucherId: string,
    transaction?: unknown
  ): Promise<void> {
    if (!voucherId) return;
    await this.ledgerRepo.deleteForVoucher(companyId, voucherId, transaction);
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
