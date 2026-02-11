import * as admin from 'firebase-admin';
import { Reconciliation } from '../../../../domain/accounting/entities/Reconciliation';
import { IReconciliationRepository } from '../../../../repository/interfaces/accounting/IReconciliationRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const toTimestamp = (val: any) => {
  if (!val) return admin.firestore.FieldValue.serverTimestamp();
  const date = val instanceof Date ? val : new Date(val);
  return admin.firestore.Timestamp.fromDate(date);
};

export class FirestoreReconciliationRepository implements IReconciliationRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('reconciliations');
  }

  async save(reconciliation: Reconciliation): Promise<Reconciliation> {
    try {
      await this.col(reconciliation.companyId).doc(reconciliation.id).set({
        companyId: reconciliation.companyId,
        accountId: reconciliation.accountId,
        bankStatementId: reconciliation.bankStatementId,
        periodEnd: reconciliation.periodEnd,
        bookBalance: reconciliation.bookBalance,
        bankBalance: reconciliation.bankBalance,
        adjustments: reconciliation.adjustments,
        status: reconciliation.status,
        completedAt: reconciliation.completedAt ? toTimestamp(reconciliation.completedAt) : null,
        completedBy: reconciliation.completedBy || null
      });
      return reconciliation;
    } catch (error) {
      throw new InfrastructureError('Failed to save reconciliation', error);
    }
  }

  async update(reconciliation: Reconciliation): Promise<void> {
    await this.save(reconciliation);
  }

  async findLatestForAccount(companyId: string, accountId: string): Promise<Reconciliation | null> {
    try {
      const snap = await this.col(companyId)
        .where('accountId', '==', accountId)
        .orderBy('periodEnd', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0];
      return this.toDomain(d.id, d.data());
    } catch (error) {
      throw new InfrastructureError('Failed to load reconciliation', error);
    }
  }

  async list(companyId: string, accountId?: string): Promise<Reconciliation[]> {
    try {
      let q: admin.firestore.Query = this.col(companyId);
      if (accountId) q = q.where('accountId', '==', accountId);
      const snap = await q.orderBy('periodEnd', 'desc').limit(50).get();
      return snap.docs.map((d) => this.toDomain(d.id, d.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list reconciliations', error);
    }
  }

  private toDomain(id: string, data: any): Reconciliation {
    return new Reconciliation(
      id,
      data.companyId,
      data.accountId,
      data.bankStatementId,
      data.periodEnd,
      data.bookBalance,
      data.bankBalance,
      data.adjustments || [],
      data.status || 'IN_PROGRESS',
      data.completedAt?.toDate?.() || undefined,
      data.completedBy || undefined
    );
  }
}
