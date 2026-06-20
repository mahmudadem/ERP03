import client from './client';

// ─── DTOs ────────────────────────────────────────────────────────────────────

// AR Aging

export interface ArAgingInvoiceDetailDTO {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | undefined;
  daysOverdue: number;
  outstandingAmountBase: number;
  bucket: string;
}

export interface ArAgingCustomerRowDTO {
  customerId: string;
  customerName: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  total: number;
  ledgerBalance?: number;
  unallocated?: number;
  invoices: ArAgingInvoiceDetailDTO[];
}

export interface ArAgingTotalsDTO {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  total: number;
}

export interface ArAgingReportDTO {
  asOfDate: string;
  rows: ArAgingCustomerRowDTO[];
  totals: ArAgingTotalsDTO;
}

// Customer Ledger

export interface LedgerEventDTO {
  ledgerEntryId?: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'REFUND' | 'ADJUSTMENT';
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  voucherId?: string;
  voucherNo?: string;
  voucherType?: string;
  voucherFormId?: string;
  voucherPart?: string;
  description?: string;
  sourceModule?: string;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
}

// Customer Statement

export interface OpenInvoiceSummaryDTO {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | undefined;
  grandTotalBase: number;
  outstandingAmountBase: number;
}

export interface CustomerStatementCommitmentDTO {
  sourceType: 'SALES_ORDER';
  sourceId: string;
  documentNumber: string;
  date: string;
  expectedDate?: string;
  status: string;
  amountBase: number;
  openAmountBase: number;
  description?: string;
}

export interface CustomerStatementDTO {
  customerId: string;
  customerName: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: LedgerEventDTO[];
  totalInvoiced: number;
  totalPaid: number;
  totalCredited?: number;
  totalAdjusted?: number;
  openInvoices: OpenInvoiceSummaryDTO[];
  openCommitments?: CustomerStatementCommitmentDTO[];
}

// Sales by Customer

export interface SalesByCustomerRowDTO {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  totalRevenueBase: number;
  totalTaxBase: number;
  totalGrossBase: number;
}

export interface SalesByCustomerTotalsDTO {
  invoiceCount: number;
  totalRevenueBase: number;
  totalTaxBase: number;
  totalGrossBase: number;
}

export interface SalesByCustomerReportDTO {
  fromDate?: string;
  toDate?: string;
  rows: SalesByCustomerRowDTO[];
  totals: SalesByCustomerTotalsDTO;
}

// Sales by Item

export interface SalesByItemRowDTO {
  itemId: string;
  itemCode: string;
  itemName: string;
  totalQty: number;
  totalRevenueBase: number;
  lineCount: number;
}

export interface SalesByItemTotalsDTO {
  totalQty: number;
  totalRevenueBase: number;
  lineCount: number;
}

export interface SalesByItemReportDTO {
  fromDate?: string;
  toDate?: string;
  rows: SalesByItemRowDTO[];
  totals: SalesByItemTotalsDTO;
}

// Sales by Salesperson

export interface SalesBySalespersonRowDTO {
  salespersonId: string;
  salespersonName: string;
  invoiceCount: number;
  totalRevenueBase: number;
  totalGrossBase: number;
}

export interface SalesBySalespersonTotalsDTO {
  invoiceCount: number;
  totalRevenueBase: number;
  totalGrossBase: number;
}

export interface SalesBySalespersonReportDTO {
  fromDate?: string;
  toDate?: string;
  rows: SalesBySalespersonRowDTO[];
  totals: SalesBySalespersonTotalsDTO;
}

// Gross Profit Facts

export type GrossProfitDocumentType =
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN';

export interface GrossProfitFilters {
  fromDate?: string;
  toDate?: string;
  documentType?: GrossProfitDocumentType | GrossProfitDocumentType[];
  itemId?: string;
  docCurrency?: string;
  limit?: number;
}

export interface GrossProfitCurrencyTotalsDTO {
  docCurrency: string;
  revenueAmountDocIn: number;
  costAmountDocIn: number;
  profitAmountDocIn: number;
  revenueAmountDocOut: number;
  costAmountDocOut: number;
  profitAmountDocOut: number;
  profitAmountDocNet: number;
}

