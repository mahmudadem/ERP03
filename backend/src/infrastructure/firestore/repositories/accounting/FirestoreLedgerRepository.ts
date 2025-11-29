import * as admin from 'firebase-admin';
import { ILedgerRepository, TrialBalanceRow, GLFilters } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { LedgerEntry } from '../../../../domain/accounting/models/LedgerEntry';
import { Voucher } from '../../../../domain/accounting/models/Voucher';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreLedgerRepository implements ILedgerRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('ledger');
  }

  async recordForVoucher(voucher: Voucher): Promise<void> {
    try {
      const batch = this.db.batch();
      voucher.lines.forEach((line) => {
        const id = `${voucher.id}_${line.id}`;
        const debit = line.debitBase || 0;
        const credit = line.creditBase || 0;
        const docRef = this.col(voucher.companyId).doc(id);
        batch.set(docRef, {
          id,
          companyId: voucher.companyId,
          accountId: line.accountId,
          voucherId: voucher.id,
          voucherLineId: line.id,
          date: voucher.date,
          debit,
          credit,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      throw new InfrastructureError('Failed to record ledger for voucher', error);
    }
  }

  async deleteForVoucher(companyId: string, voucherId: string): Promise<void> {
    try {
      const snap = await this.col(companyId).where('voucherId', '==', voucherId).get();
      const batch = this.db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      throw new InfrastructureError('Failed to delete ledger for voucher', error);
    }
  }

  async getAccountLedger(companyId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerEntry[]> {
    try {
      const snap = await this.col(companyId)
        .where('accountId', '==', accountId)
        .where('date', '>=', fromDate)
        .where('date', '<=', toDate)
        .orderBy('date', 'asc')
        .get();
      return snap.docs.map((d) => d.data() as LedgerEntry);
    } catch (error) {
      throw new InfrastructureError('Failed to get account ledger', error);
    }
  }

  async getTrialBalance(companyId: string, asOfDate: string): Promise<TrialBalanceRow[]> {
    try {
      const snap = await this.col(companyId)
        .where('date', '<=', asOfDate)
        .get();
      const map: Record<string, TrialBalanceRow> = {};
      snap.docs.forEach((d) => {
        const entry = d.data() as any;
        if (!map[entry.accountId]) {
          map[entry.accountId] = {
            accountId: entry.accountId,
            accountCode: '',
            accountName: '',
            debit: 0,
            credit: 0,
            balance: 0,
          };
        }
        map[entry.accountId].debit += entry.debit || 0;
        map[entry.accountId].credit += entry.credit || 0;
      });
      return Object.values(map).map((row) => ({
        ...row,
        balance: (row.debit || 0) - (row.credit || 0),
      }));
    } catch (error) {
      throw new InfrastructureError('Failed to get trial balance', error);
    }
  }

  async getGeneralLedger(companyId: string, filters: GLFilters): Promise<LedgerEntry[]> {
    try {
      let ref: FirebaseFirestore.Query = this.col(companyId);
      if (filters.accountId) ref = ref.where('accountId', '==', filters.accountId);
      if (filters.fromDate) ref = ref.where('date', '>=', filters.fromDate);
      if (filters.toDate) ref = ref.where('date', '<=', filters.toDate);
      const snap = await ref.orderBy('date', 'asc').get();
      return snap.docs.map((d) => d.data() as LedgerEntry);
    } catch (error) {
      throw new InfrastructureError('Failed to get general ledger', error);
    }
  }
}
