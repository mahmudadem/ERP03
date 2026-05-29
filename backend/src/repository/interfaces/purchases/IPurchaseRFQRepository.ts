import { PurchaseRFQ } from '../../../domain/purchases/entities/PurchaseRFQ';

export interface PurchaseRFQListOptions {
  status?: string;
  vendorId?: string;
  limit?: number;
  offset?: number;
}

export interface IPurchaseRFQRepository {
  create(rfq: PurchaseRFQ, transaction?: unknown): Promise<void>;
  update(rfq: PurchaseRFQ, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PurchaseRFQ | null>;
  getByNumber(companyId: string, rfqNumber: string): Promise<PurchaseRFQ | null>;
  list(companyId: string, opts?: PurchaseRFQListOptions): Promise<PurchaseRFQ[]>;
  delete(companyId: string, id: string): Promise<void>;
}
