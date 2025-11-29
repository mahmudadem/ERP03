export interface VoucherLine {
  id: string;
  accountId: string;
  debitFx: number;
  creditFx: number;
  debitBase: number;
  creditBase: number;
  description?: string;
  costCenterId?: string;
  lineCurrency?: string;
  exchangeRate?: number;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  type: string;
  date: string;
  description?: string;
  companyId: string;
  status: 'draft' | 'pending' | 'approved' | 'locked' | 'cancelled';
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  totalDebitBase: number;
  totalCreditBase: number;
  lines: VoucherLine[];
  createdBy: string;
  approvedBy?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
}
