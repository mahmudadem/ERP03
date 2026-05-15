import { ReportDefinition } from '../../domain/reports/ReportDefinition';

export const ACCOUNTING_REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'accounting.profitAndLoss',
    title: 'Profit & Loss',
    moduleId: 'accounting',
    permission: 'accounting.reports.profitAndLoss.view',
    requiredParams: [],
    optionalParams: ['fromDate', 'toDate'],
    defaults: {},
    aiClarificationRules: [
      'Default to current month if no date range provided.',
      'Ask for cost center only when the user mentions cost center/department/project.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'Start date (YYYY-MM-DD). Defaults to current month start.' },
        toDate: { type: 'string', description: 'End date (YYYY-MM-DD). Defaults to current month end.' },
      },
    },
    maxRows: 50,
    dateBasis: 'period',
  },
  {
    id: 'accounting.trialBalance',
    title: 'Trial Balance',
    moduleId: 'accounting',
    permission: 'accounting.reports.trialBalance.view',
    requiredParams: [],
    optionalParams: ['asOfDate', 'includeZeroBalance'],
    defaults: { includeZeroBalance: false },
    aiClarificationRules: [
      'Default to today if no as-of date provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', description: 'As-of date (YYYY-MM-DD). Defaults to today.' },
        includeZeroBalance: { type: 'boolean', description: 'Include accounts with zero balance. Defaults to false.' },
      },
    },
    maxRows: 100,
    dateBasis: 'asOfDate',
  },
  {
    id: 'accounting.balanceSheet',
    title: 'Balance Sheet',
    moduleId: 'accounting',
    permission: 'accounting.reports.balanceSheet.view',
    requiredParams: [],
    optionalParams: ['asOfDate'],
    defaults: {},
    aiClarificationRules: [
      'Default to today if no as-of date provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', description: 'As-of date (YYYY-MM-DD). Defaults to today.' },
      },
    },
    maxRows: 50,
    dateBasis: 'asOfDate',
  },
  {
    id: 'accounting.cashFlow',
    title: 'Cash Flow Statement',
    moduleId: 'accounting',
    permission: 'accounting.reports.cashFlow.view',
    requiredParams: [],
    optionalParams: ['fromDate', 'toDate'],
    defaults: {},
    aiClarificationRules: [
      'Default to current month if no date range provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'Start date (YYYY-MM-DD). Defaults to current month start.' },
        toDate: { type: 'string', description: 'End date (YYYY-MM-DD). Defaults to current month end.' },
      },
    },
    maxRows: 0,
    dateBasis: 'period',
  },
  {
    id: 'accounting.generalLedger',
    title: 'General Ledger',
    moduleId: 'accounting',
    permission: 'accounting.reports.generalLedger.view',
    requiredParams: [],
    optionalParams: ['fromDate', 'toDate'],
    defaults: {},
    aiClarificationRules: [
      'Default to current month if no date range provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'Start date (YYYY-MM-DD). Defaults to current month start.' },
        toDate: { type: 'string', description: 'End date (YYYY-MM-DD). Defaults to current month end.' },
      },
    },
    maxRows: 50,
    dateBasis: 'period',
  },
  {
    id: 'accounting.accountStatement',
    title: 'Account Statement',
    moduleId: 'accounting',
    permission: 'accounting.reports.generalLedger.view',
    requiredParams: ['accountCode'],
    optionalParams: ['fromDate', 'toDate', 'costCenterId'],
    defaults: {},
    aiClarificationRules: [
      'Always ask which account if not specified.',
      'Default to current month if no date range provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        accountCode: { type: 'string', description: 'Account code (required). Ask the user which account.' },
        fromDate: { type: 'string', description: 'Start date (YYYY-MM-DD). Defaults to current month start.' },
        toDate: { type: 'string', description: 'End date (YYYY-MM-DD). Defaults to current month end.' },
        costCenterId: { type: 'string', description: 'Optional cost center filter.' },
      },
      required: ['accountCode'],
    },
    maxRows: 100,
    dateBasis: 'period',
  },
  {
    id: 'accounting.agingReceivables',
    title: 'Aging Receivables',
    moduleId: 'accounting',
    permission: 'accounting.reports.generalLedger.view',
    requiredParams: [],
    optionalParams: ['asOfDate', 'accountId'],
    defaults: {},
    aiClarificationRules: [
      'Default to today if no as-of date provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', description: 'As-of date (YYYY-MM-DD). Defaults to today.' },
        accountId: { type: 'string', description: 'Optional specific receivable account.' },
      },
    },
    maxRows: 50,
    dateBasis: 'asOfDate',
  },
  {
    id: 'accounting.agingPayables',
    title: 'Aging Payables',
    moduleId: 'accounting',
    permission: 'accounting.reports.generalLedger.view',
    requiredParams: [],
    optionalParams: ['asOfDate', 'accountId'],
    defaults: {},
    aiClarificationRules: [
      'Default to today if no as-of date provided.',
    ],
    paramSchema: {
      type: 'object',
      properties: {
        asOfDate: { type: 'string', description: 'As-of date (YYYY-MM-DD). Defaults to today.' },
        accountId: { type: 'string', description: 'Optional specific payable account.' },
      },
    },
    maxRows: 50,
    dateBasis: 'asOfDate',
  },
];

export function getReportDefinition(reportId: string): ReportDefinition | undefined {
  return ACCOUNTING_REPORT_DEFINITIONS.find(d => d.id === reportId);
}
