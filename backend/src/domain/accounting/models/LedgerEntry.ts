export interface LedgerEntry {
  id: string;
  companyId: string;
  accountId: string;
  voucherId: string;
  voucherLineId: string;
  date: string;
  debit: number;
  credit: number;
  createdAt: string;
}
