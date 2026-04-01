import { POStatus, PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';

export interface PurchaseOrderListOptions {
  status?: POStatus;
  vendorId?: string;
  limit?: number;
  offset?: number;
}

export interface IPurchaseOrderRepository {
  create(po: PurchaseOrder, transaction?: unknown): Promise<void>;
  update(po: PurchaseOrder, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PurchaseOrder | null>;
  getByNumber(companyId: string, orderNumber: string): Promise<PurchaseOrder | null>;
  list(companyId: string, opts?: PurchaseOrderListOptions): Promise<PurchaseOrder[]>;
  delete(companyId: string, id: string): Promise<void>;
}
