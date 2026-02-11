import * as admin from 'firebase-admin';
import { Budget, BudgetStatus } from '../../../../domain/accounting/entities/Budget';
import { IBudgetRepository } from '../../../../repository/interfaces/accounting/IBudgetRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const toTimestamp = (d: Date) => admin.firestore.Timestamp.fromDate(d);

export class FirestoreBudgetRepository implements IBudgetRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('accounting')
      .doc('Data')
      .collection('budgets');
  }

  async create(budget: Budget): Promise<Budget> {
    try {
      await this.col(budget.companyId).doc(budget.id).set(this.toPersistence(budget));
      return budget;
    } catch (error) {
      throw new InfrastructureError('Failed to create budget', error);
    }
  }

  async update(budget: Budget): Promise<Budget> {
    try {
      await this.col(budget.companyId).doc(budget.id).set(this.toPersistence(budget), { merge: true });
      return budget;
    } catch (error) {
      throw new InfrastructureError('Failed to update budget', error);
    }
  }

  async setStatus(companyId: string, id: string, status: BudgetStatus): Promise<void> {
    try {
      await this.col(companyId).doc(id).set({ status }, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to set budget status', error);
    }
  }

  async findById(companyId: string, id: string): Promise<Budget | null> {
    try {
      const doc = await this.col(companyId).doc(id).get();
      if (!doc.exists) return null;
      return this.toDomain(doc.id, doc.data() as any);
    } catch (error) {
      throw new InfrastructureError('Failed to load budget', error);
    }
  }

  async list(companyId: string, fiscalYearId?: string): Promise<Budget[]> {
    try {
      let q: admin.firestore.Query = this.col(companyId);
      if (fiscalYearId) q = q.where('fiscalYearId', '==', fiscalYearId);
      const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
      return snap.docs.map((d) => this.toDomain(d.id, d.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list budgets', error);
    }
  }

  private toPersistence(b: Budget) {
    return {
      companyId: b.companyId,
      fiscalYearId: b.fiscalYearId,
      name: b.name,
      version: b.version,
      status: b.status,
      lines: b.lines,
      createdAt: toTimestamp(b.createdAt),
      createdBy: b.createdBy,
      updatedAt: b.updatedAt ? toTimestamp(b.updatedAt) : null,
      updatedBy: b.updatedBy || null
    };
  }

  private toDomain(id: string, data: any): Budget {
    return new Budget(
      id,
      data.companyId,
      data.fiscalYearId,
      data.name,
      data.version,
      data.status as BudgetStatus,
      data.lines || [],
      data.createdAt?.toDate?.() || new Date(),
      data.createdBy || '',
      data.updatedAt?.toDate?.() || undefined,
      data.updatedBy || undefined
    );
  }
}
