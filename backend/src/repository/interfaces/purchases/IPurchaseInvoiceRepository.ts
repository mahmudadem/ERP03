import {
  PaymentStatus,
  PIStatus,
  PurchaseInvoice,
} from '../../../domain/purchases/entities/PurchaseInvoice';

export interface PurchaseInvoiceListOptions {
  vendorId?: string;
  purchaseOrderId?: string;
  status?: PIStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
}

export interface IPurchaseInvoiceRepository {
  create(invoice: PurchaseInvoice, transaction?: unknown): Promise<void>;
  update(invoice: PurchaseInvoice, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PurchaseInvoice | null>;
  getByNumber(companyId: string, invoiceNumber: string): Promise<PurchaseInvoice | null>;
  list(companyId: string, opts?: PurchaseInvoiceListOptions): Promise<PurchaseInvoice[]>;
}
