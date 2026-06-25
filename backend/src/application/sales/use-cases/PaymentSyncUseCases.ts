import { randomUUID } from 'crypto';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { SalesRuleError } from '../../../domain/sales/errors/SalesRuleError';
import { ErrorCategory } from '../../../domain/shared/errors/AppError';
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
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity, roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { postPreBuiltVoucherFullMode } from '../../accounting/services/PreBuiltVoucherFullPoster';
import { IAccountingBridge } from '../../system-core/contracts/IAccountingBridge';
import { VoucherType, VoucherStatus, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { roundMoney as roundSalesMoney } from './SalesPostingHelpers';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';
import { INumberingEngine } from '../../system-core/contracts/INumberingEngine';

export type SettlementMode = 'DEFERRED' | 'CASH_FULL' | 'MULTI';

export interface SettlementRow {
  settlementAccountId?: string;
  amountBase: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  paymentDate?: string;
  /**
   * Exchange rate at the time of payment (doc → base). When provided and
   * different from `invoice.exchangeRate`, a realized FX gain/loss line is
   * appended to the receipt voucher. When absent, behaviour is the legacy path
   * that assumes payment rate == invoice rate.
   */
  exchangeRate?: number;
  /**
   * Settlement amount in invoice currency (doc currency). Required when
   * `exchangeRate` is supplied so we can detect the rate divergence.
   */
  amountDoc?: number;
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
    private readonly accountingBridge: IAccountingBridge,
    private readonly accountRepo?: IAccountRepository,
    private readonly partyRepo?: IPartyRepository,
    private readonly numberingEngine?: INumberingEngine
  ) {}

  private nextVoucherNo(companyId: string, prefix: string): Promise<string> {
    return this.numberingEngine
      ? this.numberingEngine.next({ companyId, docType: prefix, scope: 'company', prefix, counterWidth: 4 })
      : this.voucherSequenceRepo.getNextNumber(companyId, prefix);
  }

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
      throw new SalesRuleError(
        'SETTLEMENT_RULE_VIOLATION',
        `Invalid settlementMode: ${settlementMode}. Must be one of: ${SETTLEMENT_MODES.join(', ')}`,
        { fieldHints: ['settlementMode'], category: ErrorCategory.VALIDATION }
      );
    }

    const invoice = await this.salesInvoiceRepo.getById(companyId, siId);
    if (!invoice) throw new Error(`Sales invoice not found: ${siId}`);
    if (invoice.status !== 'POSTED') {
      throw new SalesRuleError('SETTLEMENT_RULE_VIOLATION', 'Settlement can only be posted for posted sales invoices', {
        fieldHints: ['status'],
        category: ErrorCategory.CONFLICT,
      });
    }

    const baseCurrency = await this.companyCurrencyRepo.getBaseCurrency(companyId);
    if (!baseCurrency) throw new Error('Company base currency is not configured');
    const settings = await this.salesSettingsRepo.getSettings(companyId);
    // Prefer the explicit caller value, then the customer's OWN AR account (the
    // sub-account the invoice posted to), then the settings default. Without the
    // customer fallback, Record-Payment fails whenever settings.defaultARAccountId
    // is unset — even though the customer already has an AR sub-account. Mirrors
    // SalesInvoiceUseCases.resolveARAccount used by post-time settlement.
    const customer = this.partyRepo ? await this.partyRepo.getById(companyId, invoice.customerId) : null;
    const effectiveReceivablePayableAccountId =
      receivablePayableAccountId?.trim() || customer?.defaultARAccountId || settings?.defaultARAccountId;
    if (!effectiveReceivablePayableAccountId) {
      throw new Error('receivablePayableAccountId is required or Sales default AR account must be configured');
    }
    const resolvedReceivablePayableAccountId = await this.resolveAccountId(companyId, effectiveReceivablePayableAccountId);

    // For settlement-vs-outstanding comparison, use the AR-reducing portion (amountDoc × invoiceRate)
    // when the caller supplies amountDoc — this is the book-value being settled, independent of FX.
    // Falls back to amountBase for legacy single-currency callers that don't pass amountDoc.
    const arReducingTotal = settlements.reduce((sum, s) => {
      if (s.amountDoc !== undefined && s.amountDoc > 0) {
        return sum + roundMoney(s.amountDoc * invoice.exchangeRate);
      }
      return sum + roundMoney(s.amountBase);
    }, 0);
    const settlementTotal = settlements.reduce((sum, s) => sum + roundMoney(s.amountBase), 0);

    if (settlementMode === 'CASH_FULL') {
      const outstanding = roundSalesMoney(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
      if (Math.abs(arReducingTotal - outstanding) > 0.01) {
        throw new SalesRuleError(
          'SETTLEMENT_RULE_VIOLATION',
          `CASH_FULL settlement total (${arReducingTotal}) must equal outstanding amount (${outstanding})`,
          { fieldHints: ['settlementTotal'], category: ErrorCategory.VALIDATION }
        );
      }
      if (settlements.length !== 1) {
        throw new SalesRuleError('SETTLEMENT_RULE_VIOLATION', 'CASH_FULL mode requires exactly one settlement row', {
          fieldHints: ['settlements'],
          category: ErrorCategory.VALIDATION,
        });
      }
    }

    if (settlementMode === 'MULTI') {
      const outstanding = roundSalesMoney(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
      const allowOverpayment = settings?.allowOverpayment === true;
      if (!allowOverpayment && arReducingTotal > outstanding + 0.01) {
        throw new SalesRuleError(
          'OVERPAYMENT_NOT_ALLOWED',
          `MULTI settlement total (${arReducingTotal}) exceeds outstanding amount (${outstanding}). Enable "allow over-payment" in Sales settings to record the excess as a customer credit.`,
          { fieldHints: ['settlementTotal'], category: ErrorCategory.VALIDATION }
        );
      }
      if (settlements.length === 0) {
        throw new SalesRuleError('SETTLEMENT_RULE_VIOLATION', 'MULTI mode requires at least one settlement row', {
          fieldHints: ['settlements'],
          category: ErrorCategory.VALIDATION,
        });
      }
      for (const s of settlements) {
        if (s.amountBase <= 0 || Number.isNaN(s.amountBase)) {
          throw new SalesRuleError('SETTLEMENT_RULE_VIOLATION', 'Each settlement row amount must be positive', {
            fieldHints: ['settlements'],
            category: ErrorCategory.VALIDATION,
          });
        }
        if (s.paymentMethod && !VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
          throw new SalesRuleError('SETTLEMENT_RULE_VIOLATION', `Invalid paymentMethod: ${s.paymentMethod}`, {
            fieldHints: ['paymentMethod'],
            category: ErrorCategory.VALIDATION,
          });
        }
        const effectiveSettlementAccountId = s.settlementAccountId?.trim() || resolvePaymentMethodAccount(settings, s.paymentMethod);
        if (!effectiveSettlementAccountId) {
          throw new SalesRuleError(
            'SETTLEMENT_RULE_VIOLATION',
            'Each settlement row requires a settlementAccountId or configured paymentMethod mapping',
            { fieldHints: ['settlementAccountId'], category: ErrorCategory.VALIDATION }
          );
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

        const voucherNo = await this.nextVoucherNo(companyId, 'RV');
        const voucherId = `vch_${randomUUID()}`;

        const baseCurrencyUpper = baseCurrency.toUpperCase();
        const settlementRate =
          settlement.exchangeRate !== undefined && settlement.exchangeRate > 0
            ? settlement.exchangeRate
            : invoice.exchangeRate;
        const docAmount = settlement.amountDoc !== undefined && settlement.amountDoc > 0
          ? roundMoney(settlement.amountDoc)
          : roundMoney(settlementAmountBase / invoice.exchangeRate);
        const arAmountBase = roundMoney(docAmount * invoice.exchangeRate);
        const fxDiffBase = roundMoney(settlementAmountBase - arAmountBase);

        const drLine = new VoucherLineEntity(
          1,
          resolvedSettlementAccountId,
          'Debit',
          settlementAmountBase,
          baseCurrencyUpper,
          docAmount,
          invoice.currency,
          settlementRate,
          `Receipt for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
        );
        const crLine = new VoucherLineEntity(
          2,
          resolvedReceivablePayableAccountId,
          'Credit',
          arAmountBase,
          baseCurrencyUpper,
          docAmount,
          invoice.currency,
          invoice.exchangeRate,
          `Receipt for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
        );

        const voucherLines: VoucherLineEntity[] = [drLine, crLine];
        let totalDebit = roundMoney(drLine.debitAmount);
        let totalCredit = roundMoney(crLine.creditAmount);

        if (Math.abs(fxDiffBase) > 0.005) {
          const fxAccountId = settings?.exchangeGainLossAccountId;
          if (!fxAccountId) {
            throw new AccountMappingError({
              companyId,
              accountRole: fxDiffBase > 0 ? 'fxGain' : 'fxLoss',
              fallbackChain: ['salesSettings.exchangeGainLossAccountId'],
              hint:
                'Realized FX gain/loss on a multi-currency receipt requires SalesSettings.exchangeGainLossAccountId to be configured.',
            });
          }
          const resolvedFxAccountId = await this.resolveAccountId(companyId, fxAccountId);
          if (fxDiffBase > 0) {
            const fxGainLine = new VoucherLineEntity(
              3,
              resolvedFxAccountId,
              'Credit',
              fxDiffBase,
              baseCurrencyUpper,
              fxDiffBase,
              baseCurrencyUpper,
              1,
              `Realized FX gain on ${invoice.invoiceNumber}`
            );
            voucherLines.push(fxGainLine);
            totalCredit = roundMoney(totalCredit + fxDiffBase);
          } else {
            const fxLossLine = new VoucherLineEntity(
              3,
              resolvedFxAccountId,
              'Debit',
              -fxDiffBase,
              baseCurrencyUpper,
              -fxDiffBase,
              baseCurrencyUpper,
              1,
              `Realized FX loss on ${invoice.invoiceNumber}`
            );
            voucherLines.push(fxLossLine);
            totalDebit = roundMoney(totalDebit + -fxDiffBase);
          }
        }

        const approvedVoucher = new VoucherEntity(
          voucherId,
          companyId,
          voucherNo,
          VoucherType.RECEIPT,
          settlementDate,
          `Receipt for Sales Invoice ${invoice.invoiceNumber}`,
          invoice.currency.toUpperCase(),
          baseCurrencyUpper,
          settlementRate,
          voucherLines,
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

        if (this.accountRepo) {
          await this.voucherValidationService.validateAccounts(postedVoucher, this.accountRepo);
        }

        const postFull = async () => {
          await postPreBuiltVoucherFullMode({
            voucher: postedVoucher,
            ledgerRepo: this.ledgerRepo,
            voucherRepo: this.voucherRepo,
            voucherValidationService: this.voucherValidationService,
            userId,
            exemptionReason: 'system-generated settlement receipt during payment sync (Stage 4b)',
            transaction,
          });
        };

        const result = await this.accountingBridge.recordPreBuiltVoucher({
          companyId,
          kind: 'SALES_RECEIPT',
          voucher: postedVoucher,
          postFull,
          transaction,
        });
        const settlementPosted = result.mode === 'full';
        if (settlementPosted) createdVoucherIds.push(voucherId);

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
          voucherId: settlementPosted ? voucherId : null,
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
    private readonly accountingBridge: IAccountingBridge,
    private readonly accountRepo?: IAccountRepository,
    private readonly partyRepo?: IPartyRepository,
    private readonly numberingEngine?: INumberingEngine
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
      this.accountingBridge,
      this.accountRepo,
      this.partyRepo,
      this.numberingEngine
    );
    return useCase.execute(companyId, userId, siId, input);
  }
}
