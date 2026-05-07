"use strict";
/**
 * GetAccountStatementSummaryTool - AI Tool for read-only Account Statement summaries
 *
 * Returns a sanitized summary of a single account statement for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAccountStatementSummaryTool = void 0;
const LedgerUseCases_1 = require("../../accounting/use-cases/LedgerUseCases");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetAccountStatementSummaryTool {
    constructor(ledgerRepo, accountRepo, companyRepo, permissionChecker) {
        this.name = 'accounting.getAccountStatementSummary';
        this.description = 'Get an Account Statement summary for a specific account. Returns opening balance, total debit/credit, and closing balance for the period. Requires accountCode parameter. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.generalLedger.view';
        this.module = 'accounting';
        this.accountStatementUseCase = new LedgerUseCases_1.GetAccountStatementUseCase(ledgerRepo, permissionChecker, accountRepo, companyRepo);
        this.accountRepo = accountRepo;
    }
    async execute(context, params) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            const accountCode = params === null || params === void 0 ? void 0 : params.accountCode;
            if (!accountCode) {
                return {
                    success: false,
                    data: null,
                    error: 'accountCode is required for account statement summary',
                    errorCode: 'MISSING_PARAMETER',
                };
            }
            const now = new Date();
            const fromDate = (params === null || params === void 0 ? void 0 : params.fromDate) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const toDate = (params === null || params === void 0 ? void 0 : params.toDate) || now.toISOString().split('T')[0];
            // Resolve accountCode to accountId using the account repository
            const accounts = await this.accountRepo.list(context.companyId);
            const account = accounts.find((a) => a.userCode === accountCode || a.code === accountCode || a.systemCode === accountCode);
            if (!account) {
                return {
                    success: false,
                    data: null,
                    error: `Account not found with code: ${accountCode}`,
                    errorCode: 'DATA_UNAVAILABLE',
                };
            }
            const accountId = account.id;
            const result = await this.accountStatementUseCase.execute(context.companyId, context.userId, accountId, fromDate, toDate);
            const summary = {
                accountCode: result.accountCode || accountCode,
                accountName: result.accountName || account.name || 'Unknown',
                period: {
                    from: result.fromDate || fromDate,
                    to: result.toDate || toDate,
                },
                openingBalance: round2((_b = (_a = result.openingBalance) !== null && _a !== void 0 ? _a : result.openingBalanceBase) !== null && _b !== void 0 ? _b : 0),
                totalDebit: round2((_d = (_c = result.totalDebit) !== null && _c !== void 0 ? _c : result.totalBaseDebit) !== null && _d !== void 0 ? _d : 0),
                totalCredit: round2((_f = (_e = result.totalCredit) !== null && _e !== void 0 ? _e : result.totalBaseCredit) !== null && _f !== void 0 ? _f : 0),
                closingBalance: round2((_h = (_g = result.closingBalance) !== null && _g !== void 0 ? _g : result.closingBalanceBase) !== null && _h !== void 0 ? _h : 0),
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
                error: `Failed to retrieve account statement summary: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetAccountStatementSummaryTool = GetAccountStatementSummaryTool;
//# sourceMappingURL=GetAccountStatementSummaryTool.js.map