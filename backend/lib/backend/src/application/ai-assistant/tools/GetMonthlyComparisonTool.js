"use strict";
/**
 * GetMonthlyComparisonTool - AI Tool for read-only Monthly P&L Comparison
 *
 * Returns P&L metrics broken down by month for the given period,
 * enabling trend analysis and period-over-period comparison.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.profitAndLoss.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMonthlyComparisonTool = void 0;
const GetProfitAndLossUseCase_1 = require("../../reporting/use-cases/GetProfitAndLossUseCase");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetMonthlyComparisonTool {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.name = 'reports.getMonthlyPerformanceSummary';
        this.description = 'Get a monthly P&L performance comparison for the company. Returns revenue, expenses, and net profit broken down by month. Optionally accepts fromDate and toDate. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.profitAndLoss.view';
        this.module = 'reports';
        this.plUseCase = new GetProfitAndLossUseCase_1.GetProfitAndLossUseCase(ledgerRepo, accountRepo, permissionChecker);
    }
    async execute(context, params) {
        try {
            const now = new Date();
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
            // Generate list of months between fromDate and toDate
            const months = [];
            const start = new Date(fromDate + 'T00:00:00');
            const end = new Date(toDate + 'T00:00:00');
            const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
            while (cursor <= end) {
                const year = cursor.getFullYear();
                const month = cursor.getMonth(); // 0-indexed
                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month + 1, 0); // last day of month
                const label = `${year}-${String(month + 1).padStart(2, '0')}`;
                months.push({
                    year,
                    month,
                    label,
                    start: monthStart.toISOString().split('T')[0],
                    end: monthEnd.toISOString().split('T')[0],
                });
                cursor.setMonth(cursor.getMonth() + 1);
            }
            // Run P&L for each month
            const results = await Promise.all(months.map(async (m) => {
                try {
                    const result = await this.plUseCase.execute({
                        companyId: context.companyId,
                        userId: context.userId,
                        fromDate: m.start,
                        toDate: m.end,
                    });
                    return {
                        month: m.label,
                        revenue: round2(result.revenue),
                        expenses: round2(result.expenses),
                        netProfit: round2(result.netProfit),
                    };
                }
                catch (_a) {
                    return {
                        month: m.label,
                        revenue: 0,
                        expenses: 0,
                        netProfit: 0,
                    };
                }
            }));
            const totalRevenue = round2(results.reduce((sum, r) => sum + r.revenue, 0));
            const totalExpenses = round2(results.reduce((sum, r) => sum + r.expenses, 0));
            const totalProfit = round2(results.reduce((sum, r) => sum + r.netProfit, 0));
            const summary = {
                months: results,
                totalRevenue,
                totalExpenses,
                totalProfit,
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
                error: `Failed to retrieve monthly comparison: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetMonthlyComparisonTool = GetMonthlyComparisonTool;
//# sourceMappingURL=GetMonthlyComparisonTool.js.map