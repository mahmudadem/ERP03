
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
  classification: string;
  totalDebit: number;
  totalCredit: number;
  closingDebit: number;
  closingCredit: number;
  /** @deprecated Use closingDebit/closingCredit instead */
  netBalance: number;
  parentId: string | null;
}

export interface TrialBalanceMeta {
  generatedAt: string;
  asOfDate: string;
  includeZeroBalance: boolean;
  totalClosingDebit: number;
  totalClosingCredit: number;
  difference: number;
  isBalanced: boolean;
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

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  parentId?: string | null;
  level: number;
  balance: number;
  isParent: boolean;
}

export interface BalanceSheetData {
  asOfDate: string;
  baseCurrency: string;
  assets: { accounts: BalanceSheetLine[]; total: number };
  liabilities: { accounts: BalanceSheetLine[]; total: number };
  equity: { accounts: BalanceSheetLine[]; total: number };
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface AccountStatementEntry {
  id: string;
  date: string;
  voucherId: string;
  voucherNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  baseDebit?: number;
  baseCredit?: number;
  baseBalance?: number;
  currency?: string;
  fxAmount?: number;
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

// Fiscal Year DTOs
export interface FiscalPeriodDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  periodNo: number;
  isSpecial: boolean;
}

export interface FiscalYearDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  periods: FiscalPeriodDTO[];
  closingVoucherId?: string;
  periodScheme?: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL';
  specialPeriodsCount: number;
}

export interface CreateFiscalYearDTO {
  year: number;
  startMonth: number;
  name?: string;
  periodScheme?: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL';
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
  reverseVoucher: (id: string, reversalDate?: string): Promise<CorrectionResponse> => {
    return client.post(`/tenant/accounting/vouchers/${id}/correct`, { 
      correctionMode: 'REVERSE_ONLY',
      options: { reversalDate: reversalDate || 'today' }
    });
  },

  reverseAndReplaceVoucher: (id: string, request: CorrectionRequest): Promise<CorrectionResponse> => {
    return client.post(`/tenant/accounting/vouchers/${id}/correct`, request);
  },

  // --- REPORTS ---
  getTrialBalance: async (params?: { asOfDate?: string; includeZeroBalance?: boolean }): Promise<{ data: TrialBalanceLine[]; meta: TrialBalanceMeta }> => {
    const qp = new URLSearchParams();
    if (params?.asOfDate) qp.append('asOfDate', params.asOfDate);
    if (params?.includeZeroBalance) qp.append('includeZeroBalance', 'true');
    const qs = qp.toString();
    // Interceptor unwraps { success, data: { rows, meta } } → { rows, meta }
    const result: any = await client.get(`/tenant/accounting/reports/trial-balance${qs ? `?${qs}` : ''}`);
    return {
      data: result?.rows ?? [],
      meta: result?.meta ?? null
    };
  },


  getProfitAndLoss: (fromDate: string, toDate: string): Promise<any> => {
    const params = new URLSearchParams();
    params.append('from', fromDate);
    params.append('to', toDate);
    return client.get(`/tenant/accounting/reports/profit-loss?${params.toString()}`);
  },

  getBalanceSheet: (asOfDate?: string): Promise<BalanceSheetData> => {
    const params = new URLSearchParams();
    if (asOfDate) params.append('asOfDate', asOfDate);
    const qs = params.toString();
    return client.get(`/tenant/accounting/reports/balance-sheet${qs ? `?${qs}` : ''}`);
  },

  getGeneralLedger: (accountId?: string, from?: string, to?: string, limit?: number, offset?: number): Promise<any> => {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const queryString = params.toString();
    return client.get(`/tenant/accounting/reports/general-ledger${queryString ? `?${queryString}` : ''}`);
  },

  getAccountStatement: (accountId: string, fromDate?: string, toDate?: string, includeUnposted?: boolean): Promise<AccountStatementData> => {
    const params: Record<string, any> = { accountId };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (includeUnposted) params.includeUnposted = 'true';
    return client
      .get('/tenant/accounting/reports/account-statement', { params })
      .then((r: any) => {
        if (r && r.data && typeof r.data === 'object') {
          return (r.data as any).data ?? r.data;
        }
        return r;
      });
  },

  getPolicyConfig: (): Promise<AccountingPolicyConfig> => {
    return client.get('/tenant/accounting/policy-config');
  },

