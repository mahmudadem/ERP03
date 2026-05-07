"use strict";
/**
 * GetProfitAndLossTool - AI Tool for read-only P&L (Income Statement) summaries
 *
 * Returns a sanitized summary of the Profit & Loss report for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.profitAndLoss.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetProfitAndLossTool = void 0;
const GetProfitAndLossUseCase_1 = require("../../reporting/use-cases/GetProfitAndLossUseCase");
class GetProfitAndLossTool {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.name = 'accounting.getProfitAndLoss';
        this.description = 'Get a Profit & Loss (Income Statement) summary for the company. Returns revenue, expenses, net profit, and breakdowns by account. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.profitAndLoss.view';
        this.module = 'accounting';
        this.plUseCase = new GetProfitAndLossUseCase_1.GetProfitAndLossUseCase(ledgerRepo, accountRepo, permissionChecker);
    }
    async execute(context, params) {
        try {
            // Default to current month if no dates provided
            const now = new Date();
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const result = await this.plUseCase.execute({
                companyId: context.companyId,
                userId: context.userId,
                fromDate,
                toDate,
            });
            // Sanitize: top 10 revenue accounts + top 10 expense accounts by absolute amount
            const topRevenue = result.revenueByAccount
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 10);
            const topExpenses = result.expensesByAccount
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 10);
            const summary = {
                period: result.period,
                revenue: result.revenue,
                expenses: result.expenses,
                netProfit: result.netProfit,
                revenueBreakdown: topRevenue.map(a => ({ accountName: a.accountName, amount: a.amount })),
                expensesBreakdown: topExpenses.map(a => ({ accountName: a.accountName, amount: a.amount })),
            };
            // Include structured view if available
            if (result.structured) {
                summary.structured = {
                    netSales: result.structured.netSales,
                    costOfSales: result.structured.costOfSales,
                    grossProfit: result.structured.grossProfit,
                    operatingExpenses: result.structured.operatingExpenses,
                    operatingProfit: result.structured.operatingProfit,
                    otherRevenue: result.structured.otherRevenue,
                    otherExpenses: result.structured.otherExpenses,
                };
            }
            return {
                success: true,
                data: summary,
            };
        }
        catch (error) {
            return {
                success: false,
                data: null,
                error: `Failed to retrieve P&L summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetProfitAndLossTool = GetProfitAndLossTool;
//# sourceMappingURL=GetProfitAndLossTool.js.map