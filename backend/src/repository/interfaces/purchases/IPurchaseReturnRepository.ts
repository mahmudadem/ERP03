import {
  PRStatus,
  PurchaseReturn,
} from '../../../domain/purchases/entities/PurchaseReturn';

export interface PurchaseReturnListOptions {
  vendorId?: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  status?: PRStatus;
}

export interface IPurchaseReturnRepository {
  create(purchaseReturn: PurchaseReturn, transaction?: unknown): Promise<void>;
  update(purchaseReturn: PurchaseReturn, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PurchaseReturn | null>;
  list(companyId: string, opts?: PurchaseReturnListOptions): Promise<PurchaseReturn[]>;
}
