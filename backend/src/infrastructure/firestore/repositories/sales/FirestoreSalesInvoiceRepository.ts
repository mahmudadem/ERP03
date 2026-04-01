import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { SalesInvoice } from '../../../../domain/sales/entities/SalesInvoice';
import {
  ISalesInvoiceRepository,
  SalesInvoiceListOptions,
} from '../../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { SalesInvoiceMapper } from '../../mappers/SalesMappers';
import { getSalesCollection } from './SalesFirestorePaths';

export class FirestoreSalesInvoiceRepository implements ISalesInvoiceRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'sales_invoices');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(si: SalesInvoice, transaction?: unknown): Promise<void> {
    const ref = this.collection(si.companyId).doc(si.id);
    const data = SalesInvoiceMapper.toPersistence(si);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(si: SalesInvoice, transaction?: unknown): Promise<void> {
    const ref = this.collection(si.companyId).doc(si.id);
    const data = SalesInvoiceMapper.toPersistence(si);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<SalesInvoice | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return SalesInvoiceMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, number: string): Promise<SalesInvoice | null> {
    const snap = await this.collection(companyId).where('invoiceNumber', '==', number).limit(1).get();
    if (snap.empty) return null;
    return SalesInvoiceMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts: SalesInvoiceListOptions = {}): Promise<SalesInvoice[]> {
    let query: Query = this.collection(companyId);
    if (opts.customerId) query = query.where('customerId', '==', opts.customerId);
    if (opts.salesOrderId) query = query.where('salesOrderId', '==', opts.salesOrderId);
    if (opts.status) query = query.where('status', '==', opts.status);
    if (opts.paymentStatus) query = query.where('paymentStatus', '==', opts.paymentStatus);

    query = query.orderBy('invoiceDate', 'desc');
    if (opts.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => SalesInvoiceMapper.toDomain(doc.data()));
  }
}
