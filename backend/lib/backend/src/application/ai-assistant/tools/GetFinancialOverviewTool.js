"use strict";
/**
 * GetFinancialOverviewTool - AI Meta-Tool for combined financial overview
 *
 * Returns a combined summary of P&L, Balance Sheet, Cash Flow, and Aging
 * in a single call for quick financial health assessment.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetFinancialOverviewTool = void 0;
const GetProfitAndLossUseCase_1 = require("../../reporting/use-cases/GetProfitAndLossUseCase");
const LedgerUseCases_1 = require("../../accounting/use-cases/LedgerUseCases");
const CashFlowUseCases_1 = require("../../accounting/use-cases/CashFlowUseCases");
const AgingReportUseCase_1 = require("../../accounting/use-cases/AgingReportUseCase");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetFinancialOverviewTool {
    constructor(ledgerRepo, accountRepo, companyRepo, permissionChecker) {
        this.name = 'reports.getFinancialOverview';
        this.description = 'Get a combined financial overview for the company including P&L summary, Balance Sheet summary, Cash Flow summary, and Aging totals. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.view';
        this.module = 'reports';
        this.plUseCase = new GetProfitAndLossUseCase_1.GetProfitAndLossUseCase(ledgerRepo, accountRepo, permissionChecker);
        this.balanceSheetUseCase = new LedgerUseCases_1.GetBalanceSheetUseCase(ledgerRepo, accountRepo, permissionChecker, companyRepo);
        this.cashFlowUseCase = new CashFlowUseCases_1.GetCashFlowStatementUseCase(ledgerRepo, accountRepo, companyRepo, permissionChecker);
        this.agingUseCase = new AgingReportUseCase_1.AgingReportUseCase(ledgerRepo, accountRepo, permissionChecker);
    }
    async execute(context, params) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        try {
            const now = new Date();
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const asOfDate = toDate; // For BS, Cash, Aging we use toDate as asOfDate
            // Run all four queries in parallel for performance
            const [plResult, bsResult, cashResult, arResult, apResult] = await Promise.all([
                this.plUseCase.execute({
                    companyId: context.companyId,
                    userId: context.userId,
                    fromDate,
                    toDate,
                }).catch((err) => ({ __error: err.message })),
                this.balanceSheetUseCase.execute(context.companyId, context.userId, asOfDate, false).catch((err) => ({ __error: err.message })),
                this.cashFlowUseCase.execute(context.companyId, context.userId, fromDate, toDate, false).catch((err) => ({ __error: err.message })),
                this.agingUseCase.execute(context.companyId, context.userId, 'AR', asOfDate).catch((err) => ({ __error: err.message })),
                this.agingUseCase.execute(context.companyId, context.userId, 'AP', asOfDate).catch((err) => ({ __error: err.message })),
            ]);
            const isPlError = plResult.__error !== undefined;
            const isBsError = bsResult.__error !== undefined;
            const isCashError = cashResult.__error !== undefined;
            const isArError = arResult.__error !== undefined;
            const isApError = apResult.__error !== undefined;
            // If all fail, return error
            if (isPlError && isBsError && isCashError && isArError && isApError) {
                return {
                    success: false,
                    data: null,
                    error: `All financial data sources failed. P&L: ${plResult.__error}`,
                    errorCode: 'DATA_UNAVAILABLE',
                };
            }
            const summary = {
                pnl: isPlError
                    ? { revenue: 0, expenses: 0, netProfit: 0 }
                    : {
                        revenue: round2((_a = plResult.revenue) !== null && _a !== void 0 ? _a : 0),
                        expenses: round2((_b = plResult.expenses) !== null && _b !== void 0 ? _b : 0),
                        netProfit: round2((_c = plResult.netProfit) !== null && _c !== void 0 ? _c : 0),
                    },
                balanceSheet: isBsError
                    ? { totalAssets: 0, totalLiabilities: 0, totalEquity: 0, isBalanced: false }
                    : {
                        totalAssets: round2((_d = bsResult.totalAssets) !== null && _d !== void 0 ? _d : 0),
                        totalLiabilities: round2((_f = (_e = bsResult.liabilities) === null || _e === void 0 ? void 0 : _e.total) !== null && _f !== void 0 ? _f : 0),
                        totalEquity: round2((_h = (_g = bsResult.equity) === null || _g === void 0 ? void 0 : _g.total) !== null && _h !== void 0 ? _h : 0),
                        isBalanced: (_j = bsResult.isBalanced) !== null && _j !== void 0 ? _j : false,
                    },
                cash: isCashError
                    ? { netCashChange: 0, openingCashBalance: 0, closingCashBalance: 0 }
                    : {
                        netCashChange: round2((_k = cashResult.netCashChange) !== null && _k !== void 0 ? _k : 0),
                        openingCashBalance: round2((_l = cashResult.openingCashBalance) !== null && _l !== void 0 ? _l : 0),
                        closingCashBalance: round2((_m = cashResult.closingCashBalance) !== null && _m !== void 0 ? _m : 0),
                    },
                aging: {
                    totalReceivables: isArError ? 0 : round2(Math.abs((_o = arResult.grandTotal) !== null && _o !== void 0 ? _o : 0)),
                    totalPayables: isApError ? 0 : round2(Math.abs((_p = apResult.grandTotal) !== null && _p !== void 0 ? _p : 0)),
                },
            };
            return {
                success: true,
                data: summary,
            };
        }
        catch (error) {
            return {
                success: false,
                data: null,
                error: `Failed to retrieve financial overview: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetFinancialOverviewTool = GetFinancialOverviewTool;
//# sourceMappingURL=GetFinancialOverviewTool.js.map