import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { SalesReturn } from '../../../../domain/sales/entities/SalesReturn';
import {
  ISalesReturnRepository,
  SalesReturnListOptions,
} from '../../../../repository/interfaces/sales/ISalesReturnRepository';
import { SalesReturnMapper } from '../../mappers/SalesMappers';
import { getSalesCollection } from './SalesFirestorePaths';

export class FirestoreSalesReturnRepository implements ISalesReturnRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'sales_returns');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(sr: SalesReturn, transaction?: unknown): Promise<void> {
    const ref = this.collection(sr.companyId).doc(sr.id);
    const data = SalesReturnMapper.toPersistence(sr);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(sr: SalesReturn, transaction?: unknown): Promise<void> {
    const ref = this.collection(sr.companyId).doc(sr.id);
    const data = SalesReturnMapper.toPersistence(sr);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<SalesReturn | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return SalesReturnMapper.toDomain(doc.data());
  }

  async list(companyId: string, opts: SalesReturnListOptions = {}): Promise<SalesReturn[]> {
    let query: Query = this.collection(companyId);
    if (opts.customerId) query = query.where('customerId', '==', opts.customerId);
    if (opts.salesInvoiceId) query = query.where('salesInvoiceId', '==', opts.salesInvoiceId);
    if (opts.deliveryNoteId) query = query.where('deliveryNoteId', '==', opts.deliveryNoteId);
    if (opts.status) query = query.where('status', '==', opts.status);

    query = query.orderBy('returnDate', 'desc');
    const snap = await query.get();
    return snap.docs.map((doc) => SalesReturnMapper.toDomain(doc.data()));
  }
}
