import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { DeliveryNote } from '../../../../domain/sales/entities/DeliveryNote';
import {
  DeliveryNoteListOptions,
  IDeliveryNoteRepository,
} from '../../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { DeliveryNoteMapper } from '../../mappers/SalesMappers';
import { getSalesCollection } from './SalesFirestorePaths';

export class FirestoreDeliveryNoteRepository implements IDeliveryNoteRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'delivery_notes');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(dn: DeliveryNote, transaction?: unknown): Promise<void> {
    const ref = this.collection(dn.companyId).doc(dn.id);
    const data = DeliveryNoteMapper.toPersistence(dn);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(dn: DeliveryNote, transaction?: unknown): Promise<void> {
    const ref = this.collection(dn.companyId).doc(dn.id);
    const data = DeliveryNoteMapper.toPersistence(dn);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<DeliveryNote | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return DeliveryNoteMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, dnNumber: string): Promise<DeliveryNote | null> {
    const snap = await this.collection(companyId).where('dnNumber', '==', dnNumber).limit(1).get();
    if (snap.empty) return null;
    return DeliveryNoteMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts: DeliveryNoteListOptions = {}): Promise<DeliveryNote[]> {
    let query: Query = this.collection(companyId);
    if (opts.salesOrderId) query = query.where('salesOrderId', '==', opts.salesOrderId);
    if (opts.status) query = query.where('status', '==', opts.status);
    query = query.orderBy('deliveryDate', 'desc');
    if (opts.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => DeliveryNoteMapper.toDomain(doc.data()));
  }
}
