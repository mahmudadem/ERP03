"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateInvoicePaymentStatusUseCase = void 0;
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
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
    async execute(companyId, invoiceId, paymentAmountBase) {
        if (Number.isNaN(paymentAmountBase)) {
            throw new Error('paymentAmountBase must be a valid number');
        }
        const invoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
        if (!invoice)
            throw new Error(`Purchase invoice not found: ${invoiceId}`);
        if (invoice.status !== 'POSTED') {
            throw new Error('Payment status can only be updated for posted purchase invoices');
        }
        invoice.paidAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(invoice.paidAmountBase + paymentAmountBase);
        invoice.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(invoice.grandTotalBase - invoice.paidAmountBase);
        recalcPaymentStatus(invoice);
        invoice.updatedAt = new Date();
        await this.purchaseInvoiceRepo.update(invoice);
        return invoice;
    }
}
exports.UpdateInvoicePaymentStatusUseCase = UpdateInvoicePaymentStatusUseCase;
//# sourceMappingURL=PaymentSyncUseCases.js.map