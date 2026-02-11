import { LedgerEntry } from '../../../domain/accounting/models/LedgerEntry';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface GLFilters {
  accountId?: string;
  voucherId?: string;
  fromDate?: string;
  toDate?: string;
  voucherType?: string;
}

export interface AccountStatementEntry {
  id: string;
  date: string;
  voucherId: string;
  voucherNo: string;
  description: string;
  debit: number; // Account currency debit
  credit: number; // Account currency credit
  balance: number; // Running balance (account currency)
  baseDebit?: number; // Base currency debit
  baseCredit?: number; // Base currency credit
  baseBalance?: number; // Running balance (base currency)
  currency?: string;
  fxAmount?: number; // Same as amount (account currency) for compatibility
  exchangeRate?: number;
}

export interface AccountStatementData {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCurrency: string;
  baseCurrency: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  openingBalanceBase?: number;
  entries: AccountStatementEntry[];
  closingBalance: number;
  closingBalanceBase?: number;
  totalDebit: number;
  totalCredit: number;
  totalBaseDebit?: number;
  totalBaseCredit?: number;
}

export interface ILedgerRepository {
  recordForVoucher(voucher: VoucherEntity, transaction?: any): Promise<void>;
  deleteForVoucher(companyId: string, voucherId: string, transaction?: any): Promise<void>;
  getAccountLedger(companyId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerEntry[]>;
  getTrialBalance(companyId: string, asOfDate: string): Promise<TrialBalanceRow[]>;
  getGeneralLedger(companyId: string, filters: GLFilters): Promise<LedgerEntry[]>;
  getAccountStatement(
    companyId: string,
    accountId: string,
    fromDate: string,
    toDate: string,
    options?: { includeUnposted?: boolean }
  ): Promise<AccountStatementData>;
  getUnreconciledEntries(
    companyId: string,
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<LedgerEntry[]>;
  markReconciled(
    companyId: string,
    ledgerEntryId: string,
    reconciliationId: string,
    bankStatementLineId: string
  ): Promise<void>;
}
