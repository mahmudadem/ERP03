import { SRStatus, SalesReturn } from '../../../domain/sales/entities/SalesReturn';

export interface SalesReturnListOptions {
  customerId?: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  status?: SRStatus;
}

export interface ISalesReturnRepository {
  create(sr: SalesReturn, transaction?: unknown): Promise<void>;
  update(sr: SalesReturn, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<SalesReturn | null>;
  list(companyId: string, opts?: SalesReturnListOptions): Promise<SalesReturn[]>;
}
