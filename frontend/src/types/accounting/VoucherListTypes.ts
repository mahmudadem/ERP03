
/**
 * VoucherListTypes.ts
 * Defines contracts for the Voucher List feature (Filters, API Response, Item Shape).
 */

export interface VoucherListItem {
  id: string;
  companyId: string;
  type: string; // e.g., 'INV', 'REC'
  date: string; // ISO String
  currency: string;
  // Updated status types to lowercase to match new backend logic
  status: 'draft' | 'pending' | 'approved' | 'locked' | 'cancelled';
  totalDebit: number;
  totalCredit: number;
  reference?: string;
  voucherNo?: string;
  createdBy?: string;
  // Form tracking
  formId?: string;  // Which form was used to create this voucher
  prefix?: string;  // Voucher number prefix
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
