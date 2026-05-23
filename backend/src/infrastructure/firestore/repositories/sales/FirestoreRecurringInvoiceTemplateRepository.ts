import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { RecurringInvoiceTemplate, RecurringInvoiceLine } from '../../../../domain/sales/entities/RecurringInvoiceTemplate';
import {
  IRecurringInvoiceTemplateRepository,
  RecurringInvoiceTemplateListOptions,
} from '../../../../repository/interfaces/sales/IRecurringInvoiceTemplateRepository';
import { getSalesCollection } from './SalesFirestorePaths';
import { InfrastructureError } from '../../../errors/InfrastructureError';

interface RecurringInvoiceTemplateDoc {
  companyId: string;
  name: string;
  sourceInvoiceId?: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate: number;
  lines: RecurringInvoiceLine[];
  notes?: string;
  paymentTermsDays: number;
  frequency: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  nextGenerationDate: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

class RecurringInvoiceTemplateMapper {
  static toPersistence(template: RecurringInvoiceTemplate): RecurringInvoiceTemplateDoc {
    return {
      companyId: template.companyId,
      name: template.name,
      sourceInvoiceId: template.sourceInvoiceId,
      customerId: template.customerId,
      customerName: template.customerName,
      currency: template.currency,
      exchangeRate: template.exchangeRate,
      lines: template.lines.map((l) => ({ ...l })),
      notes: template.notes,
      paymentTermsDays: template.paymentTermsDays,
      frequency: template.frequency,
      dayOfMonth: template.dayOfMonth,
      dayOfWeek: template.dayOfWeek,
      startDate: template.startDate,
      endDate: template.endDate,
      maxOccurrences: template.maxOccurrences,
      occurrencesGenerated: template.occurrencesGenerated,
      nextGenerationDate: template.nextGenerationDate,
      status: template.status,
      createdBy: template.createdBy,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt?.toISOString(),
      updatedBy: template.updatedBy,
    };
  }

  static toDomain(id: string, data: any): RecurringInvoiceTemplate {
    return RecurringInvoiceTemplate.fromJSON({
      id,
      companyId: data.companyId,
      name: data.name,
      sourceInvoiceId: data.sourceInvoiceId,
      customerId: data.customerId,
      customerName: data.customerName,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      notes: data.notes,
      paymentTermsDays: data.paymentTermsDays ?? 0,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      dayOfWeek: data.dayOfWeek,
      startDate: data.startDate,
      endDate: data.endDate,
      maxOccurrences: data.maxOccurrences,
      occurrencesGenerated: data.occurrencesGenerated ?? 0,
      nextGenerationDate: data.nextGenerationDate,
      status: data.status || 'ACTIVE',
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      updatedBy: data.updatedBy,
    });
  }
}

export class FirestoreRecurringInvoiceTemplateRepository implements IRecurringInvoiceTemplateRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'recurring_invoice_templates');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(template: RecurringInvoiceTemplate, transaction?: unknown): Promise<void> {
    try {
      const ref = this.collection(template.companyId).doc(template.id);
      const data = RecurringInvoiceTemplateMapper.toPersistence(template);
      const txn = this.asTransaction(transaction);
      if (txn) {
        txn.set(ref, data);
        return;
      }
      await ref.set(data);
    } catch (error) {
      throw new InfrastructureError('Failed to create recurring invoice template', error);
    }
  }

  async update(template: RecurringInvoiceTemplate, transaction?: unknown): Promise<void> {
    try {
      const ref = this.collection(template.companyId).doc(template.id);
      const data = RecurringInvoiceTemplateMapper.toPersistence(template);
      const txn = this.asTransaction(transaction);
      if (txn) {
        txn.set(ref, data, { merge: true });
        return;
      }
      await ref.set(data, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to update recurring invoice template', error);
    }
  }

  async findById(companyId: string, id: string): Promise<RecurringInvoiceTemplate | null> {
    try {
      const doc = await this.collection(companyId).doc(id).get();
      if (!doc.exists) return null;
      return RecurringInvoiceTemplateMapper.toDomain(doc.id, doc.data() as any);
    } catch (error) {
      throw new InfrastructureError('Failed to find recurring invoice template', error);
    }
  }

  async list(companyId: string, opts?: RecurringInvoiceTemplateListOptions): Promise<RecurringInvoiceTemplate[]> {
    try {
      let query: Query = this.collection(companyId);

      if (opts?.status) query = query.where('status', '==', opts.status);
      if (opts?.customerId) query = query.where('customerId', '==', opts.customerId);

      query = query.orderBy('createdAt', 'desc');

      if (opts?.offset) query = query.offset(opts.offset);
      if (opts?.limit) query = query.limit(opts.limit);

      const snap = await query.get();
      return snap.docs.map((doc) => RecurringInvoiceTemplateMapper.toDomain(doc.id, doc.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list recurring invoice templates', error);
    }
  }

  async listDue(companyId: string, asOfDate: string): Promise<RecurringInvoiceTemplate[]> {
    try {
      const snap = await this.collection(companyId)
        .where('status', '==', 'ACTIVE')
        .where('nextGenerationDate', '<=', asOfDate)
        .get();
      return snap.docs.map((doc) => RecurringInvoiceTemplateMapper.toDomain(doc.id, doc.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list due recurring invoice templates', error);
    }
  }

  async delete(companyId: string, id: string): Promise<void> {
    try {
      await this.collection(companyId).doc(id).delete();
    } catch (error) {
      throw new InfrastructureError('Failed to delete recurring invoice template', error);
    }
  }
}
