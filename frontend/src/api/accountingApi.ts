
/**
 * accountingApi.ts
 */
import client from './client';
import { VoucherListFilters, VoucherListResponse, VoucherListItem } from '../types/accounting/VoucherListTypes';

// Re-export types for convenience
export type { VoucherListItem };

// Types matching Backend DTOs for single item (detail view might differ slightly from list view)
export interface VoucherDetailDTO extends VoucherListItem {
  lines?: any[];
  metadata?: Record<string, any>;
}

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export interface GeneralLedgerEntry {
  id: string;
  date: string;
  voucherId: string;
  voucherNo?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  description?: string;
  debit: number;
  credit: number;
  currency: string;
  amount: number;
  baseCurrency: string;
  baseAmount: number;
  exchangeRate: number;
  runningBalance?: number;
  
  // Audit Metadata
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  postedAt?: string;
  postedBy?: string;
  postedByName?: string;
  postedByEmail?: string;
}


export interface AccountDTO {
  // Identity
  id: string;
  systemCode: string;
  userCode: string;
  name: string;
  description?: string | null;
  
  // Accounting semantics
  accountRole: string;
  classification: string;
  balanceNature: string;
  balanceEnforcement: string;
  
  // Hierarchy
  parentId?: string | null;
  
  // Currency
  currencyPolicy: string;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  
  // Lifecycle
  status: string;
  isProtected: boolean;
  replacedByAccountId?: string | null;
  
  // Computed flags
  canPost?: boolean;
  hasChildren?: boolean;
  isUsed?: boolean;
  
  // Legacy compat fields
  code?: string;
  type?: string;
  currency?: string;
  active?: boolean;
  isActive?: boolean;
}

// Voucher Correction Types
export type CorrectionMode = 'REVERSE_ONLY' | 'REVERSE_AND_REPLACE';

export interface CorrectionOptions {
  reversalDate?: 'today' | string;
  reason?: string;
  replaceStartsAsDraft?: boolean;
}

export interface ReplacementPayload {
  date?: string;
  description?: string;
  reference?: string;
  lines?: Array<{
    accountId: string;
    debitFx?: number;
    creditFx?: number;
    debitBase?: number;
    creditBase?: number;
    side?: 'Debit' | 'Credit';
    currency?: string;
    rate?: number;
    memo?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface CorrectionRequest {
  correctionMode: CorrectionMode;
  options?: CorrectionOptions;
  replacePayload?: ReplacementPayload;
}

export interface CorrectionResponse {
  reverseVoucherId: string;
  replaceVoucherId?: string;
  correctionGroupId: string;
  summary: {
    reversalPosted: boolean;
    replacementCreated: boolean;
    replacementPosted: boolean;
  };
}

export interface AccountingPolicyConfig {
  financialApprovalEnabled: boolean;
  custodyConfirmationEnabled: boolean;
  strictApprovalMode: boolean;
  allowEditDeletePosted: boolean;
  autoPostEnabled: boolean;
  approvalRequired: boolean;
  periodLockEnabled: boolean;
  lockedThroughDate?: string;
  accountAccessEnabled: boolean;
  policyErrorMode: 'FAIL_FAST' | 'AGGREGATE';
  updatedAt?: string;
  updatedBy?: string;
}

export const accountingApi = {
  
  getAccounts: (): Promise<AccountDTO[]> => {
    return client.get('/tenant/accounting/accounts');
  },

  listVouchers: (filters: VoucherListFilters): Promise<VoucherListResponse> => {
    // Construct Query String
    const params = new URLSearchParams();
    
    if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
    if (filters.formId) params.append('formId', filters.formId);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.search) params.append('search', filters.search);
    if (filters.sort) params.append('sort', filters.sort);
    
    params.append('page', filters.page.toString());
    params.append('pageSize', filters.pageSize.toString());

    return client.get(`/tenant/accounting/vouchers?${params.toString()}`);
  },

  getVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.get(`/tenant/accounting/vouchers/${id}`);
  },

  createVoucher: (payload: any): Promise<VoucherDetailDTO> => {
    return client.post('/tenant/accounting/vouchers', payload);
  },

  updateVoucher: (id: string, payload: any): Promise<VoucherDetailDTO> => {
    return client.put(`/tenant/accounting/vouchers/${id}`, payload);
  },

  deleteVoucher: (id: string): Promise<{ success: boolean }> => {
    return client.delete(`/tenant/accounting/vouchers/${id}`);
  },

  // --- WORKFLOW ACTIONS ---

