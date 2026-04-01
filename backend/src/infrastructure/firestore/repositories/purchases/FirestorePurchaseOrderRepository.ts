import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { PurchaseOrder } from '../../../../domain/purchases/entities/PurchaseOrder';
import {
  IPurchaseOrderRepository,
  PurchaseOrderListOptions,
} from '../../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { PurchaseOrderMapper } from '../../mappers/PurchaseMappers';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

export class FirestorePurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'purchase_orders');
  }

  private async resolveRefById(companyId: string, id: string): Promise<DocumentReference | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return doc.ref;
  }

  private applyListOptions(query: Query, opts?: PurchaseOrderListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(po: PurchaseOrder, transaction?: unknown): Promise<void> {
    const ref = this.collection(po.companyId).doc(po.id);
    const data = PurchaseOrderMapper.toPersistence(po);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(po: PurchaseOrder, transaction?: unknown): Promise<void> {
    const ref = this.collection(po.companyId).doc(po.id);
    const data = PurchaseOrderMapper.toPersistence(po);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PurchaseOrder | null> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return PurchaseOrderMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, orderNumber: string): Promise<PurchaseOrder | null> {
    const snap = await this.collection(companyId).where('orderNumber', '==', orderNumber).limit(1).get();
    if (snap.empty) return null;
    return PurchaseOrderMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: PurchaseOrderListOptions): Promise<PurchaseOrder[]> {
    let query: Query = this.collection(companyId);

    if (opts?.status) query = query.where('status', '==', opts.status);
    if (opts?.vendorId) query = query.where('vendorId', '==', opts.vendorId);

    query = query.orderBy('orderDate', 'desc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => PurchaseOrderMapper.toDomain(doc.data()));
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return;
    await ref.delete();
  }
}
