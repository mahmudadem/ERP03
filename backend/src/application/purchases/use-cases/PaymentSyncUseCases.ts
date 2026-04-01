import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { roundMoney } from './PurchasePostingHelpers';

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

  async execute(companyId: string, invoiceId: string, paymentAmountBase: number): Promise<PurchaseInvoice> {
    if (Number.isNaN(paymentAmountBase)) {
      throw new Error('paymentAmountBase must be a valid number');
    }

    const invoice = await this.purchaseInvoiceRepo.getById(companyId, invoiceId);
    if (!invoice) throw new Error(`Purchase invoice not found: ${invoiceId}`);
    if (invoice.status !== 'POSTED') {
      throw new Error('Payment status can only be updated for posted purchase invoices');
    }

    invoice.paidAmountBase = roundMoney(invoice.paidAmountBase + paymentAmountBase);
    invoice.outstandingAmountBase = roundMoney(invoice.grandTotalBase - invoice.paidAmountBase);
    recalcPaymentStatus(invoice);
    invoice.updatedAt = new Date();

    await this.purchaseInvoiceRepo.update(invoice);
    return invoice;
  }
}
