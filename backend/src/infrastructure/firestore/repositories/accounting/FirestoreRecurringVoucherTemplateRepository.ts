import * as admin from 'firebase-admin';
import { RecurringVoucherTemplate } from '../../../../domain/accounting/entities/RecurringVoucherTemplate';
import { IRecurringVoucherTemplateRepository } from '../../../../repository/interfaces/accounting/IRecurringVoucherTemplateRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const toTimestamp = (d: Date) => admin.firestore.Timestamp.fromDate(d);

export class FirestoreRecurringVoucherTemplateRepository implements IRecurringVoucherTemplateRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('recurringTemplates');
  }

  async create(template: RecurringVoucherTemplate): Promise<RecurringVoucherTemplate> {
    try {
      await this.col(template.companyId).doc(template.id).set(this.toPersistence(template));
      return template;
    } catch (error) {
      throw new InfrastructureError('Failed to create recurring template', error);
    }
  }

  async update(template: RecurringVoucherTemplate): Promise<RecurringVoucherTemplate> {
    try {
      await this.col(template.companyId).doc(template.id).set(this.toPersistence(template), { merge: true });
      return template;
    } catch (error) {
      throw new InfrastructureError('Failed to update recurring template', error);
    }
  }

  async list(companyId: string): Promise<RecurringVoucherTemplate[]> {
    try {
      const snap = await this.col(companyId).orderBy('createdAt', 'desc').get();
      return snap.docs.map((d) => this.toDomain(d.id, d.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list recurring templates', error);
    }
  }

  async findById(companyId: string, id: string): Promise<RecurringVoucherTemplate | null> {
    try {
      const doc = await this.col(companyId).doc(id).get();
      if (!doc.exists) return null;
      return this.toDomain(doc.id, doc.data() as any);
    } catch (error) {
      throw new InfrastructureError('Failed to find recurring template', error);
    }
  }

  async listDue(companyId: string, asOfDate: string): Promise<RecurringVoucherTemplate[]> {
    try {
      const snap = await this.col(companyId)
        .where('status', '==', 'ACTIVE')
        .where('nextGenerationDate', '<=', asOfDate)
        .get();
      return snap.docs.map((d) => this.toDomain(d.id, d.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list due recurring templates', error);
    }
  }

  private toPersistence(t: RecurringVoucherTemplate) {
    return {
      companyId: t.companyId,
      name: t.name,
      sourceVoucherId: t.sourceVoucherId,
      frequency: t.frequency,
      dayOfMonth: t.dayOfMonth,
      startDate: t.startDate,
      endDate: t.endDate || null,
      maxOccurrences: t.maxOccurrences || null,
      occurrencesGenerated: t.occurrencesGenerated,
      nextGenerationDate: t.nextGenerationDate,
      status: t.status,
      createdBy: t.createdBy,
      createdAt: toTimestamp(t.createdAt),
      updatedAt: t.updatedAt ? toTimestamp(t.updatedAt) : null,
      updatedBy: t.updatedBy || null
    };
  }

  private toDomain(id: string, data: any): RecurringVoucherTemplate {
    return new RecurringVoucherTemplate(
      id,
      data.companyId,
      data.name,
      data.sourceVoucherId,
      data.frequency,
      data.dayOfMonth,
      data.startDate,
      data.endDate || undefined,
      data.maxOccurrences || undefined,
      data.occurrencesGenerated || 0,
      data.nextGenerationDate,
      data.status,
      data.createdBy || '',
      data.createdAt?.toDate?.() || new Date(),
      data.updatedAt?.toDate?.() || undefined,
      data.updatedBy || undefined
    );
  }
}
