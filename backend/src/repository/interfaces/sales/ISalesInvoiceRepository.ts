import { PaymentStatus, SIStatus, SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

export interface SalesInvoiceListOptions {
  customerId?: string;
  salesOrderId?: string;
  status?: SIStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
}

export interface ISalesInvoiceRepository {
  create(si: SalesInvoice, transaction?: unknown): Promise<void>;
  update(si: SalesInvoice, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<SalesInvoice | null>;
  getByNumber(companyId: string, number: string): Promise<SalesInvoice | null>;
  list(companyId: string, opts?: SalesInvoiceListOptions): Promise<SalesInvoice[]>;
}