  sendVoucherToApproval: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/tenant/accounting/vouchers/${id}/approve`);
  },

  approveVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/tenant/accounting/vouchers/${id}/verify`);
  },

  confirmVoucherCustody: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/tenant/accounting/vouchers/${id}/confirm`);
  },

  lockVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/tenant/accounting/vouchers/${id}/lock`);
  },

  rejectVoucher: (id: string, reason?: string): Promise<VoucherDetailDTO> => {
    return client.post(`/tenant/accounting/vouchers/${id}/reject`, { reason });
  },

  postVoucher: (id: string): Promise<{ success: boolean }> => {
    return client.post(`/tenant/accounting/vouchers/${id}/post`);
  },

  cancelVoucher: (id: string): Promise<VoucherDetailDTO> => {
    return client.post(`/tenant/accounting/vouchers/${id}/cancel`);
  },

  getPendingApprovals: (): Promise<VoucherDetailDTO[]> => {
    return client.get('/tenant/accounting/vouchers/pending/approvals');
  },

  getPendingCustody: (): Promise<VoucherDetailDTO[]> => {
    return client.get('/tenant/accounting/vouchers/pending/custody');
  },

  // --- CORRECTIONS ---
  reverseAndReplaceVoucher: (id: string, request: CorrectionRequest): Promise<CorrectionResponse> => {
    return client.post(`/tenant/accounting/vouchers/${id}/correct`, request);
  },

  // --- REPORTS ---
  getTrialBalance: (): Promise<TrialBalanceLine[]> => {
    return client.get('/tenant/accounting/reports/trial-balance');
  },

  getProfitAndLoss: (fromDate: string, toDate: string): Promise<any> => {
    const params = new URLSearchParams();
    params.append('from', fromDate);
    params.append('to', toDate);
    return client.get(`/tenant/accounting/reports/profit-loss?${params.toString()}`);
  },

  getGeneralLedger: (accountId?: string, from?: string, to?: string): Promise<GeneralLedgerEntry[]> => {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const queryString = params.toString();
    return client.get(`/tenant/accounting/reports/general-ledger${queryString ? `?${queryString}` : ''}`);
  },

  getPolicyConfig: (): Promise<AccountingPolicyConfig> => {
    return client.get('/tenant/accounting/policy-config');
  },

  // --- CURRENCIES ---
  
  /** Get all active currencies from the system */
  getCurrencies: (): Promise<{ currencies: CurrencyDTO[] }> => {
    return client.get('/tenant/accounting/currencies');
  },

  /** Get currencies enabled for the current company */
  getCompanyCurrencies: (): Promise<{ currencies: CompanyCurrencyDTO[] }> => {
    return client.get('/tenant/accounting/company/currencies');
  },

  /** Enable a currency for the company (requires initial rate) */
  enableCurrency: (currencyCode: string, initialRate: number, initialRateDate?: string): Promise<{ success: boolean; companyCurrency: CompanyCurrencyDTO }> => {
    return client.post('/tenant/accounting/company/currencies', { currencyCode, initialRate, initialRateDate });
  },

  /** Disable a currency for the company */
  disableCurrency: (currencyCode: string): Promise<{ success: boolean }> => {
    return client.delete(`/tenant/accounting/company/currencies/${currencyCode}`);
  },

  // --- EXCHANGE RATES ---

  /** Get suggested exchange rate for a currency pair. Returns null if no rate exists. */
  getSuggestedRate: (fromCurrency: string, toCurrency: string, date?: string): Promise<SuggestedRateDTO> => {
    const params = new URLSearchParams({ fromCurrency, toCurrency });
    if (date) params.append('date', date);
    return client.get(`/tenant/accounting/exchange-rates/suggested?${params.toString()}`);
  },

  /** Get exchange rate history */
  getExchangeRateHistory: (fromCurrency?: string, toCurrency?: string, limit?: number): Promise<{ rates: any[] }> => {
    const params = new URLSearchParams();
    if (fromCurrency) params.append('fromCurrency', fromCurrency);
    if (toCurrency) params.append('toCurrency', toCurrency);
    if (limit) params.append('limit', limit.toString());
    return client.get(`/tenant/accounting/exchange-rates/history?${params.toString()}`);
  },

  /** Get latest exchange rates matrix */
  getLatestRatesMatrix: (): Promise<{ matrix: Record<string, Record<string, number>>; currencies: string[] }> => {
    return client.get('/tenant/accounting/exchange-rates/matrix');
  },

  /** Save a reference exchange rate */
  saveExchangeRate: (fromCurrency: string, toCurrency: string, rate: number, date?: string): Promise<{ success: boolean; exchangeRate: any }> => {
    return client.post('/tenant/accounting/exchange-rates', { fromCurrency, toCurrency, rate, date });
  },

  /** Check for rate deviation warnings */
  checkRateDeviation: (fromCurrency: string, toCurrency: string, proposedRate: number): Promise<RateDeviationDTO> => {
    return client.post('/tenant/accounting/exchange-rates/check-deviation', { fromCurrency, toCurrency, proposedRate });
  },
};

// Currency DTOs
export interface CurrencyDTO {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

export interface CompanyCurrencyDTO {
  id: string;
  companyId: string;
  currencyCode: string;
  isEnabled: boolean;
  enabledAt: string;
  disabledAt?: string | null;
}

export interface SuggestedRateDTO {
  rate: number | null;
  source: 'EXACT_DATE' | 'MOST_RECENT' | 'NONE';
  rateDate: string | null;
}

export interface RateDeviationWarning {
  type: 'PERCENTAGE_DEVIATION' | 'DECIMAL_SHIFT' | 'FIRST_RATE';
  message: string;
  suggestedRate?: number;
  percentageDeviation?: number;
}

export interface RateDeviationDTO {
  warnings: RateDeviationWarning[];
  hasWarnings: boolean;
}