export interface GrossProfitRowDTO {
  groupKey: string;
  groupLabel: string;
  lineCount: number;
  revenueAmountBaseIn: number;
  revenueAmountDocIn: number;
  costAmountBaseIn: number;
  costAmountDocIn: number;
  profitAmountBaseIn: number;
  profitAmountDocIn: number;
  revenueAmountBaseOut: number;
  revenueAmountDocOut: number;
  costAmountBaseOut: number;
  costAmountDocOut: number;
  profitAmountBaseOut: number;
  profitAmountDocOut: number;
  profitAmountBaseNet: number;
  docCurrency: string | null;
  hasMixedDocCurrencies: boolean;
  profitAmountDocNet: number;
  docCurrencyBreakdown: GrossProfitCurrencyTotalsDTO[];
}

export interface GrossProfitTotalsDTO {
  lineCount: number;
  profitBaseNet: number;
  profitBaseIn: number;
  profitBaseOut: number;
  revenueBaseIn: number;
  revenueBaseOut: number;
  costBaseIn: number;
  costBaseOut: number;
}

export interface GrossProfitReportDTO {
  fromDate?: string;
  toDate?: string;
  documentType?: GrossProfitDocumentType | GrossProfitDocumentType[];
  rows: GrossProfitRowDTO[];
  totals: GrossProfitTotalsDTO;
}

// ─── unwrap helper ────────────────────────────────────────────────────────────

const unwrap = <T>(payload: any): T => (payload?.data?.data ?? payload?.data ?? payload) as T;

const mapGrossProfitParams = (params?: GrossProfitFilters) => {
  if (!params) return undefined;
  const documentType = Array.isArray(params.documentType)
    ? params.documentType.join(',')
    : params.documentType;

  return {
    from: params.fromDate,
    to: params.toDate,
    documentType,
    itemId: params.itemId,
    docCurrency: params.docCurrency,
    limit: params.limit,
  };
};

// ─── API Object ──────────────────────────────────────────────────────────────

export const salesReportingApi = {
  getArAging: (params?: { asOfDate?: string; customerId?: string }): Promise<ArAgingReportDTO> =>
    client.get('/tenant/sales/reports/ar-aging', { params }).then(unwrap<ArAgingReportDTO>),

  getCustomerStatement: (params: { customerId: string; fromDate: string; toDate: string; includeOpenCommitments?: boolean }): Promise<CustomerStatementDTO> =>
    client.get('/tenant/sales/reports/customer-statement', { params }).then(unwrap<CustomerStatementDTO>),

  getSalesByCustomer: (params?: { fromDate?: string; toDate?: string }): Promise<SalesByCustomerReportDTO> =>
    client.get('/tenant/sales/reports/sales-by-customer', { params }).then(unwrap<SalesByCustomerReportDTO>),

  getSalesByItem: (params?: { fromDate?: string; toDate?: string }): Promise<SalesByItemReportDTO> =>
    client.get('/tenant/sales/reports/sales-by-item', { params }).then(unwrap<SalesByItemReportDTO>),

  getSalesBySalesperson: (params?: { fromDate?: string; toDate?: string }): Promise<SalesBySalespersonReportDTO> =>
    client.get('/tenant/sales/reports/sales-by-salesperson', { params }).then(unwrap<SalesBySalespersonReportDTO>),

  getGrossProfitByDocument: (params?: GrossProfitFilters): Promise<GrossProfitReportDTO> =>
    client.get('/tenant/sales/reports/gross-profit/by-document', { params: mapGrossProfitParams(params) }).then(unwrap<GrossProfitReportDTO>),

  getGrossProfitByItem: (params?: GrossProfitFilters): Promise<GrossProfitReportDTO> =>
    client.get('/tenant/sales/reports/gross-profit/by-item', { params: mapGrossProfitParams(params) }).then(unwrap<GrossProfitReportDTO>),
};
