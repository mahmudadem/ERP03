"use strict";
/**
 * GetGeneralLedgerSummaryTool - AI Tool for read-only General Ledger summaries
 *
 * Returns a sanitized summary of the General Ledger for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetGeneralLedgerSummaryTool = void 0;
const LedgerUseCases_1 = require("../../accounting/use-cases/LedgerUseCases");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetGeneralLedgerSummaryTool {
    constructor(ledgerRepo, permissionChecker) {
        this.name = 'accounting.getGeneralLedgerSummary';
        this.description = 'Get a General Ledger summary for the company. Returns journal entries grouped by account for a given period. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.generalLedger.view';
        this.module = 'accounting';
        this.generalLedgerUseCase = new LedgerUseCases_1.GetGeneralLedgerUseCase(ledgerRepo, permissionChecker);
    }
    async execute(context, params) {
        var _a, _b, _c, _d;
        try {
            const now = new Date();
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const result = await this.generalLedgerUseCase.execute(context.companyId, context.userId, { fromDate, toDate });
            // Aggregate by account
            const accountMap = new Map();
            for (const entry of result) {
                const accId = entry.accountId || '';
                const existing = accountMap.get(accId) || { accountCode: entry.accountCode || '', accountName: entry.accountName || '', debit: 0, credit: 0 };
                existing.debit += Number((_b = (_a = entry.debit) !== null && _a !== void 0 ? _a : entry.baseDebit) !== null && _b !== void 0 ? _b : 0) || 0;
                existing.credit += Number((_d = (_c = entry.credit) !== null && _c !== void 0 ? _c : entry.baseCredit) !== null && _d !== void 0 ? _d : 0) || 0;
                accountMap.set(accId, existing);
            }
            // Sanitize: top 30 accounts by total absolute movement
            const accounts = Array.from(accountMap.entries())
                .map(([accountId, data]) => ({
                accountId,
                accountCode: data.accountCode,
                accountName: data.accountName,
                side: data.debit >= data.credit ? 'Debit' : 'Credit',
                amount: round2(Math.abs(data.debit - data.credit)),
            }))
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 30);
            const totalDebit = Array.from(accountMap.values()).reduce((sum, a) => sum + a.debit, 0);
            const totalCredit = Array.from(accountMap.values()).reduce((sum, a) => sum + a.credit, 0);
            const summary = {
                period: { from: fromDate, to: toDate },
                accounts,
                totalDebit: round2(totalDebit),
                totalCredit: round2(totalCredit),
                isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
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
                error: `Failed to retrieve general ledger summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetGeneralLedgerSummaryTool = GetGeneralLedgerSummaryTool;
//# sourceMappingURL=GetGeneralLedgerSummaryTool.js.map