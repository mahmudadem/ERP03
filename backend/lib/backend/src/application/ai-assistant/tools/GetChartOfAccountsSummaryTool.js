"use strict";
/**
 * GetChartOfAccountsSummaryTool - AI Tool for read-only Chart of Accounts summaries
 *
 * Returns a sanitized summary of the Chart of Accounts for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.accounts.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetChartOfAccountsSummaryTool = void 0;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetChartOfAccountsSummaryTool {
    constructor(accountRepo, permissionChecker) {
        this.name = 'accounting.getChartOfAccountsSummary';
        this.description = 'Get a summary of the Chart of Accounts for the company. Returns total accounts, breakdown by classification, and top accounts by balance. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.accounts.view';
        this.module = 'accounting';
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(context, params) {
        try {
            await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);
            const accounts = await this.accountRepo.list(context.companyId);
            // Count by classification
            const byClassification = {
                ASSET: 0,
                LIABILITY: 0,
                EQUITY: 0,
                REVENUE: 0,
                EXPENSE: 0,
            };
            for (const account of accounts) {
                const cls = (account.classification || 'EXPENSE');
                if (cls in byClassification) {
                    byClassification[cls]++;
                }
            }
            // Top 20 accounts by absolute balance (use netBalance if available)
            const topAccounts = accounts
                .map((a) => {
                var _a, _b;
                return ({
                    code: a.userCode || a.code || '',
                    name: a.name || '',
                    classification: a.classification || 'EXPENSE',
                    balance: round2((_b = (_a = a.netBalance) !== null && _a !== void 0 ? _a : a.balance) !== null && _b !== void 0 ? _b : 0),
                });
            })
                .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                .slice(0, 20);
            const summary = {
                totalAccounts: accounts.length,
                byClassification,
                topAccounts,
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
                error: `Failed to retrieve chart of accounts summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetChartOfAccountsSummaryTool = GetChartOfAccountsSummaryTool;
//# sourceMappingURL=GetChartOfAccountsSummaryTool.js.map