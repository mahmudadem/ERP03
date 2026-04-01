import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { PurchaseReturn } from '../../../../domain/purchases/entities/PurchaseReturn';
import {
  IPurchaseReturnRepository,
  PurchaseReturnListOptions,
} from '../../../../repository/interfaces/purchases/IPurchaseReturnRepository';
import { PurchaseReturnMapper } from '../../mappers/PurchaseMappers';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

export class FirestorePurchaseReturnRepository implements IPurchaseReturnRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'purchase_returns');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(purchaseReturn: PurchaseReturn, transaction?: unknown): Promise<void> {
    const ref = this.collection(purchaseReturn.companyId).doc(purchaseReturn.id);
    const data = PurchaseReturnMapper.toPersistence(purchaseReturn);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(purchaseReturn: PurchaseReturn, transaction?: unknown): Promise<void> {
    const ref = this.collection(purchaseReturn.companyId).doc(purchaseReturn.id);
    const data = PurchaseReturnMapper.toPersistence(purchaseReturn);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PurchaseReturn | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PurchaseReturnMapper.toDomain(doc.data());
  }

  async list(companyId: string, opts?: PurchaseReturnListOptions): Promise<PurchaseReturn[]> {
    let query: Query = this.collection(companyId);

    if (opts?.vendorId) query = query.where('vendorId', '==', opts.vendorId);
    if (opts?.purchaseInvoiceId) query = query.where('purchaseInvoiceId', '==', opts.purchaseInvoiceId);
    if (opts?.goodsReceiptId) query = query.where('goodsReceiptId', '==', opts.goodsReceiptId);
    if (opts?.status) query = query.where('status', '==', opts.status);

    query = query.orderBy('returnDate', 'desc');
    const snap = await query.get();
    return snap.docs.map((doc) => PurchaseReturnMapper.toDomain(doc.data()));
  }
}
