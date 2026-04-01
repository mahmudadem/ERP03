import { GRNStatus, GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';

export interface GoodsReceiptListOptions {
  purchaseOrderId?: string;
  status?: GRNStatus;
  limit?: number;
}

export interface IGoodsReceiptRepository {
  create(grn: GoodsReceipt, transaction?: unknown): Promise<void>;
  update(grn: GoodsReceipt, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<GoodsReceipt | null>;
  list(companyId: string, opts?: GoodsReceiptListOptions): Promise<GoodsReceipt[]>;
}
