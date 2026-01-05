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

export interface ILedgerRepository {
  recordForVoucher(voucher: VoucherEntity, transaction?: any): Promise<void>;
  deleteForVoucher(companyId: string, voucherId: string, transaction?: any): Promise<void>;
  getAccountLedger(companyId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerEntry[]>;
  getTrialBalance(companyId: string, asOfDate: string): Promise<TrialBalanceRow[]>;
  getGeneralLedger(companyId: string, filters: GLFilters): Promise<LedgerEntry[]>;
}
