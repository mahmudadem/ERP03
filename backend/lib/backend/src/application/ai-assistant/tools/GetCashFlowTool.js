"use strict";
/**
 * GetCashFlowTool - AI Tool for read-only Cash Flow Statement summaries
 *
 * Returns a sanitized summary of the Cash Flow Statement for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.cashFlow.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCashFlowTool = void 0;
const CashFlowUseCases_1 = require("../../accounting/use-cases/CashFlowUseCases");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetCashFlowTool {
    constructor(ledgerRepo, accountRepo, companyRepo, permissionChecker) {
        this.name = 'accounting.getCashFlowSummary';
        this.description = 'Get a Cash Flow Statement summary for the company. Returns operating, investing, and financing cash flows. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.cashFlow.view';
        this.module = 'accounting';
        this.cashFlowUseCase = new CashFlowUseCases_1.GetCashFlowStatementUseCase(ledgerRepo, accountRepo, companyRepo, permissionChecker);
    }
    async execute(context, params) {
        try {
            const now = new Date();
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const result = await this.cashFlowUseCase.execute(context.companyId, context.userId, fromDate, toDate, false);
            // Sanitize: limit items to top 10 per section by absolute amount
            const operatingItems = result.operating.items
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 10)
                .map(i => ({ name: i.name, amount: round2(i.amount) }));
            const investingItems = result.investing.items
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 10)
                .map(i => ({ name: i.name, amount: round2(i.amount) }));
            const financingItems = result.financing.items
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 10)
                .map(i => ({ name: i.name, amount: round2(i.amount) }));
            const summary = {
                period: result.period,
                baseCurrency: result.baseCurrency,
                netIncome: round2(result.netIncome),
                operating: {
                    total: round2(result.operating.total),
                    items: operatingItems,
                },
                investing: {
                    total: round2(result.investing.total),
                    items: investingItems,
                },
                financing: {
                    total: round2(result.financing.total),
                    items: financingItems,
                },
                netCashChange: round2(result.netCashChange),
                openingCashBalance: round2(result.openingCashBalance),
                closingCashBalance: round2(result.closingCashBalance),
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
                error: `Failed to retrieve cash flow summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetCashFlowTool = GetCashFlowTool;
//# sourceMappingURL=GetCashFlowTool.js.map