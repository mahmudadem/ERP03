import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { GoodsReceipt } from '../../../../domain/purchases/entities/GoodsReceipt';
import {
  GoodsReceiptListOptions,
  IGoodsReceiptRepository,
} from '../../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { GoodsReceiptMapper } from '../../mappers/PurchaseMappers';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

export class FirestoreGoodsReceiptRepository implements IGoodsReceiptRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'goods_receipts');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  private async resolveRefById(companyId: string, id: string): Promise<DocumentReference | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return doc.ref;
  }

  async create(grn: GoodsReceipt, transaction?: unknown): Promise<void> {
    const ref = this.collection(grn.companyId).doc(grn.id);
    const data = GoodsReceiptMapper.toPersistence(grn);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(grn: GoodsReceipt, transaction?: unknown): Promise<void> {
    const ref = this.collection(grn.companyId).doc(grn.id);
    const data = GoodsReceiptMapper.toPersistence(grn);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<GoodsReceipt | null> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return GoodsReceiptMapper.toDomain(doc.data());
  }

  async list(companyId: string, opts?: GoodsReceiptListOptions): Promise<GoodsReceipt[]> {
    let query: Query = this.collection(companyId);

    if (opts?.purchaseOrderId) query = query.where('purchaseOrderId', '==', opts.purchaseOrderId);
    if (opts?.status) query = query.where('status', '==', opts.status);

    query = query.orderBy('receiptDate', 'desc');
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => GoodsReceiptMapper.toDomain(doc.data()));
  }
}
