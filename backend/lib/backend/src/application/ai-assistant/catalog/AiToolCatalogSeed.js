"use strict";
/**
 * AiToolCatalogSeed - Static seed for AI Tool Definitions
 *
 * This file defines EVERY tool that can exist in the system.
 * At startup, these definitions are registered in the AiToolRegistry
 * and stored in the tool catalog.
 *
 * RULES:
 * - WRITE tools (mode: 'write') are ALWAYS blocked and can NEVER execute.
 * - PROPOSAL tools are registered but disabled by default.
 * - READ-ONLY tools are the only executable tools.
 * - UNAVAILABLE tools have status 'unavailable' with a reason.
 * - Each tool has a namespace matching its module for policy management.
 *
 * IMPLEMENTED TOOLS:
 * - Only tools with a real implementation class registered in DI are marked
 *   `implemented = true`. All others are catalog-only definitions.
 * - Super Admin can see which tools are implemented vs planned.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockedDefinitions = exports.getDefinitionsByModule = exports.getExecutableDefinitions = exports.getCatalogDefinition = exports.AI_TOOL_CATALOG = void 0;
const AiToolDefinition_1 = require("../../../domain/ai-assistant/entities/AiToolDefinition");
// ─── Helper ──────────────────────────────────────────────────────────────────
const read_only = 'read-only';
const proposal = 'proposal';
const write_mode = 'write';
const active = 'active';
const disabled = 'disabled';
const unavailable = 'unavailable';
const deprecated = 'deprecated';
const R = 'low';
const R_M = 'medium';
const R_H = 'high';
const R_B = 'blocked';
const S_L = 'low';
const S_M = 'medium';
const S_H = 'high';
const noInput = { type: 'object', properties: {} };
const noOutput = { type: 'object', properties: {} };
// ─── Implemented Tools ────────────────────────────────────────────────────────
//
// Tool names that have a REAL implementation class registered in the DI container.
// All other tools are catalog-only definitions (they appear in the admin UI but
// return UNKNOWN_TOOL if invoked).
//
const IMPLEMENTED_TOOL_NAMES = new Set([
    'accounting.getTrialBalanceSummary',
    'accounting.getProfitAndLoss',
    'accounting.getBalanceSheet',
    'accounting.getCashFlowSummary',
    'accounting.getAgingReceivables',
    'accounting.getAgingPayables',
    'accounting.getGeneralLedgerSummary',
    'accounting.getAccountStatementSummary',
    'accounting.getChartOfAccountsSummary',
    'accounting.getAccountBalance',
    'accounting.getAccountingPeriodStatus',
    'sales.getSalesSummary',
    'sales.getTopCustomers',
    'purchase.getPurchaseSummary',
    'purchase.getTopSuppliers',
    'reports.getFinancialOverview',
    'reports.getMonthlyPerformanceSummary',
]);
// ─── ACCOUNTING — Accounts / COA ─────────────────────────────────────────────
const accountingAccountTools = [
    new AiToolDefinition_1.AiToolDefinition('accounting.getChartOfAccountsSummary', 'accounting.getChartOfAccountsSummary', 'accounting', 'accounting', 'Get a summary of the chart of accounts grouped by classification (assets, liabilities, equity, revenue, expense).', 'accounting', active, read_only, ['accounting.accounts.view'], ['accounting'], { type: 'object', properties: { includeInactive: { type: 'boolean', default: false } } }, { type: 'object', properties: { classifications: { type: 'array' }, totalAccounts: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.searchAccounts', 'accounting.searchAccounts', 'accounting', 'accounting', 'Search for accounts by code, name, or classification. Returns matching accounts up to a limit.', 'accounting', active, read_only, ['accounting.accounts.view'], ['accounting'], { type: 'object', properties: { query: { type: 'string' }, classification: { type: 'string' }, limit: { type: 'number', default: 20 } } }, { type: 'object', properties: { accounts: { type: 'array' }, total: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountByCode', 'accounting.getAccountByCode', 'accounting', 'accounting', 'Get account details by account code. Returns account name, classification, type, and current balance.', 'accounting', active, read_only, ['accounting.accounts.view'], ['accounting'], { type: 'object', properties: { code: { type: 'string' } } }, { type: 'object', properties: { account: { type: 'object' } } }, true, true, true, R, S_L),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountBalance', 'accounting.getAccountBalance', 'accounting', 'accounting', 'Get the current balance of a specific account by code or ID.', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], { type: 'object', properties: { accountCode: { type: 'string' }, asOfDate: { type: 'string' } } }, { type: 'object', properties: { balance: { type: 'number' }, accountCode: { type: 'string' }, accountName: { type: 'string' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountBalanceAsOfDate', 'accounting.getAccountBalanceAsOfDate', 'accounting', 'accounting', 'Get the balance of a specific account as of a given date.', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], { type: 'object', properties: { accountCode: { type: 'string' }, asOfDate: { type: 'string' } } }, { type: 'object', properties: { balance: { type: 'number' }, asOfDate: { type: 'string' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountStatementSummary', 'accounting.getAccountStatementSummary', 'accounting', 'accounting', 'Get an account statement summary for a specific account over a date range. Shows opening balance, total debits, total credits, and closing balance.', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], { type: 'object', properties: { accountCode: { type: 'string' }, fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { openingBalance: { type: 'number' }, totalDebit: { type: 'number' }, totalCredit: { type: 'number' }, closingBalance: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountStatementLines', 'accounting.getAccountStatementLines', 'accounting', 'accounting', 'Get detailed line items for an account statement over a date range.', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getInactiveAccountsWithBalance', 'accounting.getInactiveAccountsWithBalance', 'accounting', 'accounting', 'Find inactive accounts that still have non-zero balances. Useful for cleanup.', 'accounting', active, read_only, ['accounting.accounts.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountsMissingClassification', 'accounting.getAccountsMissingClassification', 'accounting', 'accounting', 'Find accounts that are missing classification data. Useful for data quality checks.', 'accounting', active, read_only, ['accounting.accounts.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_L),
];
// ─── ACCOUNTING — Vouchers ───────────────────────────────────────────────────
const accountingVoucherTools = [
    new AiToolDefinition_1.AiToolDefinition('accounting.getVoucherByNumber', 'accounting.getVoucherByNumber', 'accounting', 'accounting', 'Get voucher details by voucher number. Returns date, description, lines, and totals.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], { type: 'object', properties: { voucherNumber: { type: 'string' } } }, { type: 'object', properties: { voucher: { type: 'object' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getVoucherById', 'accounting.getVoucherById', 'accounting', 'accounting', 'Get voucher details by ID. Returns date, description, lines, and totals.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], { type: 'object', properties: { voucherId: { type: 'string' } } }, { type: 'object', properties: { voucher: { type: 'object' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.searchVouchers', 'accounting.searchVouchers', 'accounting', 'accounting', 'Search vouchers by date range, account, amount, or description. Returns matching voucher summaries.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getVoucherLines', 'accounting.getVoucherLines', 'accounting', 'accounting', 'Get the debit/credit lines of a specific voucher.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.explainVoucher', 'accounting.explainVoucher', 'accounting', 'accounting', 'Explain a voucher in plain language: what it does, which accounts it affects, and whether it is balanced.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, true, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getVoucherAccountingImpact', 'accounting.getVoucherAccountingImpact', 'accounting', 'accounting', 'Analyze the accounting impact of a voucher: which accounts increase/decrease and by how much.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findDuplicateVouchers', 'accounting.findDuplicateVouchers', 'accounting', 'accounting', 'Find potentially duplicate vouchers based on amount, date, and description similarity.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findUnbalancedVouchers', 'accounting.findUnbalancedVouchers', 'accounting', 'accounting', 'Find vouchers where total debits do not equal total credits. Useful for data quality checks.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findVouchersByAmount', 'accounting.findVouchersByAmount', 'accounting', 'accounting', 'Find vouchers by a specific amount or amount range.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findVouchersByAccount', 'accounting.findVouchersByAccount', 'accounting', 'accounting', 'Find all vouchers that involve a specific account within a date range.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findVouchersByDateRange', 'accounting.findVouchersByDateRange', 'accounting', 'accounting', 'Find all vouchers within a date range.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findUnpostedVouchers', 'accounting.findUnpostedVouchers', 'accounting', 'accounting', 'Find all unposted (draft) vouchers. Useful for review and approval workflows.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findPostedVouchers', 'accounting.findPostedVouchers', 'accounting', 'accounting', 'Find all posted vouchers within a date range.', 'accounting', active, read_only, ['accounting.vouchers.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
];
// ─── ACCOUNTING — Reports ────────────────────────────────────────────────────
const accountingReportTools = [
    new AiToolDefinition_1.AiToolDefinition('accounting.getTrialBalanceSummary', 'accounting.getTrialBalanceSummary', 'accounting', 'accounting', 'Get a Trial Balance summary with total debits, credits, and top accounts.', 'accounting', active, read_only, ['accounting.reports.trialBalance.view'], ['accounting'], { type: 'object', properties: { asOfDate: { type: 'string' } } }, { type: 'object', properties: { totalDebit: { type: 'number' }, totalCredit: { type: 'number' }, accounts: { type: 'array' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getProfitAndLoss', 'accounting.getProfitAndLoss', 'accounting', 'accounting', 'Get a Profit & Loss (Income Statement) summary with revenue, expenses, and net profit.', 'accounting', active, read_only, ['accounting.reports.profitAndLoss.view'], ['accounting'], { type: 'object', properties: { fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { revenue: { type: 'number' }, expenses: { type: 'number' }, netProfit: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getBalanceSheet', 'accounting.getBalanceSheet', 'accounting', 'accounting', 'Get a Balance Sheet summary with assets, liabilities, equity, and balance status.', 'accounting', active, read_only, ['accounting.reports.balanceSheet.view'], ['accounting'], { type: 'object', properties: { asOfDate: { type: 'string' } } }, { type: 'object', properties: { totalAssets: { type: 'number' }, totalLiabilities: { type: 'number' }, totalEquity: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getCashFlowSummary', 'accounting.getCashFlowSummary', 'accounting', 'accounting', 'Get a Cash Flow summary with operating, investing, and financing activities plus cash balances.', 'accounting', active, read_only, ['accounting.reports.cashFlow.view'], ['accounting'], { type: 'object', properties: { fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { operating: { type: 'number' }, investing: { type: 'number' }, financing: { type: 'number' }, netCashChange: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAgingReceivables', 'accounting.getAgingReceivables', 'accounting', 'accounting', 'Get Accounts Receivable aging report: balances grouped by aging buckets (Current, 1-30, 31-60, 61-90, 91-120, 120+ days).', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], { type: 'object', properties: { asOfDate: { type: 'string' } } }, { type: 'object', properties: { accounts: { type: 'array' }, grandTotal: { type: 'number' }, buckets: { type: 'array' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getAgingPayables', 'accounting.getAgingPayables', 'accounting', 'accounting', 'Get Accounts Payable aging report: balances grouped by aging buckets (Current, 1-30, 31-60, 61-90, 91-120, 120+ days).', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], { type: 'object', properties: { asOfDate: { type: 'string' } } }, { type: 'object', properties: { accounts: { type: 'array' }, grandTotal: { type: 'number' }, buckets: { type: 'array' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.getGeneralLedgerSummary', 'accounting.getGeneralLedgerSummary', 'accounting', 'accounting', 'Get a General Ledger summary showing all accounts and their debit/credit totals for a period.', 'accounting', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], { type: 'object', properties: { fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { entries: { type: 'array' }, totalDebit: { type: 'number' }, totalCredit: { type: 'number' } } }, true, true, true, R, S_M),
];
// ─── ACCOUNTING — Period / Validation ────────────────────────────────────────
const accountingValidationTools = [
    new AiToolDefinition_1.AiToolDefinition('accounting.getAccountingPeriodStatus', 'accounting.getAccountingPeriodStatus', 'accounting', 'accounting', 'Get the status of the current accounting period and fiscal year.', 'accounting', active, read_only, ['accounting.reports.view'], ['accounting'], { type: 'object', properties: { asOfDate: { type: 'string', description: 'Optional date to check period status for (ISO 8601)' } } }, { type: 'object', properties: { fiscalYearId: { type: 'string' }, periodName: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, status: { type: 'string', enum: ['open', 'closed', 'pending'] }, isLocked: { type: 'boolean' } } }, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.validatePeriodConsistency', 'accounting.validatePeriodConsistency', 'accounting', 'accounting', 'Validate period consistency: check for unbalanced entries, missing exchange rates, and date anomalies.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.checkOpeningBalances', 'accounting.checkOpeningBalances', 'accounting', 'accounting', 'Verify that opening balances for the current fiscal year are correct and balanced.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.checkDebitCreditBalance', 'accounting.checkDebitCreditBalance', 'accounting', 'accounting', 'Check that all accounts have balanced debit and credit totals.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findTransactionsOutsideFiscalYear', 'accounting.findTransactionsOutsideFiscalYear', 'accounting', 'accounting', 'Find transactions dated outside the active fiscal year.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findMissingExchangeRates', 'accounting.findMissingExchangeRates', 'accounting', 'accounting', 'Find currency transactions that are missing exchange rate data.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findSuspiciousEntries', 'accounting.findSuspiciousEntries', 'accounting', 'accounting', 'Find ledger entries that appear suspicious: unusually large amounts, round numbers, or unusual dates.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.findLargeUnusualMovements', 'accounting.findLargeUnusualMovements', 'accounting', 'accounting', 'Find account movements that are unusually large compared to historical averages.', 'accounting', disabled, read_only, ['accounting.reports.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
];
// ─── ACCOUNTING PROPOSAL TOOLS (disabled by default) ────────────────────────
const accountingProposalTools = [
    new AiToolDefinition_1.AiToolDefinition('accounting.proposeVoucherDraft', 'accounting.proposeVoucherDraft', 'accounting', 'accounting', 'AI proposes a voucher draft based on user description. Does NOT create or post the voucher.', 'accounting', disabled, proposal, ['accounting.vouchers.create'], ['accounting'], noInput, noOutput, false, true, true, R_H, S_H),
    new AiToolDefinition_1.AiToolDefinition('accounting.proposeJournalEntry', 'accounting.proposeJournalEntry', 'accounting', 'accounting', 'AI proposes a journal entry based on user description. Does NOT create or post the entry.', 'accounting', disabled, proposal, ['accounting.vouchers.create'], ['accounting'], noInput, noOutput, false, true, true, R_H, S_H),
    new AiToolDefinition_1.AiToolDefinition('accounting.proposeCorrectionEntry', 'accounting.proposeCorrectionEntry', 'accounting', 'accounting', 'AI proposes a correction entry for a given voucher. Does NOT create or post the correction.', 'accounting', disabled, proposal, ['accounting.vouchers.create'], ['accounting'], noInput, noOutput, false, true, true, R_H, S_H),
    new AiToolDefinition_1.AiToolDefinition('accounting.proposeAccountMapping', 'accounting.proposeAccountMapping', 'accounting', 'accounting', 'AI suggests account codes for a given description. Read-only suggestion.', 'accounting', disabled, proposal, ['accounting.accounts.view'], ['accounting'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('accounting.proposeReclassification', 'accounting.proposeReclassification', 'accounting', 'accounting', 'AI suggests reclassification of transactions. Does NOT create or post anything.', 'accounting', disabled, proposal, ['accounting.accounts.view'], ['accounting'], noInput, noOutput, false, true, true, R_H, S_H),
    new AiToolDefinition_1.AiToolDefinition('accounting.proposePeriodAdjustment', 'accounting.proposePeriodAdjustment', 'accounting', 'accounting', 'AI suggests period adjustment entries. Does NOT create or post anything.', 'accounting', disabled, proposal, ['accounting.accounts.view'], ['accounting'], noInput, noOutput, false, true, true, R_H, S_H),
];
// ─── INVENTORY READ-ONLY TOOLS ────────────────────────────────────────────────
const inventoryTools = [
    new AiToolDefinition_1.AiToolDefinition('inventory.getItemStockBalance', 'inventory.getItemStockBalance', 'inventory', 'inventory', 'Get the current stock balance for a specific item across all warehouses.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], { type: 'object', properties: { itemCode: { type: 'string' } } }, { type: 'object', properties: { totalQty: { type: 'number' }, totalValue: { type: 'number' }, warehouses: { type: 'array' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.getLowStockItems', 'inventory.getLowStockItems', 'inventory', 'inventory', 'Get items that are at or below their minimum stock level.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.getOutOfStockItems', 'inventory.getOutOfStockItems', 'inventory', 'inventory', 'Get items that are completely out of stock.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.getInventoryValuationSummary', 'inventory.getInventoryValuationSummary', 'inventory', 'inventory', 'Get a summary of total inventory valuation across all items and warehouses.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.getWarehouseSummary', 'inventory.getWarehouseSummary', 'inventory', 'inventory', 'Get a summary of stock levels per warehouse.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.searchItems', 'inventory.searchItems', 'inventory', 'inventory', 'Search for inventory items by code, name, or category.', 'inventory', active, read_only, ['inventory.items.view'], ['inventory'], { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number', default: 20 } } }, { type: 'object', properties: { items: { type: 'array' }, total: { type: 'number' } } }, true, true, true, R, S_L),
    // Unavailable inventory tools (underlying features not fully implemented)
    new AiToolDefinition_1.AiToolDefinition('inventory.getItemByCode', 'inventory.getItemByCode', 'inventory', 'inventory', 'Get item details by item code.', 'inventory', active, read_only, ['inventory.items.view'], ['inventory'], noInput, noOutput, true, true, true, R, S_L),
    new AiToolDefinition_1.AiToolDefinition('inventory.getItemStockByWarehouse', 'inventory.getItemStockByWarehouse', 'inventory', 'inventory', 'Get stock balance for a specific item in a specific warehouse.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.getStockMovementSummary', 'inventory.getStockMovementSummary', 'inventory', 'inventory', 'Get a summary of stock movements for a date range.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.getOverstockItems', 'inventory.getOverstockItems', 'inventory', 'inventory', 'Get items that exceed their maximum stock level.', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.findItemsWithoutCost', 'inventory.findItemsWithoutCost', 'inventory', 'inventory', 'Find inventory items that have no cost basis assigned.', 'inventory', active, read_only, ['inventory.items.view'], ['inventory'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.findNegativeStockItems', 'inventory.findNegativeStockItems', 'inventory', 'inventory', 'Find items with negative stock balances (data quality issue).', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R_M, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.findSlowMovingItems', 'inventory.findSlowMovingItems', 'inventory', 'inventory', 'Find items with low sales velocity (slow-moving inventory).', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('inventory.findFastMovingItems', 'inventory.findFastMovingItems', 'inventory', 'inventory', 'Find items with high sales velocity (fast-moving inventory).', 'inventory', active, read_only, ['inventory.stockLevels.view'], ['inventory'], noInput, noOutput, false, true, true, R, S_M),
];
// ─── SALES READ-ONLY TOOLS ───────────────────────────────────────────────────
const salesTools = [
    new AiToolDefinition_1.AiToolDefinition('sales.getSalesSummary', 'sales.getSalesSummary', 'sales', 'sales', 'Get a sales summary: total revenue, invoice count, average invoice value, and period breakdown.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], { type: 'object', properties: { fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { totalRevenue: { type: 'number' }, invoiceCount: { type: 'number' }, averageValue: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getTopCustomers', 'sales.getTopCustomers', 'sales', 'sales', 'Get top customers ranked by total revenue with their invoice counts and amounts.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], { type: 'object', properties: { limit: { type: 'number', default: 10 }, fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { customers: { type: 'array' }, total: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getTopSellingItems', 'sales.getTopSellingItems', 'sales', 'sales', 'Get top-selling items ranked by quantity or revenue.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getUnpaidInvoices', 'sales.getUnpaidInvoices', 'sales', 'sales', 'Get a list of unpaid sales invoices with customer, amount, and due date.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], { type: 'object', properties: { limit: { type: 'number', default: 20 } } }, { type: 'object', properties: { invoices: { type: 'array' }, totalOutstanding: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getOverdueCustomerInvoices', 'sales.getOverdueCustomerInvoices', 'sales', 'sales', 'Get sales invoices that are past their due date, grouped by customer.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getSalesByCustomer', 'sales.getSalesByCustomer', 'sales', 'sales', 'Get sales breakdown by customer for a date range.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getSalesByPeriod', 'sales.getSalesByPeriod', 'sales', 'sales', 'Get sales revenue grouped by period (daily, weekly, monthly).', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getCustomerSalesHistory', 'sales.getCustomerSalesHistory', 'sales', 'sales', 'Get the sales history for a specific customer.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.getSalesReturnsSummary', 'sales.getSalesReturnsSummary', 'sales', 'sales', 'Get a summary of sales returns for a period.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('sales.explainSalesInvoice', 'sales.explainSalesInvoice', 'sales', 'sales', 'Explain a sales invoice in plain language: items, amounts, tax, payment status.', 'sales', active, read_only, ['sales.invoices.view'], ['sales'], noInput, noOutput, false, true, true, R_M, S_M),
];
// ─── PURCHASE READ-ONLY TOOLS ────────────────────────────────────────────────
const purchaseTools = [
    new AiToolDefinition_1.AiToolDefinition('purchase.getPurchaseSummary', 'purchase.getPurchaseSummary', 'purchases', 'purchases', 'Get a purchase summary: total spend, invoice count, average invoice value, and period breakdown.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], { type: 'object', properties: { fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { totalSpend: { type: 'number' }, invoiceCount: { type: 'number' }, averageValue: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getTopSuppliers', 'purchase.getTopSuppliers', 'purchases', 'purchases', 'Get top suppliers ranked by total spend with their invoice counts and amounts.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], { type: 'object', properties: { limit: { type: 'number', default: 10 }, fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { suppliers: { type: 'array' }, total: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getUnpaidSupplierInvoices', 'purchase.getUnpaidSupplierInvoices', 'purchases', 'purchases', 'Get a list of unpaid purchase invoices with vendor, amount, and due date.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], { type: 'object', properties: { limit: { type: 'number', default: 20 } } }, { type: 'object', properties: { invoices: { type: 'array' }, totalOutstanding: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getOverdueSupplierInvoices', 'purchase.getOverdueSupplierInvoices', 'purchases', 'purchases', 'Get purchase invoices that are past their due date, grouped by supplier.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getPurchasesBySupplier', 'purchase.getPurchasesBySupplier', 'purchases', 'purchases', 'Get purchase breakdown by supplier for a date range.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getPurchasesByPeriod', 'purchase.getPurchasesByPeriod', 'purchases', 'purchases', 'Get purchase spend grouped by period (daily, weekly, monthly).', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getSupplierPurchaseHistory', 'purchase.getSupplierPurchaseHistory', 'purchases', 'purchases', 'Get purchase history for a specific supplier.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.getPurchaseReturnsSummary', 'purchase.getPurchaseReturnsSummary', 'purchases', 'purchases', 'Get a summary of purchase returns for a period.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], noInput, noOutput, false, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('purchase.explainPurchaseInvoice', 'purchase.explainPurchaseInvoice', 'purchases', 'purchases', 'Explain a purchase invoice in plain language: items, amounts, tax, payment status.', 'purchases', active, read_only, ['purchases.invoices.view'], ['purchases'], noInput, noOutput, false, true, true, R_M, S_M),
];
// ─── CRM (UNAVAILABLE) ──────────────────────────────────────────────────────
const crmTools = [
    new AiToolDefinition_1.AiToolDefinition('crm.getCustomerProfile', 'crm.getCustomerProfile', 'crm', 'crm', 'Get customer profile and balance summary.', 'crm', unavailable, read_only, ['crm.customers.view'], ['crm'], noInput, noOutput, false, true, true, R, S_M, 'CRM module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('crm.searchCustomers', 'crm.searchCustomers', 'crm', 'crm', 'Search customers by name, code, or phone.', 'crm', unavailable, read_only, ['crm.customers.view'], ['crm'], noInput, noOutput, false, true, true, R, S_M, 'CRM module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('crm.getTopCustomersByRevenue', 'crm.getTopCustomersByRevenue', 'crm', 'crm', 'Get top customers ranked by total revenue.', 'crm', unavailable, read_only, ['crm.customers.view'], ['crm'], noInput, noOutput, false, true, true, R, S_M, 'CRM module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('crm.getCustomerOpenInvoices', 'crm.getCustomerOpenInvoices', 'crm', 'crm', 'Get open/unpaid invoices for a specific customer.', 'crm', unavailable, read_only, ['crm.customers.view'], ['crm'], noInput, noOutput, false, true, true, R, S_M, 'CRM module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('crm.getCustomerOverdueInvoices', 'crm.getCustomerOverdueInvoices', 'crm', 'crm', 'Get overdue invoices for a specific customer.', 'crm', unavailable, read_only, ['crm.customers.view'], ['crm'], noInput, noOutput, false, true, true, R, S_M, 'CRM module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('crm.getInactiveCustomers', 'crm.getInactiveCustomers', 'crm', 'crm', 'Find customers with no recent activity.', 'crm', unavailable, read_only, ['crm.customers.view'], ['crm'], noInput, noOutput, false, true, true, R, S_M, 'CRM module not yet implemented'),
];
// ─── HR (UNAVAILABLE) ────────────────────────────────────────────────────────
const hrTools = [
    new AiToolDefinition_1.AiToolDefinition('hr.getEmployeeProfile', 'hr.getEmployeeProfile', 'hr', 'hr', 'Get employee profile information.', 'hr', unavailable, read_only, ['hr.employees.view'], ['hr'], noInput, noOutput, false, true, true, R, S_M, 'HR module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('hr.getAttendanceSummary', 'hr.getAttendanceSummary', 'hr', 'hr', 'Get attendance summary for a period.', 'hr', unavailable, read_only, ['hr.attendance.view'], ['hr'], noInput, noOutput, false, true, true, R, S_M, 'HR module not yet implemented'),
    new AiToolDefinition_1.AiToolDefinition('hr.getDepartmentSummary', 'hr.getDepartmentSummary', 'hr', 'hr', 'Get department headcount and summary.', 'hr', unavailable, read_only, ['hr.employees.view'], ['hr'], noInput, noOutput, false, true, true, R, S_M, 'HR module not yet implemented'),
];
// ─── REPORTS / BI ────────────────────────────────────────────────────────────
const reportsTools = [
    new AiToolDefinition_1.AiToolDefinition('reports.getFinancialOverview', 'reports.getFinancialOverview', 'accounting', 'accounting', 'Get a comprehensive financial overview combining P&L, balance sheet, cash position, and aging summaries in one call.', 'reports', active, read_only, ['accounting.reports.view'], ['accounting'], { type: 'object', properties: { asOfDate: { type: 'string' } } }, { type: 'object', properties: { pnl: { type: 'object' }, balanceSheet: { type: 'object' }, cashPosition: { type: 'object' }, aging: { type: 'object' } } }, true, true, true, R, S_H),
    new AiToolDefinition_1.AiToolDefinition('reports.getMonthlyPerformanceSummary', 'reports.getMonthlyPerformanceSummary', 'accounting', 'accounting', 'Get monthly P&L trends showing revenue, expenses, and profit by month for a date range.', 'reports', active, read_only, ['accounting.reports.profitAndLoss.view'], ['accounting'], { type: 'object', properties: { fromDate: { type: 'string' }, toDate: { type: 'string' } } }, { type: 'object', properties: { months: { type: 'array' }, totalRevenue: { type: 'number' }, totalExpenses: { type: 'number' }, totalProfit: { type: 'number' } } }, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('reports.getCashPositionSummary', 'reports.getCashPositionSummary', 'accounting', 'accounting', 'Get current cash position: total cash balance, receivables, and payables.', 'reports', active, read_only, ['accounting.reports.cashFlow.view'], ['accounting'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('reports.getReceivablesPayablesOverview', 'reports.getReceivablesPayablesOverview', 'accounting', 'accounting', 'Get an overview of accounts receivable and accounts payable totals with aging.', 'reports', active, read_only, ['accounting.reports.generalLedger.view'], ['accounting'], noInput, noOutput, true, true, true, R, S_M),
    new AiToolDefinition_1.AiToolDefinition('reports.comparePeriodPerformance', 'reports.comparePeriodPerformance', 'accounting', 'accounting', 'Compare P&L performance across two periods (e.g., this month vs. last month, this year vs. last year).', 'reports', active, read_only, ['accounting.reports.profitAndLoss.view'], ['accounting'], { type: 'object', properties: { period1From: { type: 'string' }, period1To: { type: 'string' }, period2From: { type: 'string' }, period2To: { type: 'string' } } }, { type: 'object', properties: { period1: { type: 'object' }, period2: { type: 'object' }, delta: { type: 'object' } } }, true, true, true, R, S_M),
];
// ─── AUDIT TOOLS (disabled by default — sensitive) ───────────────────────────
const auditTools = [
    new AiToolDefinition_1.AiToolDefinition('audit.getRecentActivity', 'audit.getRecentActivity', 'system', 'system', 'Get recent audit log entries for the company.', 'audit', disabled, read_only, ['system.audit.view'], ['system'], noInput, noOutput, false, true, true, R_H, S_H),
    new AiToolDefinition_1.AiToolDefinition('audit.findLargeTransactions', 'audit.findLargeTransactions', 'system', 'system', 'Find unusually large transactions in the audit log.', 'audit', disabled, read_only, ['system.audit.view'], ['system'], noInput, noOutput, false, true, true, R_H, S_H),
    new AiToolDefinition_1.AiToolDefinition('audit.findBackdatedTransactions', 'audit.findBackdatedTransactions', 'system', 'system', 'Find transactions that were created with past-dated timestamps.', 'audit', disabled, read_only, ['system.audit.view'], ['system'], noInput, noOutput, false, true, true, R_H, S_H),
];
// ─── PLATFORM / SUPER ADMIN TOOLS ───────────────────────────────────────────
const platformTools = [
    new AiToolDefinition_1.AiToolDefinition('platform.getRegisteredModules', 'platform.getRegisteredModules', 'platform', 'platform', 'Get a list of all registered platform modules and their status.', 'platform', active, read_only, ['platform.modules.view'], ['platform'], noInput, noOutput, false, true, true, R, S_L),
    new AiToolDefinition_1.AiToolDefinition('platform.getSystemUsageSummary', 'platform.getSystemUsageSummary', 'platform', 'platform', 'Get system-wide usage summary across all companies.', 'platform', active, read_only, ['platform.companies.view'], ['platform'], noInput, noOutput, false, true, true, R, S_M),
];
// ─── BLOCKED WRITE/MUTATION TOOL PATTERNS ────────────────────────────────────
// These are explicitly registered as BLOCKED to prevent any attempt to
// create, update, delete, post, approve, reverse, cancel, void, pay,
// collect, or transfer data through the AI.
const blockedWritePatterns = [
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.create', 'BLOCKED.create', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never create records. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.update', 'BLOCKED.update', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never update records. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.delete', 'BLOCKED.delete', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never delete records. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.post', 'BLOCKED.post', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never post records. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.approve', 'BLOCKED.approve', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never approve records. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.reverse', 'BLOCKED.reverse', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never reverse records. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
    new AiToolDefinition_1.AiToolDefinition('BLOCKED.pay', 'BLOCKED.pay', 'BLOCKED', 'BLOCKED', 'BLOCKED — AI must never pay or collect. This pattern is explicitly blocked.', 'BLOCKED', disabled, write_mode, [], [], noInput, noOutput, false, false, false, R_B, S_H, 'Write tools are permanently blocked for safety.'),
];
// ─── FULL CATALOG ─────────────────────────────────────────────────────────────
exports.AI_TOOL_CATALOG = [
    ...accountingAccountTools,
    ...accountingVoucherTools,
    ...accountingReportTools,
    ...accountingValidationTools,
    ...accountingProposalTools,
    ...inventoryTools,
    ...salesTools,
    ...purchaseTools,
    ...crmTools,
    ...hrTools,
    ...reportsTools,
    ...auditTools,
    ...platformTools,
    ...blockedWritePatterns,
];
// Mark implemented tools — those with a real backend class registered in DI.
for (const tool of exports.AI_TOOL_CATALOG) {
    if (IMPLEMENTED_TOOL_NAMES.has(tool.name)) {
        tool.implemented = true;
    }
}
/**
 * Get a catalog definition by tool name.
 * Used to look up definitions when building policies or checking enablement.
 */
function getCatalogDefinition(name) {
    return exports.AI_TOOL_CATALOG.find(d => d.name === name);
}
exports.getCatalogDefinition = getCatalogDefinition;
/**
 * Get all executable (active, read-only) tool definitions.
 */
function getExecutableDefinitions() {
    return exports.AI_TOOL_CATALOG.filter(d => d.isExecutable);
}
exports.getExecutableDefinitions = getExecutableDefinitions;
/**
 * Get all tool definitions for a specific module.
 */
function getDefinitionsByModule(moduleId) {
    return exports.AI_TOOL_CATALOG.filter(d => d.moduleId === moduleId);
}
exports.getDefinitionsByModule = getDefinitionsByModule;
/**
 * Get all blocked write-pattern tool definitions.
 */
function getBlockedDefinitions() {
    return exports.AI_TOOL_CATALOG.filter(d => d.isBlocked);
}
exports.getBlockedDefinitions = getBlockedDefinitions;
//# sourceMappingURL=AiToolCatalogSeed.js.map