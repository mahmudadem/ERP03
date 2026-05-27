import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { Quote, QuoteLine } from '../../../../domain/sales/entities/Quote';
import {
  IQuoteRepository,
  QuoteListOptions,
} from '../../../../repository/interfaces/sales/IQuoteRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface QuoteDoc {
  id: string;
  companyId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  status: string;
  version: number;
  originQuoteId?: string;
  quoteDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: QuoteLine[];
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

class QuoteMapper {
  static toPersistence(quote: Quote): QuoteDoc {
    return {
      id: quote.id,
      companyId: quote.companyId,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customerId,
      customerName: quote.customerName,
      salespersonId: quote.salespersonId,
      status: quote.status,
      version: quote.version,
      originQuoteId: quote.originQuoteId,
      quoteDate: quote.quoteDate,
      validUntil: quote.validUntil,
      currency: quote.currency,
      exchangeRate: quote.exchangeRate,
      lines: quote.lines.map((l) => ({ ...l })),
      subtotalDoc: quote.subtotalDoc,
      taxTotalDoc: quote.taxTotalDoc,
      grandTotalDoc: quote.grandTotalDoc,
      subtotalBase: quote.subtotalBase,
      taxTotalBase: quote.taxTotalBase,
      grandTotalBase: quote.grandTotalBase,
      notes: quote.notes,
      convertedToType: quote.convertedToType,
      convertedToId: quote.convertedToId,
      createdBy: quote.createdBy,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): Quote {
    return Quote.fromJSON({
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    });
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FirestoreQuoteRepository implements IQuoteRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'quotes');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(quote: Quote, transaction?: unknown): Promise<void> {
    const ref = this.collection(quote.companyId).doc(quote.id);
    const data = QuoteMapper.toPersistence(quote);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(quote: Quote, transaction?: unknown): Promise<void> {
    const ref = this.collection(quote.companyId).doc(quote.id);
    const data = QuoteMapper.toPersistence(quote);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<Quote | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return QuoteMapper.toDomain(doc.data());
  }

  async getByNumber(companyId: string, quoteNumber: string): Promise<Quote | null> {
    const snap = await this.collection(companyId)
      .where('quoteNumber', '==', quoteNumber)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return QuoteMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: QuoteListOptions): Promise<Quote[]> {
    let query: Query = this.collection(companyId);

    if (opts?.status) query = query.where('status', '==', opts.status);
    if (opts?.customerId) query = query.where('customerId', '==', opts.customerId);

    query = query.orderBy('quoteDate', 'desc');

    if (opts?.offset) query = query.offset(opts.offset);
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => QuoteMapper.toDomain(doc.data()));
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = this.collection(companyId).doc(id);
    await ref.delete();
  }
}
