import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ILedgerRepository, TrialBalanceRow, GLFilters, AccountStatementData, AccountStatementEntry } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { LedgerEntry } from '../../../../domain/accounting/models/LedgerEntry';
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { InfrastructureError } from '../../../errors/InfrastructureError';

// serverTimestamp and toTimestamp moved to usage points for clarity or kept as helpers
const serverTimestamp = () => FieldValue.serverTimestamp();

const toTimestamp = (val: any) => {
  if (!val) return serverTimestamp();
  const date = val instanceof Date ? val : new Date(val);
  return Timestamp.fromDate(date);
};

const toTimestampBoundary = (val: any, endOfDay = false) => {
  const date = val instanceof Date ? val : new Date(val);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return Timestamp.fromDate(date);
};

const dateToIso = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    return val.includes('T') ? val.split('T')[0] : val;
  }
  if (typeof val === 'object' && 'seconds' in val) {
    const d = new Date((val as any).seconds * 1000);
    return dateToIso(d);
  }
  return String(val);
};

const getAmountsBySide = (entry: any, targetAccountCurrency: string | undefined, baseCurrency: string | undefined) => {
  const side = entry.side || 'Debit';
  const entryCurrency = (entry.currency || '').toUpperCase();
  const baseCur = (baseCurrency || '').toUpperCase();
  const targetCurrency = (targetAccountCurrency || '').toUpperCase();

  // Use stored amounts
  let accountAmount = entry.amount ?? entry.fxAmount ?? 0;
  let baseAmount = entry.baseAmount ?? 0;

  // If the ledger stored amount in a different currency than the account (e.g., base),
  // convert from baseAmount using exchangeRate when possible.
  if (targetCurrency && entryCurrency && entryCurrency !== targetCurrency) {
    if (baseAmount && entry.exchangeRate) {
      accountAmount = baseAmount / entry.exchangeRate;
    }
  }

  // If baseAmount missing but we have amount and exchange rate, derive base
  if (!baseAmount && accountAmount && entry.exchangeRate) {
    baseAmount = accountAmount * entry.exchangeRate;
  }

  const debit = side === 'Debit' ? Math.abs(accountAmount) : 0;
  const credit = side === 'Credit' ? Math.abs(accountAmount) : 0;
  const baseDebit = side === 'Debit' ? Math.abs(baseAmount) : 0;
  const baseCredit = side === 'Credit' ? Math.abs(baseAmount) : 0;

  return { debit, credit, baseDebit, baseCredit, side };
};

