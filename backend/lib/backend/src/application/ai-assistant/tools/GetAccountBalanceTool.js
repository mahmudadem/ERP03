"use strict";
/**
 * GetAccountBalanceTool - AI Tool for read-only Account Balance lookups
 *
 * Returns the current balance of a specific account from the Trial Balance.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via accounting.reports.generalLedger.view (or wildcard *).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAccountBalanceTool = void 0;
const LedgerUseCases_1 = require("../../accounting/use-cases/LedgerUseCases");
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
class GetAccountBalanceTool {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.name = 'accounting.getAccountBalance';
        this.description = 'Get the balance of a specific account. Requires accountCode parameter. Optionally accepts asOfDate. Returns account code, name, classification, balance, debit, and credit. Read-only — cannot create, modify, or post anything.';
        this.requiredPermission = 'accounting.reports.generalLedger.view';
        this.module = 'accounting';
        this.trialBalanceUseCase = new LedgerUseCases_1.GetTrialBalanceUseCase(ledgerRepo, accountRepo, permissionChecker);
        this.accountRepo = accountRepo;
    }
    async execute(context, params) {
        try {
            const accountCode = params === null || params === void 0 ? void 0 : params.accountCode;
            if (!accountCode) {
                return {
                    success: false,
                    data: null,
                    error: 'accountCode is required for account balance lookup',
                    errorCode: 'MISSING_PARAMETER',
                };
            }
            const asOfDate = (params === null || params === void 0 ? void 0 : params.asOfDate) || new Date().toISOString().split('T')[0];
            // Find account by code
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
            const result = await this.trialBalanceUseCase.execute(context.companyId, context.userId, asOfDate, true, // includeZeroBalance
            false);
            // Find the specific account in the trial balance
            const tbLine = result.data.find((line) => line.accountId === account.id);
            const classification = account.classification || 'EXPENSE';
            // Compute balance: positive-by-nature
            let balance;
            let debit;
            let credit;
            if (tbLine) {
                debit = tbLine.closingDebit;
                credit = tbLine.closingCredit;
                if (['ASSET', 'EXPENSE'].includes(classification)) {
                    balance = debit - credit;
                }
                else {
                    balance = credit - debit;
                }
            }
            else {
                debit = 0;
                credit = 0;
                balance = 0;
            }
            const summary = {
                accountCode: account.userCode || account.code || accountCode,
                accountName: account.name || 'Unknown',
                classification,
                balance: round2(balance),
                debit: round2(debit),
                credit: round2(credit),
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
                error: `Failed to retrieve account balance: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.GetAccountBalanceTool = GetAccountBalanceTool;
//# sourceMappingURL=GetAccountBalanceTool.js.map