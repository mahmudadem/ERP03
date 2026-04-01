import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { PurchaseInvoice } from '../../../../domain/purchases/entities/PurchaseInvoice';
import {
  IPurchaseInvoiceRepository,
  PurchaseInvoiceListOptions,
} from '../../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { PurchaseInvoiceMapper } from '../../mappers/PurchaseMappers';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

export class FirestorePurchaseInvoiceRepository implements IPurchaseInvoiceRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'purchase_invoices');
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

  async create(invoice: PurchaseInvoice, transaction?: unknown): Promise<void> {
    const ref = this.collection(invoice.companyId).doc(invoice.id);
    const data = PurchaseInvoiceMapper.toPersistence(invoice);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(invoice: PurchaseInvoice, transaction?: unknown): Promise<void> {
    const ref = this.collection(invoice.companyId).doc(invoice.id);
    const data = PurchaseInvoiceMapper.toPersistence(invoice);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PurchaseInvoice | null> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return PurchaseInvoiceMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, invoiceNumber: string): Promise<PurchaseInvoice | null> {
    const snap = await this.collection(companyId).where('invoiceNumber', '==', invoiceNumber).limit(1).get();
    if (snap.empty) return null;
    return PurchaseInvoiceMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: PurchaseInvoiceListOptions): Promise<PurchaseInvoice[]> {
    let query: Query = this.collection(companyId);

    if (opts?.vendorId) query = query.where('vendorId', '==', opts.vendorId);
    if (opts?.purchaseOrderId) query = query.where('purchaseOrderId', '==', opts.purchaseOrderId);
    if (opts?.status) query = query.where('status', '==', opts.status);
    if (opts?.paymentStatus) query = query.where('paymentStatus', '==', opts.paymentStatus);

    query = query.orderBy('invoiceDate', 'desc');
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => PurchaseInvoiceMapper.toDomain(doc.data()));
  }
}
