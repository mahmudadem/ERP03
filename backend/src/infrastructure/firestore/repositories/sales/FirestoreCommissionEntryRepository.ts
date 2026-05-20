import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { CommissionEntry } from '../../../../domain/sales/entities/CommissionEntry';
import {
  ICommissionEntryRepository,
  CommissionEntryListOptions,
} from '../../../../repository/interfaces/sales/ICommissionEntryRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching the shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface CommissionEntryDoc {
  id: string;
  companyId: string;
  salespersonId: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  baseAmount: number;
  commissionPct: number;
  commissionAmountBase: number;
  currency: string;
  status: string;
  accruedAt: string;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class CommissionEntryMapper {
  static toPersistence(entry: CommissionEntry): CommissionEntryDoc {
    return {
      id: entry.id,
      companyId: entry.companyId,
      salespersonId: entry.salespersonId,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      sourceNumber: entry.sourceNumber,
      customerId: entry.customerId,
      customerName: entry.customerName,
      invoiceDate: entry.invoiceDate,
      baseAmount: entry.baseAmount,
      commissionPct: entry.commissionPct,
      commissionAmountBase: entry.commissionAmountBase,
      currency: entry.currency,
      status: entry.status,
      accruedAt: entry.accruedAt.toISOString(),
      paidAt: entry.paidAt ? entry.paidAt.toISOString() : null,
      paymentReference: entry.paymentReference ?? null,
      notes: entry.notes ?? null,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): CommissionEntry {
    return new CommissionEntry({
      id: data.id,
      companyId: data.companyId,
      salespersonId: data.salespersonId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      sourceNumber: data.sourceNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      invoiceDate: data.invoiceDate,
      baseAmount: data.baseAmount,
      commissionPct: data.commissionPct,
      currency: data.currency,
      status: data.status,
      accruedAt: new Date(data.accruedAt),
      paidAt: data.paidAt != null ? new Date(data.paidAt) : undefined,
      paymentReference: data.paymentReference != null ? data.paymentReference : undefined,
      notes: data.notes != null ? data.notes : undefined,
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FirestoreCommissionEntryRepository implements ICommissionEntryRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'commission_entries');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(entry: CommissionEntry, transaction?: unknown): Promise<void> {
    const ref = this.collection(entry.companyId).doc(entry.id);
    const data = CommissionEntryMapper.toPersistence(entry);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(entry: CommissionEntry, transaction?: unknown): Promise<void> {
    const ref = this.collection(entry.companyId).doc(entry.id);
    const data = CommissionEntryMapper.toPersistence(entry);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<CommissionEntry | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return CommissionEntryMapper.toDomain(doc.data());
  }

  async list(
    companyId: string,
    opts?: CommissionEntryListOptions
  ): Promise<CommissionEntry[]> {
    let query: Query = this.collection(companyId);

    if (opts?.salespersonId) {
      query = query.where('salespersonId', '==', opts.salespersonId);
    }
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    }
    if (opts?.sourceId) {
      query = query.where('sourceId', '==', opts.sourceId);
    }
    if (opts?.fromDate) {
      query = query.where('invoiceDate', '>=', opts.fromDate);
    }
    if (opts?.toDate) {
      query = query.where('invoiceDate', '<=', opts.toDate);
    }

    query = query.orderBy('invoiceDate', 'desc');

    if (opts?.offset) query = query.offset(opts.offset);
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => CommissionEntryMapper.toDomain(doc.data()));
  }

  async findBySource(
    companyId: string,
    sourceType: string,
    sourceId: string
  ): Promise<CommissionEntry | null> {
    const snap = await this.collection(companyId)
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return CommissionEntryMapper.toDomain(snap.docs[0].data());
  }

  async totalsBySalesperson(
    companyId: string,
    salespersonId: string
  ): Promise<{ accrued: number; paid: number; cancelled: number }> {
    // At pre-alpha scale, querying all entries for a salesperson and summing in
    // memory is acceptable. A Firestore aggregate query or counter could be added
    // once data volumes warrant it.
    const snap = await this.collection(companyId)
      .where('salespersonId', '==', salespersonId)
      .get();

    let accrued = 0;
    let paid = 0;
    let cancelled = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const amount: number = data.commissionAmountBase ?? 0;
      if (data.status === 'ACCRUED') accrued += amount;
      else if (data.status === 'PAID') paid += amount;
      else if (data.status === 'CANCELLED') cancelled += amount;
    }

    return {
      accrued: Math.round((accrued + Number.EPSILON) * 100) / 100,
      paid: Math.round((paid + Number.EPSILON) * 100) / 100,
      cancelled: Math.round((cancelled + Number.EPSILON) * 100) / 100,
    };
  }
}
