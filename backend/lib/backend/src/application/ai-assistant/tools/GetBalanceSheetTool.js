"use strict";
/**
 * GetBalanceSheetTool - AI Tool for read-only Balance Sheet summaries
 *
 * Returns a sanitized summary of the Balance Sheet for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.balanceSheet.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetBalanceSheetTool = void 0;
const LedgerUseCases_1 = require("../../accounting/use-cases/LedgerUseCases");
class GetBalanceSheetTool {
    constructor(ledgerRepo, accountRepo, permissionChecker, companyRepo) {
        this.name = 'accounting.getBalanceSheet';
        this.description = 'Get a Balance Sheet summary for the company. Returns assets, liabilities, equity totals, and top accounts. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.balanceSheet.view';
        this.module = 'accounting';
        this.balanceSheetUseCase = new LedgerUseCases_1.GetBalanceSheetUseCase(ledgerRepo, accountRepo, permissionChecker, companyRepo);
    }
    async execute(context, params) {
        try {
            const asOfDate = (params === null || params === void 0 ? void 0 : params.asOfDate) || new Date().toISOString().split('T')[0];
            const result = await this.balanceSheetUseCase.execute(context.companyId, context.userId, asOfDate, false);
            // Sanitize: top 10 accounts per section by absolute balance
            const topAssets = result.assets.accounts
                .filter(a => !a.isParent)
                .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                .slice(0, 10)
                .map(a => ({ code: a.code, name: a.name, balance: a.balance }));
            const topLiabilities = result.liabilities.accounts
                .filter(a => !a.isParent)
                .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                .slice(0, 10)
                .map(a => ({ code: a.code, name: a.name, balance: a.balance }));
            const topEquity = result.equity.accounts
                .filter(a => !a.isParent)
                .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                .slice(0, 10)
                .map(a => ({ code: a.code, name: a.name, balance: a.balance }));
            const summary = {
                asOfDate: result.asOfDate,
                baseCurrency: result.baseCurrency,
                totalAssets: result.totalAssets,
                totalLiabilities: result.liabilities.total,
                totalEquity: result.equity.total,
                totalLiabilitiesAndEquity: result.totalLiabilitiesAndEquity,
                retainedEarnings: result.retainedEarnings,
                isBalanced: result.isBalanced,
                difference: Math.round((result.totalAssets - result.totalLiabilitiesAndEquity) * 100) / 100,
                topAssets,
                topLiabilities,
                topEquity,
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
                error: `Failed to retrieve balance sheet summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetBalanceSheetTool = GetBalanceSheetTool;
//# sourceMappingURL=GetBalanceSheetTool.js.map