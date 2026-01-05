export interface LedgerEntry {
  id: string;
  companyId: string;
  accountId: string;
  voucherId: string;
  voucherLineId: number; // Changed to number to match VoucherLine id
  date: any; // Can be string or Firestore Timestamp
  debit: number;
  credit: number;
  currency: string;
  amount: number;
  baseCurrency: string;
  baseAmount: number;
  exchangeRate: number;
  side: 'Debit' | 'Credit';
  notes?: string;
  costCenterId?: string;
  metadata?: Record<string, any>;
  isPosted?: boolean;
  createdAt: any;
}
