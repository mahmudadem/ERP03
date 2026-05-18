import { randomUUID } from 'crypto';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { PaymentHistory, PaymentMethod } from '../../../domain/shared/entities/PaymentHistory';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity, roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { VoucherType, VoucherStatus, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { roundMoney as roundSalesMoney } from './SalesPostingHelpers';

export type SettlementMode = 'DEFERRED' | 'CASH_FULL' | 'MULTI';

export interface SettlementRow {
  settlementAccountId?: string;
  amountBase: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface PostSalesInvoiceWithSettlementInput {
  settlementMode: SettlementMode;
  receivablePayableAccountId?: string;
  settlements: SettlementRow[];
}

const SETTLEMENT_MODES: SettlementMode[] = ['DEFERRED', 'CASH_FULL', 'MULTI'];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const resolvePaymentMethodAccount = (
  settings: SalesSettings | null,
  paymentMethod: PaymentMethod | undefined
): string | undefined => {
  if (!settings || !paymentMethod) return undefined;
  const config = (settings.paymentMethodConfigs || []).find(
    (entry) => entry.method === paymentMethod && (entry.isEnabled ?? true)
  );
  return config?.settlementAccountId;
};

const recalcPaymentStatus = (invoice: SalesInvoice): void => {
  if (invoice.outstandingAmountBase <= 0) {
    invoice.paymentStatus = 'PAID';
  } else if (invoice.paidAmountBase > 0) {
    invoice.paymentStatus = 'PARTIALLY_PAID';
  } else {
    invoice.paymentStatus = 'UNPAID';
  }
};

export class UpdateSalesInvoicePaymentStatusUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(companyId: string, siId: string, paidAmountBase: number): Promise<SalesInvoice> {
    if (Number.isNaN(paidAmountBase)) {
      throw new Error('paidAmountBase must be a valid number');
    }

    const invoice = await this.salesInvoiceRepo.getById(companyId, siId);
    if (!invoice) throw new Error(`Sales invoice not found: ${siId}`);
    if (invoice.status !== 'POSTED') {
      throw new Error('Payment status can only be updated for posted sales invoices');
    }

    invoice.paidAmountBase = roundSalesMoney(paidAmountBase);
    invoice.outstandingAmountBase = roundSalesMoney(invoice.grandTotalBase - invoice.paidAmountBase);
    recalcPaymentStatus(invoice);
    invoice.updatedAt = new Date();

    await this.salesInvoiceRepo.update(invoice);
    return invoice;
  }
}

export class PostSalesInvoiceWithSettlementUseCase {
  private readonly voucherValidationService = new VoucherValidationService();

  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly paymentHistoryRepo: IPaymentHistoryRepository,
    private readonly salesSettingsRepo: ISalesSettingsRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly voucherSequenceRepo: IVoucherSequenceRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly accountRepo?: IAccountRepository
  ) {}

  private async resolveAccountId(companyId: string, idOrCode: string): Promise<string> {
    if (!idOrCode) return '';
    if (!this.accountRepo) return idOrCode;
    const account =
      (await this.accountRepo.getById(companyId, idOrCode)) ||
      (await this.accountRepo.getByUserCode(companyId, idOrCode));
    return account ? account.id : idOrCode;
  }

  async execute(
    companyId: string,
    userId: string,
    siId: string,
    input: PostSalesInvoiceWithSettlementInput
  ): Promise<{ invoice: SalesInvoice; payments: PaymentHistory[]; voucherIds: string[] }> {
    const { settlementMode, receivablePayableAccountId, settlements } = input;

    if (!SETTLEMENT_MODES.includes(settlementMode)) {
      throw new Error(`Invalid settlementMode: ${settlementMode}. Must be one of: ${SETTLEMENT_MODES.join(', ')}`);
    }

    const invoice = await this.salesInvoiceRepo.getById(companyId, siId);
    if (!invoice) throw new Error(`Sales invoice not found: ${siId}`);
    if (invoice.status !== 'POSTED') {
      throw new Error('Settlement can only be posted for posted sales invoices');
    }

    const baseCurrency = await this.companyCurrencyRepo.getBaseCurrency(companyId);
    if (!baseCurrency) throw new Error('Company base currency is not configured');
    const settings = await this.salesSettingsRepo.getSettings(companyId);
    const effectiveReceivablePayableAccountId = receivablePayableAccountId?.trim() || settings?.defaultARAccountId;
    if (!effectiveReceivablePayableAccountId) {
      throw new Error('receivablePayableAccountId is required or Sales default AR account must be configured');
    }
    const resolvedReceivablePayableAccountId = await this.resolveAccountId(companyId, effectiveReceivablePayableAccountId);

    const settlementTotal = settlements.reduce((sum, s) => sum + roundMoney(s.amountBase), 0);

    if (settlementMode === 'CASH_FULL') {
      const outstanding = roundSalesMoney(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
      if (Math.abs(settlementTotal - outstanding) > 0.01) {
        throw new Error(`CASH_FULL settlement total (${settlementTotal}) must equal outstanding amount (${outstanding})`);
      }
      if (settlements.length !== 1) {
        throw new Error('CASH_FULL mode requires exactly one settlement row');
      }
    }

    if (settlementMode === 'MULTI') {
      const outstanding = roundSalesMoney(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
      if (settlementTotal > outstanding + 0.01) {
        throw new Error(`MULTI settlement total (${settlementTotal}) exceeds outstanding amount (${outstanding})`);
      }
      if (settlements.length === 0) {
        throw new Error('MULTI mode requires at least one settlement row');
      }
      for (const s of settlements) {
        if (s.amountBase <= 0 || Number.isNaN(s.amountBase)) {
          throw new Error('Each settlement row amount must be positive');
        }
        if (s.paymentMethod && !VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
          throw new Error(`Invalid paymentMethod: ${s.paymentMethod}`);
        }
        const effectiveSettlementAccountId = s.settlementAccountId?.trim() || resolvePaymentMethodAccount(settings, s.paymentMethod);
        if (!effectiveSettlementAccountId) {
          throw new Error('Each settlement row requires a settlementAccountId or configured paymentMethod mapping');
        }
      }
    }

    const createdVoucherIds: string[] = [];
    const createdPayments: PaymentHistory[] = [];

    const postingLogic = async (transaction?: unknown) => {
      const now = new Date();

      if (settlementMode === 'DEFERRED') {
        return;
      }

      for (const settlement of settlements) {
        const settlementAmountBase = roundMoney(settlement.amountBase);
        const settlementDate = settlement.paymentDate || now.toISOString().split('T')[0];
        const settlementMethod = settlement.paymentMethod || 'CASH';
        const effectiveSettlementAccountId =
          settlement.settlementAccountId?.trim() || resolvePaymentMethodAccount(settings, settlementMethod);
        if (!effectiveSettlementAccountId) {
          throw new Error(`No settlement account configured for payment method ${settlementMethod}`);
        }
        const resolvedSettlementAccountId = await this.resolveAccountId(companyId, effectiveSettlementAccountId);

        const voucherNo = await this.voucherSequenceRepo.getNextNumber(companyId, 'RV');
        const voucherId = `vch_${randomUUID()}`;

        const docAmount = roundMoney(settlementAmountBase / invoice.exchangeRate);
        const baseCurrencyUpper = baseCurrency.toUpperCase();

        const drLine = new VoucherLineEntity(
          1,
          resolvedSettlementAccountId,
          'Debit',
          settlementAmountBase,
          baseCurrencyUpper,
          docAmount,
          invoice.currency,
          invoice.exchangeRate,
          `Receipt for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
        );
        const crLine = new VoucherLineEntity(
          2,
          resolvedReceivablePayableAccountId,
          'Credit',
          settlementAmountBase,
          baseCurrencyUpper,
          docAmount,
          invoice.currency,
          invoice.exchangeRate,
          `Receipt for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
        );

        const totalDebit = roundMoney(drLine.debitAmount);
        const totalCredit = roundMoney(crLine.creditAmount);

        const approvedVoucher = new VoucherEntity(
          voucherId,
          companyId,
          voucherNo,
          VoucherType.RECEIPT,
          settlementDate,
          `Receipt for Sales Invoice ${invoice.invoiceNumber}`,
          invoice.currency.toUpperCase(),
          baseCurrencyUpper,
          invoice.exchangeRate,
          [drLine, crLine],
          totalDebit,
          totalCredit,
          VoucherStatus.APPROVED,
          { sourceModule: 'sales', sourceInvoiceId: siId, settlementMode },
          userId,
          now,
          userId,
          now,
          undefined, undefined, undefined, undefined, undefined,
          undefined, undefined, undefined,
          settlement.reference || null
        );

        const postedVoucher = approvedVoucher.post(userId, now, PostingLockPolicy.FLEXIBLE_LOCKED);

        this.voucherValidationService.validateCore(postedVoucher);
        if (this.accountRepo) {
          await this.voucherValidationService.validateAccounts(postedVoucher, this.accountRepo);
        }

        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        createdVoucherIds.push(voucherId);

        const paymentId = `pay_${randomUUID()}`;
        const payment = new PaymentHistory({
          id: paymentId,
          companyId,
          sourceType: 'SALES_INVOICE',
          sourceId: siId,
          sourceNumber: invoice.invoiceNumber,
          amountBase: settlementAmountBase,
          currency: invoice.currency,
          exchangeRate: invoice.exchangeRate,
          amountDoc: docAmount,
          paymentDate: settlementDate,
          paymentMethod: settlementMethod,
          reference: settlement.reference || undefined,
          notes: settlement.notes || undefined,
          voucherId,
          createdBy: userId,
          createdAt: now,
        });

        await this.paymentHistoryRepo.create(payment, transaction);
        createdPayments.push(payment);

        invoice.paidAmountBase = roundSalesMoney((invoice.paidAmountBase || 0) + settlementAmountBase);
        invoice.outstandingAmountBase = roundSalesMoney(Math.max(invoice.grandTotalBase - invoice.paidAmountBase, 0));
        recalcPaymentStatus(invoice);
      }

      invoice.updatedAt = new Date();
      await this.salesInvoiceRepo.update(invoice, transaction);
    };

    await this.transactionManager.runTransaction(postingLogic);

    const finalInvoice = await this.salesInvoiceRepo.getById(companyId, siId);
    if (!finalInvoice) throw new Error('Invoice not found after settlement');

    return { invoice: finalInvoice, payments: createdPayments, voucherIds: createdVoucherIds };
  }
}

export class RecordSalesInvoicePaymentUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly paymentHistoryRepo: IPaymentHistoryRepository,
    private readonly salesSettingsRepo: ISalesSettingsRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly voucherSequenceRepo: IVoucherSequenceRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly accountRepo?: IAccountRepository
  ) {}

  async execute(
    companyId: string,
    userId: string,
    siId: string,
    input: PostSalesInvoiceWithSettlementInput
  ): Promise<{ invoice: SalesInvoice; payments: PaymentHistory[]; voucherIds: string[] }> {
    const useCase = new PostSalesInvoiceWithSettlementUseCase(
      this.salesInvoiceRepo,
      this.paymentHistoryRepo,
      this.salesSettingsRepo,
      this.voucherRepo,
      this.voucherSequenceRepo,
      this.ledgerRepo,
      this.companyCurrencyRepo,
      this.transactionManager,
      this.accountRepo
    );
    return useCase.execute(companyId, userId, siId, input);
  }
}
