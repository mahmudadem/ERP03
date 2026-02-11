import * as admin from 'firebase-admin';
import { BankStatement } from '../../../../domain/accounting/entities/BankStatement';
import { IBankStatementRepository } from '../../../../repository/interfaces/accounting/IBankStatementRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const toTimestamp = (val: any) => {
  if (!val) return admin.firestore.FieldValue.serverTimestamp();
  const date = val instanceof Date ? val : new Date(val);
  return admin.firestore.Timestamp.fromDate(date);
};

export class FirestoreBankStatementRepository implements IBankStatementRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('bankStatements');
  }

  async save(statement: BankStatement): Promise<BankStatement> {
    try {
      await this.col(statement.companyId).doc(statement.id).set({
        companyId: statement.companyId,
        accountId: statement.accountId,
        bankName: statement.bankName,
        statementDate: statement.statementDate,
        importedAt: toTimestamp(statement.importedAt),
        importedBy: statement.importedBy,
        lines: statement.lines
      });
      return statement;
    } catch (error) {
      throw new InfrastructureError('Failed to save bank statement', error);
    }
  }

  async findById(companyId: string, id: string): Promise<BankStatement | null> {
    try {
      const doc = await this.col(companyId).doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data() as any;
      return new BankStatement(
        doc.id,
        data.companyId,
        data.accountId,
        data.bankName,
        data.statementDate,
        data.importedAt?.toDate?.() || new Date(),
        data.importedBy || '',
        data.lines || []
      );
    } catch (error) {
      throw new InfrastructureError('Failed to load bank statement', error);
    }
  }

  async list(companyId: string, accountId?: string): Promise<BankStatement[]> {
    try {
      let q: admin.firestore.Query = this.col(companyId);
      if (accountId) q = q.where('accountId', '==', accountId);
      const snap = await q.orderBy('statementDate', 'desc').limit(50).get();
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return new BankStatement(
          d.id,
          data.companyId,
          data.accountId,
          data.bankName,
          data.statementDate,
          data.importedAt?.toDate?.() || new Date(),
          data.importedBy || '',
          data.lines || []
        );
      });
    } catch (error) {
      throw new InfrastructureError('Failed to list bank statements', error);
    }
  }

  async updateLineMatch(
    companyId: string,
    statementId: string,
    lineId: string,
    matchStatus: any,
    ledgerEntryId?: string
  ): Promise<void> {
    try {
      const doc = await this.col(companyId).doc(statementId).get();
      if (!doc.exists) throw new InfrastructureError('Bank statement not found', new Error('not found'));
      const data = doc.data() as any;
      const lines = (data.lines || []).map((l: any) =>
        l.id === lineId ? { ...l, matchStatus, matchedLedgerEntryId: ledgerEntryId || null } : l
      );
      await doc.ref.set({ lines }, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to update bank statement line match', error);
    }
  }
}
