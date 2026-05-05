"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordPurchaseInvoicePaymentUseCase = exports.PostPurchaseInvoiceWithSettlementUseCase = exports.UpdateInvoicePaymentStatusUseCase = void 0;
const crypto_1 = require("crypto");
const PaymentHistory_1 = require("../../../domain/shared/entities/PaymentHistory");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
const SETTLEMENT_MODES = ['DEFERRED', 'CASH_FULL', 'MULTI'];
const VALID_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const recalcPaymentStatus = (invoice) => {
    if (invoice.outstandingAmountBase <= 0) {
        invoice.paymentStatus = 'PAID';
    }
    else if (invoice.paidAmountBase > 0) {
        invoice.paymentStatus = 'PARTIALLY_PAID';
    }
    else {
        invoice.paymentStatus = 'UNPAID';
    }
};
class UpdateInvoicePaymentStatusUseCase {
    constructor(purchaseInvoiceRepo) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
    }
    async execute(companyId, invoiceId, paidAmountBase) {
        if (Number.isNaN(paidAmountBase)) {
            throw new Error('paidAmountBase must be a valid number');
        }
        const invoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
        if (!invoice)
            throw new Error(`Purchase invoice not found: ${invoiceId}`);
        if (invoice.status !== 'POSTED') {
            throw new Error('Payment status can only be updated for posted purchase invoices');
        }
        invoice.paidAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(paidAmountBase);
        invoice.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(invoice.grandTotalBase - invoice.paidAmountBase);
        recalcPaymentStatus(invoice);
        invoice.updatedAt = new Date();
        await this.purchaseInvoiceRepo.update(invoice);
        return invoice;
    }
}
exports.UpdateInvoicePaymentStatusUseCase = UpdateInvoicePaymentStatusUseCase;
class PostPurchaseInvoiceWithSettlementUseCase {
    constructor(purchaseInvoiceRepo, paymentHistoryRepo, purchaseSettingsRepo, voucherRepo, voucherSequenceRepo, ledgerRepo, companyCurrencyRepo, transactionManager) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.paymentHistoryRepo = paymentHistoryRepo;
        this.purchaseSettingsRepo = purchaseSettingsRepo;
        this.voucherRepo = voucherRepo;
        this.voucherSequenceRepo = voucherSequenceRepo;
        this.ledgerRepo = ledgerRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, userId, invoiceId, input) {
        var _a;
        const { settlementMode, receivablePayableAccountId, settlements } = input;
        if (!SETTLEMENT_MODES.includes(settlementMode)) {
            throw new Error(`Invalid settlementMode: ${settlementMode}. Must be one of: ${SETTLEMENT_MODES.join(', ')}`);
        }
        if (!(receivablePayableAccountId === null || receivablePayableAccountId === void 0 ? void 0 : receivablePayableAccountId.trim())) {
            throw new Error('receivablePayableAccountId is required');
        }
        const invoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
        if (!invoice)
            throw new Error(`Purchase invoice not found: ${invoiceId}`);
        if (invoice.status !== 'POSTED') {
            throw new Error('Settlement can only be posted for posted purchase invoices');
        }
        const baseCurrency = await this.companyCurrencyRepo.getBaseCurrency(companyId);
        if (!baseCurrency)
            throw new Error('Company base currency is not configured');
        const settlementTotal = settlements.reduce((sum, s) => sum + (0, VoucherLineEntity_1.roundMoney)(s.amountBase), 0);
        if (settlementMode === 'CASH_FULL') {
            const outstanding = (0, PurchasePostingHelpers_1.roundMoney)(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
            if (Math.abs(settlementTotal - outstanding) > 0.01) {
                throw new Error(`CASH_FULL settlement total (${settlementTotal}) must equal outstanding amount (${outstanding})`);
            }
            if (settlements.length !== 1) {
                throw new Error('CASH_FULL mode requires exactly one settlement row');
            }
        }
        if (settlementMode === 'MULTI') {
            const outstanding = (0, PurchasePostingHelpers_1.roundMoney)(invoice.grandTotalBase - (invoice.paidAmountBase || 0));
            if (settlementTotal > outstanding + 0.01) {
                throw new Error(`MULTI settlement total (${settlementTotal}) exceeds outstanding amount (${outstanding})`);
            }
            if (settlements.length === 0) {
                throw new Error('MULTI mode requires at least one settlement row');
            }
            for (const s of settlements) {
                if (!((_a = s.settlementAccountId) === null || _a === void 0 ? void 0 : _a.trim())) {
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
        const createdVoucherIds = [];
        const createdPayments = [];
        const postingLogic = async (transaction) => {
            const now = new Date();
            if (settlementMode === 'DEFERRED') {
                return;
            }
            for (const settlement of settlements) {
                const settlementAmountBase = (0, VoucherLineEntity_1.roundMoney)(settlement.amountBase);
                const settlementDate = settlement.paymentDate || now.toISOString().split('T')[0];
                const settlementMethod = settlement.paymentMethod || 'CASH';
                const voucherNo = await this.voucherSequenceRepo.getNextNumber(companyId, 'PV');
                const voucherId = `vch_${(0, crypto_1.randomUUID)()}`;
                const docAmount = (0, VoucherLineEntity_1.roundMoney)(settlementAmountBase / invoice.exchangeRate);
                const baseCurrencyUpper = baseCurrency.toUpperCase();
                const drLine = new VoucherLineEntity_1.VoucherLineEntity(1, receivablePayableAccountId, 'Debit', settlementAmountBase, baseCurrencyUpper, docAmount, invoice.currency, invoice.exchangeRate, `Payment for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`);
                const crLine = new VoucherLineEntity_1.VoucherLineEntity(2, settlement.settlementAccountId, 'Credit', settlementAmountBase, baseCurrencyUpper, docAmount, invoice.currency, invoice.exchangeRate, `Payment for ${invoice.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`);
                const totalDebit = (0, VoucherLineEntity_1.roundMoney)(drLine.debitAmount);
                const totalCredit = (0, VoucherLineEntity_1.roundMoney)(crLine.creditAmount);
                const approvedVoucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, voucherNo, VoucherTypes_1.VoucherType.PAYMENT, settlementDate, `Payment for Purchase Invoice ${invoice.invoiceNumber}`, invoice.currency.toUpperCase(), baseCurrencyUpper, invoice.exchangeRate, [drLine, crLine], totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, { sourceModule: 'purchases', sourceInvoiceId: invoiceId, settlementMode }, userId, now, userId, now, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, settlement.reference || null);
                const postedVoucher = approvedVoucher.post(userId, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
                await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
                await this.voucherRepo.save(postedVoucher, transaction);
                createdVoucherIds.push(voucherId);
                const paymentId = `pay_${(0, crypto_1.randomUUID)()}`;
                const payment = new PaymentHistory_1.PaymentHistory({
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
                invoice.paidAmountBase = (0, PurchasePostingHelpers_1.roundMoney)((invoice.paidAmountBase || 0) + settlementAmountBase);
                invoice.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(Math.max(invoice.grandTotalBase - invoice.paidAmountBase, 0));
                recalcPaymentStatus(invoice);
            }
            invoice.updatedAt = new Date();
            await this.purchaseInvoiceRepo.update(invoice, transaction);
        };
        await this.transactionManager.runTransaction(postingLogic);
        const finalInvoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
        if (!finalInvoice)
            throw new Error('Invoice not found after settlement');
        return { invoice: finalInvoice, payments: createdPayments, voucherIds: createdVoucherIds };
    }
}
exports.PostPurchaseInvoiceWithSettlementUseCase = PostPurchaseInvoiceWithSettlementUseCase;
class RecordPurchaseInvoicePaymentUseCase {
    constructor(purchaseInvoiceRepo, paymentHistoryRepo, purchaseSettingsRepo, voucherRepo, voucherSequenceRepo, ledgerRepo, companyCurrencyRepo, transactionManager) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.paymentHistoryRepo = paymentHistoryRepo;
        this.purchaseSettingsRepo = purchaseSettingsRepo;
        this.voucherRepo = voucherRepo;
        this.voucherSequenceRepo = voucherSequenceRepo;
        this.ledgerRepo = ledgerRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, userId, invoiceId, input) {
        const useCase = new PostPurchaseInvoiceWithSettlementUseCase(this.purchaseInvoiceRepo, this.paymentHistoryRepo, this.purchaseSettingsRepo, this.voucherRepo, this.voucherSequenceRepo, this.ledgerRepo, this.companyCurrencyRepo, this.transactionManager);
        return useCase.execute(companyId, userId, invoiceId, input);
    }
}
exports.RecordPurchaseInvoicePaymentUseCase = RecordPurchaseInvoicePaymentUseCase;
//# sourceMappingURL=PaymentSyncUseCases.js.map