  // --- FISCAL YEARS ---
  listFiscalYears: (): Promise<FiscalYearDTO[]> => {
    return client.get('/tenant/accounting/fiscal-years').then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  createFiscalYear: (payload: CreateFiscalYearDTO): Promise<FiscalYearDTO> => {
    return client.post('/tenant/accounting/fiscal-years', payload).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  closeFiscalPeriod: (fiscalYearId: string, periodId: string): Promise<FiscalYearDTO> => {
    return client.post(`/tenant/accounting/fiscal-years/${fiscalYearId}/close-period`, { periodId }).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  reopenFiscalPeriod: (fiscalYearId: string, periodId: string): Promise<FiscalYearDTO> => {
    return client.post(`/tenant/accounting/fiscal-years/${fiscalYearId}/reopen-period`, { periodId }).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  enableSpecialPeriods: (fiscalYearId: string, definitions: { name: string }[]): Promise<FiscalYearDTO> => {
    return client.post(`/tenant/accounting/fiscal-years/${fiscalYearId}/enable-special-periods`, { definitions }).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  autoCreateRetainedEarnings: (): Promise<{ account: any; created: boolean; message: string }> => {
    return client.post('/tenant/accounting/fiscal-years/auto-create-retained-earnings').then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  closeFiscalYear: (fiscalYearId: string, retainedEarningsAccountId: string): Promise<{ success: boolean; data: any }> => {
    return client.post(`/tenant/accounting/fiscal-years/${fiscalYearId}/close-year`, { retainedEarningsAccountId }).then((r: any) => (r?.data ?? r));
  },

  reopenFiscalYear: (fiscalYearId: string): Promise<FiscalYearDTO> => {
    return client.post(`/tenant/accounting/fiscal-years/${fiscalYearId}/reopen-year`).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  deleteFiscalYear: (fiscalYearId: string): Promise<{ success: boolean }> => {
    return client.delete(`/tenant/accounting/fiscal-years/${fiscalYearId}`).then((r: any) => (r?.data ?? r));
  },

  // --- COST CENTERS ---
  listCostCenters: (): Promise<CostCenterDTO[]> => {
    return client.get('/tenant/accounting/cost-centers').then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },
  getCostCenter: (id: string): Promise<CostCenterDTO> => {
    return client.get(`/tenant/accounting/cost-centers/${id}`).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },
  createCostCenter: (payload: Partial<CostCenterDTO>): Promise<CostCenterDTO> => {
    return client.post('/tenant/accounting/cost-centers', payload).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },
  updateCostCenter: (id: string, payload: Partial<CostCenterDTO>): Promise<CostCenterDTO> => {
    return client.put(`/tenant/accounting/cost-centers/${id}`, payload).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },
  deactivateCostCenter: (id: string): Promise<any> => {
    return client.delete(`/tenant/accounting/cost-centers/${id}`).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  getDashboardSummary: (): Promise<any> => {
    return client.get('/tenant/accounting/reports/dashboard-summary').then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  getCashFlow: (from?: string, to?: string): Promise<any> => {
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return client.get('/tenant/accounting/reports/cash-flow', { params }).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },
  getJournal: (params: any): Promise<any[]> => {
    return client.get('/tenant/accounting/reports/journal', { params }).then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },

  listVoucherSequences: (): Promise<VoucherSequenceDTO[]> => {
    return client.get('/tenant/accounting/voucher-sequences').then((r: any) => (r?.data?.data ?? r?.data ?? r));
  },
  setNextVoucherNumber: (prefix: string, nextNumber: number, year?: number): Promise<void> => {
    return client.post('/tenant/accounting/voucher-sequences/next', { prefix, nextNumber, year }).then(() => {});
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

  // --- BANK RECONCILIATION ---
  importBankStatement: (payload: {
    accountId: string;
    bankName: string;
    statementDate: string;
    format: 'csv' | 'ofx';
    content: string;
    columnMap?: any;
  }): Promise<BankStatementDTO> => {
    return client.post('/tenant/accounting/bank-statements/import', payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  listBankStatements: (accountId?: string): Promise<BankStatementDTO[]> => {
    const params: any = {};
    if (accountId) params.accountId = accountId;
    return client.get('/tenant/accounting/bank-statements', { params }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  getReconciliation: (accountId: string): Promise<{ reconciliation: ReconciliationDTO; statement: BankStatementDTO; unreconciledLedger: any[] }> => {
    return client.get(`/tenant/accounting/reconciliation/${accountId}`).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  completeReconciliation: (accountId: string, payload: { statementId: string; adjustments?: any[] }): Promise<ReconciliationDTO> => {
    return client.post(`/tenant/accounting/reconciliation/${accountId}/complete`, payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  manualMatch: (payload: { statementId: string; lineId: string; ledgerEntryId: string }): Promise<void> => {
    return client.post('/tenant/accounting/reconciliation/match', payload).then(() => {});
  },

  // --- BUDGETS ---
  listBudgets: (fiscalYearId?: string): Promise<BudgetDTO[]> => {
    const params: any = {};
    if (fiscalYearId) params.fiscalYearId = fiscalYearId;
    return client.get('/tenant/accounting/budgets', { params }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  createBudget: (payload: { fiscalYearId: string; name: string; version?: number; lines: BudgetLineDTO[] }): Promise<BudgetDTO> => {
    return client.post('/tenant/accounting/budgets', payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  updateBudget: (id: string, payload: Partial<{ fiscalYearId: string; name: string; version?: number; lines: BudgetLineDTO[] }>): Promise<BudgetDTO> => {
    return client.put(`/tenant/accounting/budgets/${id}`, payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  approveBudget: (id: string): Promise<void> => {
    return client.post(`/tenant/accounting/budgets/${id}/approve`).then(() => {});
  },
  budgetVsActual: (budgetId: string, costCenterId?: string): Promise<any[]> => {
    const params: any = { budgetId };
    if (costCenterId) params.costCenterId = costCenterId;
    return client.get('/tenant/accounting/reports/budget-vs-actual', { params }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },

  getAgingReport: (type: 'AR' | 'AP', asOfDate: string, accountId?: string): Promise<AgingReportData> => {
    const params: any = { type, asOfDate };
    if (accountId) params.accountId = accountId;
    return client.get('/tenant/accounting/reports/aging', { params }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },

  // --- CONSOLIDATION ---
  listCompanyGroups: (): Promise<CompanyGroupDTO[]> => {
    return client.get('/tenant/accounting/company-groups').then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  createCompanyGroup: (payload: { name: string; reportingCurrency: string; members: { companyId: string; weight?: number }[] }): Promise<CompanyGroupDTO> => {
    return client.post('/tenant/accounting/company-groups', payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  getConsolidatedTrialBalance: (groupId: string, asOfDate: string): Promise<ConsolidatedTrialBalanceDTO> => {
    const params = { groupId, asOfDate };
    return client.get('/tenant/accounting/reports/consolidated-trial-balance', { params }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },

  // --- RECURRING VOUCHERS ---
  listRecurringVouchers: (): Promise<RecurringVoucherTemplateDTO[]> => {
    return client.get('/tenant/accounting/recurring-vouchers').then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  createRecurringVoucher: (payload: {
    name: string;
    sourceVoucherId: string;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    dayOfMonth: number;
    startDate: string;
    endDate?: string;
    maxOccurrences?: number;
  }): Promise<RecurringVoucherTemplateDTO> => {
    return client.post('/tenant/accounting/recurring-vouchers', payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  updateRecurringVoucher: (id: string, payload: Partial<{
    name: string;
    sourceVoucherId: string;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    dayOfMonth: number;
    startDate: string;
    endDate?: string;
    maxOccurrences?: number;
  }>): Promise<RecurringVoucherTemplateDTO> => {
    return client.put(`/tenant/accounting/recurring-vouchers/${id}`, payload).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  pauseRecurringVoucher: (id: string): Promise<RecurringVoucherTemplateDTO> => {
    return client.post(`/tenant/accounting/recurring-vouchers/${id}/pause`, {}).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  resumeRecurringVoucher: (id: string): Promise<RecurringVoucherTemplateDTO> => {
    return client.post(`/tenant/accounting/recurring-vouchers/${id}/resume`, {}).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  generateRecurringVouchers: (asOfDate?: string): Promise<any[]> => {
    return client.post('/tenant/accounting/recurring-vouchers/generate', { asOfDate: asOfDate || new Date().toISOString().slice(0, 10) })
      .then((r: any) => r?.data?.data ?? r?.data ?? r);
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
  isBase: boolean;
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

export interface VoucherSequenceDTO {
  id: string;
  prefix: string;
  year?: number;
  lastNumber: number;
  format?: string;
  updatedAt?: string;
}
// Bank Reconciliation
export interface BankStatementLineDTO {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  balance?: number;
  matchedLedgerEntryId?: string;
  matchStatus: 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUAL_MATCHED';
}

export interface BankStatementDTO {
  id: string;
  companyId: string;
  accountId: string;
  bankName: string;
  statementDate: string;
  importedAt: string;
  importedBy: string;
  lines: BankStatementLineDTO[];
}

export interface ReconciliationDTO {
  id: string;
  companyId: string;
  accountId: string;
  bankStatementId: string;
  periodEnd: string;
  bookBalance: number;
  bankBalance: number;
  adjustments: any[];
  status: string;
  completedAt?: string;
  completedBy?: string;
}

// Budgets
export interface BudgetLineDTO {
  accountId: string;
  costCenterId?: string;
  monthlyAmounts: number[];
  annualTotal: number;
}

export interface BudgetDTO {
  id: string;
  companyId: string;
  fiscalYearId: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'CLOSED';
  lines: BudgetLineDTO[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AgingReportRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  bucketAmounts: number[];
  total: number;
  entries?: { id: string; date: string; description?: string; amount: number; days: number }[];
}

export interface AgingReportData {
  asOfDate: string;
  type: 'AR' | 'AP';
  buckets: string[];
  accounts: AgingReportRow[];
  totals: number[];
  grandTotal: number;
}
export interface CompanyGroupDTO {
  id: string;
  name: string;
  reportingCurrency: string;
  members: { companyId: string; weight?: number }[];
}
export interface ConsolidatedTrialBalanceDTO {
  groupId: string;
  reportingCurrency: string;
  asOfDate: string;
  lines: {
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  totals: { debit: number; credit: number; balance: number };
}
export interface RecurringVoucherTemplateDTO {
  id: string;
  companyId: string;
  name: string;
  sourceVoucherId: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  nextGenerationDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}
// Cost Centers
export interface CostCenterDTO {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}