export class FirestoreLedgerRepository implements ILedgerRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    // MODULAR PATTERN: companies/{id}/accounting (coll) -> Data (doc) -> ledger (coll)
    return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('ledger');
  }

  async recordForVoucher(voucher: VoucherEntity, transaction?: admin.firestore.Transaction): Promise<void> {
    try {
      const batch = !transaction ? this.db.batch() : null;
      
      voucher.lines.forEach((line) => {
        const id = `${voucher.id}_${line.id}`;
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
          isPosted: true,
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
      let snap: admin.firestore.QuerySnapshot;
      if (transaction) {
        snap = await transaction.get(this.col(companyId).where('voucherId', '==', voucherId));
      } else {
        snap = await this.col(companyId).where('voucherId', '==', voucherId).get();
      }

      const batch = !transaction ? this.db.batch() : null;
      
      snap.docs.forEach((doc) => {
        if (transaction) transaction.delete(doc.ref);
        else batch!.delete(doc.ref);
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
      const snap = await this.executeQuery(this.col(companyId), filters);
      return snap.docs.map((d) => d.data() as LedgerEntry);
    } catch (error) {
      throw new InfrastructureError('Failed to get general ledger', error);
    }
  }

  async getAccountStatement(companyId: string, accountId: string, fromDate: string, toDate: string, options?: { includeUnposted?: boolean }): Promise<AccountStatementData> {
    try {
      const startDate = fromDate || '1900-01-01';
      const endDate = toDate || new Date().toISOString().split('T')[0];

      const startTs = toTimestampBoundary(startDate);
      const endTs = toTimestampBoundary(endDate, true);

      const accountRef = this.db
        .collection('companies')
        .doc(companyId)
        .collection('accounting')
        .doc('Data')
        .collection('accounts')
        .doc(accountId);

      const includeUnposted = options?.includeUnposted ?? false;

      const ledgerCol = this.col(companyId);
      const applyPostingFilter = (query: admin.firestore.Query) => {
        if (includeUnposted) return query;
        return query.where('isPosted', '==', true);
      };

      const [accountDoc, companyDoc, openingSnap, rangeSnap] = await Promise.all([
        accountRef.get(),
        this.db.collection('companies').doc(companyId).get(),
        applyPostingFilter(ledgerCol)
          .where('accountId', '==', accountId)
          .where('date', '<', startTs)
          .get(),
        applyPostingFilter(ledgerCol)
          .where('accountId', '==', accountId)
          .where('date', '>=', startTs)
          .where('date', '<=', endTs)
          .orderBy('date', 'asc')
          .get()
      ]);

      const accountData = accountDoc.exists ? accountDoc.data() as any : null;
      const accountCode = accountData?.userCode || accountData?.code || '';
      const accountName = accountData?.name || 'Unknown Account';
      const accountCurrency = accountData?.fixedCurrencyCode || accountData?.currency || '';
      const baseCurrency = (companyDoc.exists ? (companyDoc.data() as any)?.baseCurrency : '') || '';

      let openingBalance = 0;
      let openingBalanceBase = 0;
      openingSnap.docs.forEach((doc) => {
        const e = doc.data() as any;
        const { debit, credit, baseDebit, baseCredit, side } = getAmountsBySide(e, accountCurrency, baseCurrency);
        const signedAccount = side === 'Debit' ? debit : -credit;
        const signedBase = side === 'Debit' ? baseDebit : -baseCredit;
        openingBalance += signedAccount;
        openingBalanceBase += signedBase;
      });

      let running = openingBalance;
      let runningBase = openingBalanceBase;
      let totalDebit = 0;
      let totalCredit = 0;
      let totalBaseDebit = 0;
      let totalBaseCredit = 0;
      const entries: AccountStatementEntry[] = [];

      rangeSnap.docs.forEach((doc) => {
        const e = doc.data() as any;
        const { debit, credit, baseDebit, baseCredit, side } = getAmountsBySide(e, accountCurrency, baseCurrency);
        running += side === 'Debit' ? debit : -credit;
        runningBase += side === 'Debit' ? baseDebit : -baseCredit;
        totalDebit += debit;
        totalCredit += credit;
        totalBaseDebit += baseDebit;
        totalBaseCredit += baseCredit;

        entries.push({
          id: e.id || doc.id,
          date: dateToIso(e.date),
          voucherId: e.voucherId,
          voucherNo: e.voucherNo || e.voucherId || '',
          description: e.notes || e.description || '',
          debit,
          credit,
          balance: running,
          baseDebit,
          baseCredit,
          baseBalance: runningBase,
          currency: accountCurrency || e.currency,
          fxAmount: e.amount,
          exchangeRate: e.exchangeRate
        });
      });

      return {
        accountId,
        accountCode,
        accountName,
        accountCurrency,
        baseCurrency,
        fromDate: dateToIso(startDate),
        toDate: dateToIso(endDate),
        openingBalance,
        openingBalanceBase,
        entries,
        closingBalance: running,
        closingBalanceBase: runningBase,
        totalDebit,
        totalCredit,
        totalBaseDebit,
        totalBaseCredit
      };
    } catch (error) {
      throw new InfrastructureError('Failed to get account statement', error);
    }
  }

  private async executeQuery(collection: admin.firestore.CollectionReference, filters: GLFilters) {
    let ref: admin.firestore.Query = collection;
    if (filters.accountId) ref = ref.where('accountId', '==', filters.accountId);
    
    if (filters.voucherId) {
      ref = ref.where('voucherId', '==', filters.voucherId);
      ref = ref.where('isPosted', '==', true);
    }
    
    if (filters.fromDate) {
      ref = ref.where('date', '>=', toTimestamp(filters.fromDate));
    }
    if (filters.toDate) {
      const end = new Date(filters.toDate);
      end.setHours(23, 59, 59, 999);
      ref = ref.where('date', '<=', Timestamp.fromDate(end));
    }
    return ref.orderBy('date', 'asc').get();
  }
}
