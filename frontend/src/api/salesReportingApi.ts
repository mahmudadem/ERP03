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
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerLedgerDTO {
  customerId: string;
  customerName: string;
  fromDate?: string;
  toDate?: string;
  openingBalance: number;
  events: LedgerEventDTO[];
  closingBalance: number;
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

export interface CustomerStatementDTO {
  customerId: string;
  customerName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: LedgerEventDTO[];
  totalInvoiced: number;
  totalPaid: number;
  openInvoices: OpenInvoiceSummaryDTO[];
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

// ─── unwrap helper ────────────────────────────────────────────────────────────

const unwrap = <T>(payload: any): T => (payload?.data ?? payload) as T;

// ─── API Object ──────────────────────────────────────────────────────────────

export const salesReportingApi = {
  getArAging: (params?: { asOfDate?: string; customerId?: string }): Promise<ArAgingReportDTO> =>
    client.get('/tenant/sales/reports/ar-aging', { params }).then(unwrap<ArAgingReportDTO>),

  getCustomerLedger: (params: { customerId: string; fromDate?: string; toDate?: string }): Promise<CustomerLedgerDTO> =>
    client.get('/tenant/sales/reports/customer-ledger', { params }).then(unwrap<CustomerLedgerDTO>),

  getCustomerStatement: (params: { customerId: string; fromDate: string; toDate: string }): Promise<CustomerStatementDTO> =>
    client.get('/tenant/sales/reports/customer-statement', { params }).then(unwrap<CustomerStatementDTO>),

  getSalesByCustomer: (params?: { fromDate?: string; toDate?: string }): Promise<SalesByCustomerReportDTO> =>
    client.get('/tenant/sales/reports/sales-by-customer', { params }).then(unwrap<SalesByCustomerReportDTO>),

  getSalesByItem: (params?: { fromDate?: string; toDate?: string }): Promise<SalesByItemReportDTO> =>
    client.get('/tenant/sales/reports/sales-by-item', { params }).then(unwrap<SalesByItemReportDTO>),

  getSalesBySalesperson: (params?: { fromDate?: string; toDate?: string }): Promise<SalesBySalespersonReportDTO> =>
    client.get('/tenant/sales/reports/sales-by-salesperson', { params }).then(unwrap<SalesBySalespersonReportDTO>),
};
