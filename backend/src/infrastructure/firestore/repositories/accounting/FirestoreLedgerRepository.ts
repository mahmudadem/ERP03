import * as admin from 'firebase-admin';
import { ILedgerRepository, TrialBalanceRow, GLFilters } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { LedgerEntry } from '../../../../domain/accounting/models/LedgerEntry';
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const serverTimestamp = () => {
  const fv: any = (admin.firestore as any)?.FieldValue;
  return fv?.serverTimestamp ? fv.serverTimestamp() : new Date();
};

const toTimestamp = (val: any) => {
  if (!val) return serverTimestamp();
  const date = val instanceof Date ? val : new Date(val);
  const tsCtor: any = (admin.firestore as any)?.Timestamp;
  return tsCtor?.fromDate ? tsCtor.fromDate(date) : date;
};

export class FirestoreLedgerRepository implements ILedgerRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('ledger');
  }

  async recordForVoucher(voucher: VoucherEntity, transaction?: admin.firestore.Transaction): Promise<void> {
    try {
      const batch = !transaction ? this.db.batch() : null;
      
      voucher.lines.forEach((line) => {
        // Line ID is guaranteed unique within voucher by entity logic
        const id = `${voucher.id}_${line.id}`;
        
        // Canonical Posting Model: record debit and credit in base currency
        const debit = line.debitAmount;
        const credit = line.creditAmount;
        
        const docRef = this.col(voucher.companyId).doc(id);
        const data = {
          id,
          companyId: voucher.companyId,
          accountId: line.accountId,
          voucherId: voucher.id,
          voucherLineId: line.id,
          date: toTimestamp(voucher.date),
          debit,
          credit,
          currency: line.currency,
          amount: line.amount,
          baseCurrency: line.baseCurrency,
          baseAmount: line.baseAmount,
          exchangeRate: line.exchangeRate,
          side: line.side,
          notes: line.notes || null,
          costCenterId: line.costCenterId || null,
          metadata: line.metadata || {},
          createdAt: serverTimestamp(),
        };

        if (transaction) {
          transaction.set(docRef, data);
        } else {
          batch!.set(docRef, data);
        }
      });

      if (batch) {
        await batch.commit();
      }
    } catch (error) {
      throw new InfrastructureError('Failed to record ledger for voucher', error);
    }
  }

  async deleteForVoucher(companyId: string, voucherId: string, transaction?: admin.firestore.Transaction): Promise<void> {
    try {
      // Note: In a transaction, we must READ before WRITE.
      // But for delete, we might need to query first. 
      // Queries in transactions are tricky. We need to run the query using the transaction?
      // Firestore transactions don't support "query and delete" easily without reading.
      // But wait, `transaction.get(query)` is supported in some SDKs.
      // In Node.js admin SDK, `transaction.get(query)` works.
      
      let snap: admin.firestore.QuerySnapshot;
      if (transaction) {
        snap = await transaction.get(this.col(companyId).where('voucherId', '==', voucherId));
      } else {
        snap = await this.col(companyId).where('voucherId', '==', voucherId).get();
      }

      const batch = !transaction ? this.db.batch() : null;
      
      snap.docs.forEach((doc) => {
        if (transaction) {
          transaction.delete(doc.ref);
        } else {
          batch!.delete(doc.ref);
        }
      });

      if (batch) {
        await batch.commit();
      }
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
      const end = toTimestamp(asOfDate);
      const snap = await this.col(companyId)
        .where('date', '<=', end)
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
