import { randomUUID } from 'crypto';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { PaymentHistory, PaymentMethod } from '../../../domain/shared/entities/PaymentHistory';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { PostingGateway } from '../../accounting/services/PostingGateway';
import { VoucherLineEntity, roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherType, VoucherStatus, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { roundMoney as roundPurchMoney } from './PurchasePostingHelpers';

export type SettlementMode = 'DEFERRED' | 'CASH_FULL' | 'MULTI';

export interface SettlementRow {
  settlementAccountId: string;
  amountBase: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface PostPurchaseInvoiceWithSettlementInput {
  settlementMode: SettlementMode;
  receivablePayableAccountId: string;
  settlements: SettlementRow[];
}

const SETTLEMENT_MODES: SettlementMode[] = ['DEFERRED', 'CASH_FULL', 'MULTI'];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];

const recalcPaymentStatus = (invoice: PurchaseInvoice): void => {
  if (invoice.outstandingAmountBase <= 0) {
    invoice.paymentStatus = 'PAID';
  } else if (invoice.paidAmountBase > 0) {
    invoice.paymentStatus = 'PARTIALLY_PAID';
  } else {
    invoice.paymentStatus = 'UNPAID';
  }
};

export class UpdateInvoicePaymentStatusUseCase {
  constructor(private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository) {}

  async execute(companyId: string, invoiceId: string, paidAmountBase: number): Promise<PurchaseInvoice> {
    if (Number.isNaN(paidAmountBase)) {
      throw new Error('paidAmountBase must be a valid number');
    }

    const invoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
    if (!invoice) throw new Error(`Purchase invoice not found: ${invoiceId}`);
    if (invoice.status !== 'POSTED') {
      throw new Error('Payment status can only be updated for posted purchase invoices');
    }

    invoice.paidAmountBase = roundPurchMoney(paidAmountBase);
    invoice.outstandingAmountBase = roundPurchMoney(invoice.grandTotalBase - invoice.paidAmountBase);
    recalcPaymentStatus(invoice);
    invoice.updatedAt = new Date();

    await this.purchaseInvoiceRepo.update(invoice);
    return invoice;
  }
}

export class PostPurchaseInvoiceWithSettlementUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly paymentHistoryRepo: IPaymentHistoryRepository,
    private readonly purchaseSettingsRepo: IPurchaseSettingsRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly voucherSequenceRepo: IVoucherSequenceRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(
    companyId: string,
    userId: string,
    invoiceId: string,
    input: PostPurchaseInvoiceWithSettlementInput
  ): Promise<{ invoice: PurchaseInvoice; payments: PaymentHistory[]; voucherIds: string[] }> {
    const { settlementMode, receivablePayableAccountId, settlements } = input;

    if (!SETTLEMENT_MODES.includes(settlementMode)) {
      throw new Error(`Invalid settlementMode: ${settlementMode}. Must be one of: ${SETTLEMENT_MODES.join(', ')}`);
    }

    if (!receivablePayableAccountId?.trim()) {
      throw new Error('receivablePayableAccountId is required');
    }

    const invoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
    if (!invoice) throw new Error(`Purchase invoice not found: ${invoiceId}`);
    if (invoice.status !== 'POSTED') {
      throw new Error('Settlement can only be posted for posted purchase invoices');
    }

    const baseCurrency = await this.companyCurrencyRepo.getBaseCurrency(companyId);
    if (!baseCurrency) throw new Error('Company base currency is not configured');

    const settlementTotal = settlements.reduce((sum, s) => sum + roundMoney(s.amountBase), 0);

    if (settlementMode === 'CASH_FULL') {
      const outstanding = roundPurchMoney(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
      if (Math.abs(settlementTotal - outstanding) > 0.01) {
        throw new Error(`CASH_FULL settlement total (${settlementTotal}) must equal outstanding amount (${outstanding})`);
      }
      if (settlements.length !== 1) {
        throw new Error('CASH_FULL mode requires exactly one settlement row');
      }
    }

    if (settlementMode === 'MULTI') {
      const outstanding = roundPurchMoney(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
      if (settlementTotal > outstanding + 0.01) {
        throw new Error(`MULTI settlement total (${settlementTotal}) exceeds outstanding amount (${outstanding})`);
      }
      if (settlements.length === 0) {
        throw new Error('MULTI mode requires at least one settlement row');
      }
      for (const s of settlements) {
        if (!s.settlementAccountId?.trim()) {
          throw new Error('Each settlement row requires a settlementAccountId');
        }
        if (s.amountBase <= 0 || Number.isNaN(s.amountBase)) {
          throw new Error('Each settlement row amount must be positive');
        }
        if (s.paymentMethod && !VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
          throw new Error(`Invalid paymentMethod: ${s.paymentMethod}`);
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

        const voucherNo = await this.voucherSequenceRepo.getNextNumber(companyId, 'PV');
        const voucherId = `vch_${randomUUID()}`;

        const docAmount = roundMoney(settlementAmountBase / invoice.exchangeRate);
        const baseCurrencyUpper = baseCurrency.toUpperCase();

        const drLine = new VoucherLineEntity(
          1,
          receivablePayableAccountId,
          'Debit',
          settlementAmountBase,
          baseCurrencyUpper,
          docAmount,
          invoice.currency,
          invoice.exchangeRate,
          `Payment for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
        );
        const crLine = new VoucherLineEntity(
          2,
          settlement.settlementAccountId,
          'Credit',
          settlementAmountBase,
          baseCurrencyUpper,
          docAmount,
          invoice.currency,
          invoice.exchangeRate,
          `Payment for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
        );

        const totalDebit = roundMoney(drLine.debitAmount);
        const totalCredit = roundMoney(crLine.creditAmount);

        const approvedVoucher = new VoucherEntity(
          voucherId,
          companyId,
          voucherNo,
          VoucherType.PAYMENT,
          settlementDate,
          `Payment for Purchase Invoice ${invoice.invoiceNumber}`,
          invoice.currency.toUpperCase(),
          baseCurrencyUpper,
          invoice.exchangeRate,
          [drLine, crLine],
          totalDebit,
          totalCredit,
          VoucherStatus.APPROVED,
          { sourceModule: 'purchases', sourceInvoiceId: invoiceId, settlementMode },
          userId,
          now,
          userId,
          now,
          undefined, undefined, undefined, undefined, undefined,
          undefined, undefined, undefined,
          settlement.reference || null
        );

        const postedVoucher = approvedVoucher.post(userId, now, PostingLockPolicy.FLEXIBLE_LOCKED);

        // Single sanctioned ledger door. System-generated settlement payment is policy-exempt
        // (Stage 4b will fold settlement postings into the policy set).
        const gateway = new PostingGateway(this.ledgerRepo, new VoucherValidationService());
        await gateway.record(
          postedVoucher,
          {
            userId,
            enforcePolicies: false,
            exemptionReason: 'system-generated settlement payment during payment sync (Stage 4b)',
          },
          transaction
        );
        await this.voucherRepo.save(postedVoucher, transaction);
        createdVoucherIds.push(voucherId);

        const paymentId = `pay_${randomUUID()}`;
        const payment = new PaymentHistory({
          id: paymentId,
          companyId,
          sourceType: 'PURCHASE_INVOICE',
          sourceId: invoiceId,
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

        invoice.paidAmountBase = roundPurchMoney((invoice.paidAmountBase || 0) + settlementAmountBase);
        invoice.outstandingAmountBase = roundPurchMoney(Math.max(invoice.grandTotalBase - invoice.paidAmountBase, 0));
        recalcPaymentStatus(invoice);
      }

      invoice.updatedAt = new Date();
      await this.purchaseInvoiceRepo.update(invoice, transaction);
    };

    await this.transactionManager.runTransaction(postingLogic);

    const finalInvoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
    if (!finalInvoice) throw new Error('Invoice not found after settlement');

    return { invoice: finalInvoice, payments: createdPayments, voucherIds: createdVoucherIds };
  }
}

export class RecordPurchaseInvoicePaymentUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly paymentHistoryRepo: IPaymentHistoryRepository,
    private readonly purchaseSettingsRepo: IPurchaseSettingsRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly voucherSequenceRepo: IVoucherSequenceRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(
    companyId: string,
    userId: string,
    invoiceId: string,
    input: PostPurchaseInvoiceWithSettlementInput
  ): Promise<{ invoice: PurchaseInvoice; payments: PaymentHistory[]; voucherIds: string[] }> {
    const useCase = new PostPurchaseInvoiceWithSettlementUseCase(
      this.purchaseInvoiceRepo,
      this.paymentHistoryRepo,
      this.purchaseSettingsRepo,
      this.voucherRepo,
      this.voucherSequenceRepo,
      this.ledgerRepo,
      this.companyCurrencyRepo,
      this.transactionManager
    );
    return useCase.execute(companyId, userId, invoiceId, input);
  }
}
