"use strict";
/**
 * GetTrialBalanceSummaryTool - AI Tool for read-only trial balance summaries
 *
 * This tool gives the AI Assistant access to trial balance summaries for
 * advisory purposes ONLY. It returns a sanitized summary DTO — never
 * raw database entities or full chart of account details.
 *
 * READ-ONLY ENFORCEMENT:
 * - This tool calls GetTrialBalanceUseCase which is a READ use case
 * - GetTrialBalanceUseCase already enforces permission checks internally
 * - This tool adds an additional permission layer (ai-assistant.tools.accounting.trial-balance)
 * - The result is summarized and sanitized before returning to the AI
 *
 * Company isolation is enforced through companyId scoping.
 * The AI receives only summary data it can use to advise the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetTrialBalanceSummaryTool = void 0;
const LedgerUseCases_1 = require("../../accounting/use-cases/LedgerUseCases");
class GetTrialBalanceSummaryTool {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.name = 'accounting.getTrialBalanceSummary';
        this.description = 'Get a summary of the trial balance for the company. Returns total debits, credits, balance status, and top accounts. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.trialBalance.view';
        this.module = 'accounting';
        this.trialBalanceUseCase = new LedgerUseCases_1.GetTrialBalanceUseCase(ledgerRepo, accountRepo, permissionChecker);
    }
    async execute(context, params) {
        var _a;
        try {
            // Extract params with defaults
            const asOfDate = (params === null || params === void 0 ? void 0 : params.asOfDate) || new Date().toISOString().split('T')[0];
            const includeZeroBalance = (_a = params === null || params === void 0 ? void 0 : params.includeZeroBalance) !== null && _a !== void 0 ? _a : false;
            // Call the existing use case with company and user context
            const result = await this.trialBalanceUseCase.execute(context.companyId, context.userId, asOfDate, includeZeroBalance, false);
            // Sanitize and summarize: limit to top 20 accounts by closing balance
            const sortedAccounts = [...result.data]
                .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
                .slice(0, 20);
            const summary = {
                asOfDate,
                isBalanced: result.meta.isBalanced,
                totalDebit: result.meta.totalClosingDebit,
                totalCredit: result.meta.totalClosingCredit,
                difference: result.meta.difference,
                accountCount: result.data.length,
                topAccounts: sortedAccounts.map(line => ({
                    code: line.code,
                    name: line.name,
                    classification: line.classification,
                    closingDebit: line.closingDebit,
                    closingCredit: line.closingCredit,
                    netBalance: line.netBalance,
                })),
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
                error: `Failed to retrieve trial balance summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetTrialBalanceSummaryTool = GetTrialBalanceSummaryTool;
//# sourceMappingURL=GetTrialBalanceSummaryTool.js.map