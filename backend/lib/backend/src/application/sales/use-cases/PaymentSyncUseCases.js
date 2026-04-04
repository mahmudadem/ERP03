"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesInvoicePaymentStatusUseCase = void 0;
const SalesPostingHelpers_1 = require("./SalesPostingHelpers");
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
class UpdateSalesInvoicePaymentStatusUseCase {
    constructor(salesInvoiceRepo) {
        this.salesInvoiceRepo = salesInvoiceRepo;
    }
    async execute(companyId, siId, paidAmountBase) {
        if (Number.isNaN(paidAmountBase)) {
            throw new Error('paidAmountBase must be a valid number');
        }
        const invoice = await this.salesInvoiceRepo.getById(companyId, siId);
        if (!invoice)
            throw new Error(`Sales invoice not found: ${siId}`);
        if (invoice.status !== 'POSTED') {
            throw new Error('Payment status can only be updated for posted sales invoices');
        }
        invoice.paidAmountBase = (0, SalesPostingHelpers_1.roundMoney)(paidAmountBase);
        invoice.outstandingAmountBase = (0, SalesPostingHelpers_1.roundMoney)(invoice.grandTotalBase - invoice.paidAmountBase);
        recalcPaymentStatus(invoice);
        invoice.updatedAt = new Date();
        await this.salesInvoiceRepo.update(invoice);
        return invoice;
    }
}
exports.UpdateSalesInvoicePaymentStatusUseCase = UpdateSalesInvoicePaymentStatusUseCase;
//# sourceMappingURL=PaymentSyncUseCases.js.map