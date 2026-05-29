import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { PurchaseRFQ, PurchaseRFQLine } from '../../../../domain/purchases/entities/PurchaseRFQ';
import {
  IPurchaseRFQRepository,
  PurchaseRFQListOptions,
} from '../../../../repository/interfaces/purchases/IPurchaseRFQRepository';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

interface PurchaseRFQDoc {
  id: string;
  companyId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  version: number;
  originRfqId?: string;
  rfqDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseRFQLine[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  notes?: string;
  convertedToType?: string;
  convertedToId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class PurchaseRFQMapper {
  static toPersistence(rfq: PurchaseRFQ): PurchaseRFQDoc {
    return {
      id: rfq.id,
      companyId: rfq.companyId,
      rfqNumber: rfq.rfqNumber,
      vendorId: rfq.vendorId,
      vendorName: rfq.vendorName,
      status: rfq.status,
      version: rfq.version,
      originRfqId: rfq.originRfqId,
      rfqDate: rfq.rfqDate,
      validUntil: rfq.validUntil,
      currency: rfq.currency,
      exchangeRate: rfq.exchangeRate,
      lines: rfq.lines.map((l) => ({ ...l })),
      subtotalDoc: rfq.subtotalDoc,
      taxTotalDoc: rfq.taxTotalDoc,
      grandTotalDoc: rfq.grandTotalDoc,
      subtotalBase: rfq.subtotalBase,
      taxTotalBase: rfq.taxTotalBase,
      grandTotalBase: rfq.grandTotalBase,
      notes: rfq.notes,
      convertedToType: rfq.convertedToType,
      convertedToId: rfq.convertedToId,
      createdBy: rfq.createdBy,
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): PurchaseRFQ {
    return PurchaseRFQ.fromJSON({
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    });
  }
}

export class FirestorePurchaseRFQRepository implements IPurchaseRFQRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'rfqs');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(rfq: PurchaseRFQ, transaction?: unknown): Promise<void> {
    const ref = this.collection(rfq.companyId).doc(rfq.id);
    const data = PurchaseRFQMapper.toPersistence(rfq);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(rfq: PurchaseRFQ, transaction?: unknown): Promise<void> {
    const ref = this.collection(rfq.companyId).doc(rfq.id);
    const data = PurchaseRFQMapper.toPersistence(rfq);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PurchaseRFQ | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PurchaseRFQMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, rfqNumber: string): Promise<PurchaseRFQ | null> {
    const snap = await this.collection(companyId)
      .where('rfqNumber', '==', rfqNumber)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PurchaseRFQMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: PurchaseRFQListOptions): Promise<PurchaseRFQ[]> {
    let query: Query = this.collection(companyId);

    if (opts?.status) query = query.where('status', '==', opts.status);
    if (opts?.vendorId) query = query.where('vendorId', '==', opts.vendorId);

    query = query.orderBy('rfqDate', 'desc');

    if (opts?.offset) query = query.offset(opts.offset);
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => PurchaseRFQMapper.toDomain(doc.data()));
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = this.collection(companyId).doc(id);
    await ref.delete();
  }
}
