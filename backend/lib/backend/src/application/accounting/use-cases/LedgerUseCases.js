"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetJournalUseCase = exports.GetBalanceSheetUseCase = exports.GetGeneralLedgerUseCase = exports.GetTrialBalanceUseCase = exports.DeleteVoucherLedgerUseCase = void 0;
const Account_1 = require("../../../domain/accounting/entities/Account");
/**
 * DeleteVoucherLedgerUseCase
 *
 * Removes ledger entries for a voucher.
 * CAUTION: Should only be used for corrections/unposting where allowed by policy.
 * Standard accounting practice prefers reversal entries.
 */
class DeleteVoucherLedgerUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.cancel');
        await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
}
exports.DeleteVoucherLedgerUseCase = DeleteVoucherLedgerUseCase;
class GetTrialBalanceUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, asOfDate) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');
        return this.ledgerRepo.getTrialBalance(companyId, asOfDate);
    }
}
exports.GetTrialBalanceUseCase = GetTrialBalanceUseCase;
class GetGeneralLedgerUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        return this.ledgerRepo.getGeneralLedger(companyId, filters);
    }
}
exports.GetGeneralLedgerUseCase = GetGeneralLedgerUseCase;
class GetBalanceSheetUseCase {
    constructor(ledgerRepo, accountRepo, permissionChecker, companyRepo) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
        this.companyRepo = companyRepo;
    }
    async execute(companyId, userId, asOfDate) {
        var _a;
        const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.balanceSheet.view');
        const [trialBalance, accounts, company] = await Promise.all([
            this.ledgerRepo.getTrialBalance(companyId, effectiveDate),
            this.accountRepo.list(companyId),
            (_a = this.companyRepo) === null || _a === void 0 ? void 0 : _a.findById(companyId).catch(() => null)
        ]);
        const balanceMap = new Map();
        trialBalance.forEach((row) => {
            balanceMap.set(row.accountId, {
                debit: row.debit || 0,
                credit: row.credit || 0
            });
        });
        const getNetBalance = (account) => {
            const entry = balanceMap.get(account.id) || { debit: 0, credit: 0 };
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;
            const nature = account.balanceNature || (0, Account_1.getDefaultBalanceNature)(account.classification);
            if (nature === 'CREDIT') {
                return credit - debit;
            }
            if (nature === 'DEBIT') {
                return debit - credit;
            }
            // BOTH: fall back to classification direction
            return ['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.classification)
                ? credit - debit
                : debit - credit;
        };
        const buildSection = (classification) => {
            const relevantAccounts = accounts.filter((a) => a.classification === classification);
            const allowedParents = new Set(relevantAccounts.map((a) => a.id));
            const childrenMap = new Map();
            relevantAccounts.forEach((acc) => {
                const parentKey = acc.parentId && allowedParents.has(acc.parentId) ? acc.parentId : null;
                const bucket = childrenMap.get(parentKey) || [];
                bucket.push(acc);
                childrenMap.set(parentKey, bucket);
            });
            const sortAccounts = (a, b) => (a.userCode || '').localeCompare(b.userCode || '');
            const traverse = (parentId, level) => {
                const siblings = (childrenMap.get(parentId) || []).sort(sortAccounts);
                let subtotal = 0;
                const lines = [];
                siblings.forEach((acc) => {
                    const childResult = traverse(acc.id, level + 1);
                    const ownBalance = getNetBalance(acc);
                    const balance = ownBalance + childResult.subtotal;
                    const line = {
                        accountId: acc.id,
                        code: acc.userCode || acc.code || '',
                        name: acc.name,
                        parentId,
                        level,
                        balance,
                        isParent: childResult.lines.length > 0 || acc.accountRole === 'HEADER' || acc.hasChildren === true
                    };
                    lines.push(line, ...childResult.lines);
                    subtotal += balance;
                });
                return { lines, subtotal };
            };
            const { lines, subtotal } = traverse(null, 0);
            return { accounts: lines, total: subtotal };
        };
        const assets = buildSection('ASSET');
        const liabilities = buildSection('LIABILITY');
        const equity = buildSection('EQUITY');
        const revenueTotal = accounts
            .filter((a) => a.classification === 'REVENUE')
            .reduce((sum, acc) => sum + getNetBalance(acc), 0);
        const expenseTotal = accounts
            .filter((a) => a.classification === 'EXPENSE')
            .reduce((sum, acc) => sum + getNetBalance(acc), 0);
        const retainedEarnings = revenueTotal - expenseTotal;
        const retainedLine = {
            accountId: 'retained-earnings',
            code: 'RE',
            name: 'Retained Earnings',
            parentId: null,
            level: 0,
            balance: retainedEarnings,
            isParent: false
        };
        equity.accounts = [...equity.accounts, retainedLine];
        equity.total += retainedEarnings;
        const totalAssets = assets.total;
        const totalLiabilitiesAndEquity = liabilities.total + equity.total;
        return {
            asOfDate: effectiveDate,
            baseCurrency: (company === null || company === void 0 ? void 0 : company.baseCurrency) || '',
            assets,
            liabilities,
            equity,
            retainedEarnings,
            totalAssets,
            totalLiabilitiesAndEquity,
            isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
        };
    }
}
exports.GetBalanceSheetUseCase = GetBalanceSheetUseCase;
class GetJournalUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
        return this.ledgerRepo.getGeneralLedger(companyId, filters);
    }
}
exports.GetJournalUseCase = GetJournalUseCase;
//# sourceMappingURL=LedgerUseCases.js.map