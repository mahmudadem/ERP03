import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { SalesOrder } from '../../../../domain/sales/entities/SalesOrder';
import {
  ISalesOrderRepository,
  SalesOrderListOptions,
} from '../../../../repository/interfaces/sales/ISalesOrderRepository';
import { SalesOrderMapper } from '../../mappers/SalesMappers';
import { getSalesCollection } from './SalesFirestorePaths';

export class FirestoreSalesOrderRepository implements ISalesOrderRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'sales_orders');
  }

  private async resolveRefById(companyId: string, id: string): Promise<DocumentReference | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return doc.ref;
  }

  private applyListOptions(query: Query, opts?: SalesOrderListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(so: SalesOrder, transaction?: unknown): Promise<void> {
    const ref = this.collection(so.companyId).doc(so.id);
    const data = SalesOrderMapper.toPersistence(so);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(so: SalesOrder, transaction?: unknown): Promise<void> {
    const ref = this.collection(so.companyId).doc(so.id);
    const data = SalesOrderMapper.toPersistence(so);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<SalesOrder | null> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return SalesOrderMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, orderNumber: string): Promise<SalesOrder | null> {
    const snap = await this.collection(companyId).where('orderNumber', '==', orderNumber).limit(1).get();
    if (snap.empty) return null;
    return SalesOrderMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: SalesOrderListOptions): Promise<SalesOrder[]> {
    let query: Query = this.collection(companyId);

    if (opts?.status) query = query.where('status', '==', opts.status);
    if (opts?.customerId) query = query.where('customerId', '==', opts.customerId);

    query = query.orderBy('orderDate', 'desc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => SalesOrderMapper.toDomain(doc.data()));
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return;
    await ref.delete();
  }
}
