import { ACCOUNTING_REPORT_DEFINITIONS } from '../../../reports/accountingReportDefinitions';
import { createReportToolClass } from './createReportTool';

const def = (id: string) => ACCOUNTING_REPORT_DEFINITIONS.find(d => d.id === id)!;

export const RunProfitAndLossTool = createReportToolClass(
  def('accounting.profitAndLoss'),
  'reports.profitAndLoss',
  'Run the authoritative Profit & Loss (Income Statement) report. Returns full revenue, expenses, net profit, and structured breakdown with report context and currency metadata. Uses the exact same data as the ERP UI report.',
);

export const RunTrialBalanceTool = createReportToolClass(
  def('accounting.trialBalance'),
  'reports.trialBalance',
  'Run the authoritative Trial Balance report. Returns all accounts with closing debit/credit balances and balance verification. Uses the exact same data as the ERP UI report.',
);

export const RunBalanceSheetTool = createReportToolClass(
  def('accounting.balanceSheet'),
  'reports.balanceSheet',
  'Run the authoritative Balance Sheet report. Returns assets, liabilities, equity totals, retained earnings, and balance verification. Uses the exact same data as the ERP UI report.',
);

export const RunCashFlowTool = createReportToolClass(
  def('accounting.cashFlow'),
  'reports.cashFlow',
  'Run the authoritative Cash Flow Statement report. Returns operating, investing, financing activities, net cash change, and opening/closing cash balances. Uses the exact same data as the ERP UI report.',
);

export const RunGeneralLedgerTool = createReportToolClass(
  def('accounting.generalLedger'),
  'reports.generalLedger',
  'Run the authoritative General Ledger report. Returns accounts with debit/credit totals aggregated by account for the period. Uses the exact same data as the ERP UI report.',
);

export const RunAccountStatementTool = createReportToolClass(
  def('accounting.accountStatement'),
  'reports.accountStatement',
  'Run the authoritative Account Statement report for a specific account. Requires accountCode parameter — ask the user which account. Returns opening balance, entries, totals, and closing balance. Uses the exact same data as the ERP UI report.',
);

export const RunAgingReceivablesTool = createReportToolClass(
  def('accounting.agingReceivables'),
  'reports.agingReceivables',
  'Run the authoritative Accounts Receivable Aging report. Returns receivable accounts grouped by aging buckets (Current, 1-30, 31-60, 61-90, 91-120, 120+ days). Uses the exact same data as the ERP UI report.',
);

export const RunAgingPayablesTool = createReportToolClass(
  def('accounting.agingPayables'),
  'reports.agingPayables',
  'Run the authoritative Accounts Payable Aging report. Returns payable accounts grouped by aging buckets (Current, 1-30, 31-60, 61-90, 91-120, 120+ days). Uses the exact same data as the ERP UI report.',
);

export const AUTHORITATIVE_REPORT_TOOL_NAMES = [
  'reports.profitAndLoss',
  'reports.trialBalance',
  'reports.balanceSheet',
  'reports.cashFlow',
  'reports.generalLedger',
  'reports.accountStatement',
  'reports.agingReceivables',
  'reports.agingPayables',
];

export const STANDARD_REPORT_TOOL_NAMES = [
  'accounting.getTrialBalanceSummary',
  'accounting.getProfitAndLoss',
  'accounting.getBalanceSheet',
  'accounting.getCashFlowSummary',
  'accounting.getAgingReceivables',
  'accounting.getAgingPayables',
  'accounting.getGeneralLedgerSummary',
  'accounting.getAccountStatementSummary',
];
