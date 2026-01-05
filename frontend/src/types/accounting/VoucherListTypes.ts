
/**
 * VoucherListTypes.ts
 * Defines contracts for the Voucher List feature (Filters, API Response, Item Shape).
 */

import { PostingLockPolicy } from './PostingLockPolicy';

export interface VoucherListItem {
  id: string;
  companyId: string;
  type: string; // e.g., 'INV', 'REC'
  date: string; // ISO String
  currency: string;
  // V1: Workflow states only. POSTED is derived from postedAt.
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  totalDebit: number;
  totalCredit: number;
  reference?: string;
  voucherNo?: string;
  createdBy?: string;
  createdAt?: string; // ISO String or FireStore timestamp
  // V1: Posting indicator (financial effect)
  postedAt?: string;  // ISO String - when ledger entries were created
  postedBy?: string;  // User who triggered posting
  // V2: Audit Lock Policy
  postingLockPolicy?: PostingLockPolicy;
  // Form tracking
  formId?: string;  // Which form was used to create this voucher
  prefix?: string;  // Voucher number prefix
  reversalOfVoucherId?: string; // ID of the voucher this one reverses
  metadata?: Record<string, any>;
}

export interface VoucherListFilters {
  type?: string;
  formId?: string;  // Filter by specific voucher form/template
  status?: string;
  from?: string; // ISO Date YYYY-MM-DD
  to?: string;   // ISO Date YYYY-MM-DD
  search?: string;
  sort?: 'date_asc' | 'date_desc' | 'amount_asc' | 'amount_desc';
  page: number;
  pageSize: number;
}

export interface VoucherListResponse {
  items: VoucherListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
