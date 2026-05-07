"use strict";
/**
 * GetAgingPayablesTool - AI Tool for read-only Accounts Payable Aging summaries
 *
 * Returns a sanitized summary of the AP Aging report for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAgingPayablesTool = void 0;
const AgingReportUseCase_1 = require("../../accounting/use-cases/AgingReportUseCase");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetAgingPayablesTool {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.name = 'accounting.getAgingPayables';
        this.description = 'Get an Accounts Payable aging summary for the company. Shows payables broken down by aging buckets (Current, 1-30, 31-60, etc.). Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.generalLedger.view';
        this.module = 'accounting';
        this.agingUseCase = new AgingReportUseCase_1.AgingReportUseCase(ledgerRepo, accountRepo, permissionChecker);
    }
    async execute(context, params) {
        try {
            const asOfDate = (params === null || params === void 0 ? void 0 : params.asOfDate) || new Date().toISOString().split('T')[0];
            const result = await this.agingUseCase.execute(context.companyId, context.userId, 'AP', asOfDate);
            // Sanitize: top 20 accounts by total, strip entries
            const topAccounts = result.accounts
                .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
                .slice(0, 20)
                .map(a => ({
                accountCode: a.accountCode,
                accountName: a.accountName,
                bucketAmounts: a.bucketAmounts.map(round2),
                total: round2(a.total),
            }));
            const summary = {
                asOfDate: result.asOfDate,
                type: 'AP',
                buckets: result.buckets,
                accounts: topAccounts,
                totals: result.totals.map(round2),
                grandTotal: round2(result.grandTotal),
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
                error: `Failed to retrieve AP aging summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetAgingPayablesTool = GetAgingPayablesTool;
//# sourceMappingURL=GetAgingPayablesTool.js.map