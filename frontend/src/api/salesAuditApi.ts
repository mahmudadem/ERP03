import client from './client';
import { accountingApi } from './accountingApi';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface ResolvedAccount {
  resolvedId: string;
  fallbackLevel: string;
}

export interface LineDecision {
  lineNo: number;
  itemId?: string;
  accounts: {
    revenue?: ResolvedAccount;
    cogs?: ResolvedAccount;
    inventory?: ResolvedAccount;
    tax?: ResolvedAccount;
    ar?: ResolvedAccount;
    ap?: ResolvedAccount;
    discount?: ResolvedAccount;
    grni?: ResolvedAccount;
    expense?: ResolvedAccount;
  };
  cogsPostingStatus?: string;
  note?: string;
}

export interface PostingLog {
  id: string;
  companyId: string;
  sourceModule: string;
  sourceType: string;
  sourceId: string;
  sourceDocNumber?: string;
  strategy: string;
  voucherIds: string[];
  decisions: LineDecision[];
  warnings: string[];
  postedAt: string;
  postedBy: string;
}

export interface VoucherLine {
  id?: string;
  lineNo?: number;
  accountId: string;
  side: 'Debit' | 'Credit';
  baseAmount: number;
  amount?: number;
  currency?: string;
  // Legacy compat — older code paths may still send these
  debitAmount?: number;
  creditAmount?: number;
  notes?: string;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  date: string;
  type: string;
  lines: VoucherLine[];
  totalDebit: number;
  totalCredit: number;
  status: string;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface RecordChangeLog {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  action: string;
  changes: FieldChange[];
  userId: string;
  userEmail?: string;
  timestamp: string;
}

// ─── unwrap helper ────────────────────────────────────────────────────────────

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

// ─── API Object ──────────────────────────────────────────────────────────────

export const salesAuditApi = {
  getPostingLogsBySource: (sourceId: string): Promise<PostingLog[]> =>
    client
      .get('/tenant/accounting/posting-logs', { params: { sourceId } })
      .then(unwrap<PostingLog[]>),

  getVoucherById: (voucherId: string): Promise<Voucher> =>
    accountingApi.getVoucher(voucherId).then((v) => v as unknown as Voucher),

  getRecordAuditLog: (entityType: string, entityId: string): Promise<RecordChangeLog[]> =>
    client
      .get('/tenant/sales/audit-log', { params: { entityType, entityId } })
      .then(unwrap<RecordChangeLog[]>),

  getPurchaseRecordAuditLog: (entityType: string, entityId: string): Promise<RecordChangeLog[]> =>
    client
      .get('/tenant/purchase/audit-log', { params: { entityType, entityId } })
      .then(unwrap<RecordChangeLog[]>),
};
