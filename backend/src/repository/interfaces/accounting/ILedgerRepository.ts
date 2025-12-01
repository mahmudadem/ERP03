import { LedgerEntry } from '../../../domain/accounting/models/LedgerEntry';
import { Voucher } from '../../../domain/accounting/entities/Voucher';

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
  fromDate?: string;
  toDate?: string;
  voucherType?: string;
}

export interface ILedgerRepository {
  recordForVoucher(voucher: Voucher): Promise<void>;
  deleteForVoucher(companyId: string, voucherId: string): Promise<void>;
  getAccountLedger(companyId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerEntry[]>;
  getTrialBalance(companyId: string, asOfDate: string): Promise<TrialBalanceRow[]>;
  getGeneralLedger(companyId: string, filters: GLFilters): Promise<LedgerEntry[]>;
}
