"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetJournalUseCase = exports.GetBalanceSheetUseCase = exports.GetAccountStatementUseCase = exports.GetGeneralLedgerUseCase = exports.GetTrialBalanceUseCase = exports.DeleteVoucherLedgerUseCase = void 0;
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
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, asOfDate, includeZeroBalance = false) {
        const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');
        const [rawTB, accounts] = await Promise.all([
            this.ledgerRepo.getTrialBalance(companyId, effectiveDate),
            this.accountRepo.list(companyId)
        ]);
        // Build account lookup
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        // Build balance lookup from ledger
        const balanceMap = new Map();
        rawTB.forEach((row) => {
            balanceMap.set(row.accountId, { debit: row.debit || 0, credit: row.credit || 0 });
        });
        // Enrich: join ledger data with COA — build ALL lines first
        const allLines = [];
        for (const account of accounts) {
            const bal = balanceMap.get(account.id) || { debit: 0, credit: 0 };
            const totalDebit = bal.debit;
            const totalCredit = bal.credit;
            const closingDebit = Math.max(0, totalDebit - totalCredit);
            const closingCredit = Math.max(0, totalCredit - totalDebit);
            // Legacy netBalance: positive-by-nature
            const classification = account.classification || 'EXPENSE';
            let netBalance;
            if (['ASSET', 'EXPENSE'].includes(classification)) {
                netBalance = totalDebit - totalCredit;
            }
            else {
                netBalance = totalCredit - totalDebit;
            }
            allLines.push({
                accountId: account.id,
                code: account.userCode || account.code || '',
                name: account.name || '',
                classification,
                totalDebit,
                totalCredit,
                closingDebit,
                closingCredit,
                netBalance,
                parentId: account.parentId || null
            });
        }
        // Filter zero-balance accounts while preserving hierarchy ancestors
        let lines;
        if (includeZeroBalance) {
            lines = allLines;
        }
        else {
            // Pass 1: find accounts with non-zero closing balances
            const needed = new Set();
            for (const line of allLines) {
                if (line.closingDebit !== 0 || line.closingCredit !== 0) {
                    needed.add(line.accountId);
                    // Walk up the parentId chain to include all ancestors
                    let pid = line.parentId;
                    while (pid && !needed.has(pid)) {
                        needed.add(pid);
                        const parentAccount = accountMap.get(pid);
                        pid = (parentAccount === null || parentAccount === void 0 ? void 0 : parentAccount.parentId) || null;
                    }
                }
            }
            // Pass 2: keep only needed accounts
            lines = allLines.filter(l => needed.has(l.accountId));
        }
        // Sort by account code
        lines.sort((a, b) => a.code.localeCompare(b.code));
        // Compute meta
        const totalClosingDebit = lines.reduce((sum, r) => sum + r.closingDebit, 0);
        const totalClosingCredit = lines.reduce((sum, r) => sum + r.closingCredit, 0);
        const difference = totalClosingDebit - totalClosingCredit;
        return {
            data: lines,
            meta: {
                generatedAt: new Date().toISOString(),
                asOfDate: effectiveDate,
                includeZeroBalance,
                totalClosingDebit,
                totalClosingCredit,
                difference,
                isBalanced: Math.abs(difference) < 0.005
            }
        };
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
class GetAccountStatementUseCase {
    constructor(ledgerRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, accountId, fromDate, toDate, options) {
        if (!accountId) {
            throw new Error('accountId is required');
        }
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        return this.ledgerRepo.getAccountStatement(companyId, accountId, fromDate, toDate, options);
    }
}
exports.GetAccountStatementUseCase = GetAccountStatementUseCase;
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
    constructor(voucherRepo, accountRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const accounts = this.accountRepo.getAccounts
            ? await this.accountRepo.getAccounts(companyId)
            : await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        const vouchers = await this.voucherRepo.findByDateRange(companyId, filters.fromDate || '1900-01-01', filters.toDate || new Date().toISOString().split('T')[0]);
        const filtered = filters.voucherType
            ? vouchers.filter((v) => (v.type || '').toString() === filters.voucherType)
            : vouchers;
        return filtered.map((v) => {
            const lines = (v.lines || []).map((l) => {
                const acc = accountMap.get(l.accountId);
                return {
                    accountId: l.accountId,
                    accountCode: (acc === null || acc === void 0 ? void 0 : acc.userCode) || (acc === null || acc === void 0 ? void 0 : acc.code) || l.accountId,
                    accountName: (acc === null || acc === void 0 ? void 0 : acc.name) || 'Unknown',
                    description: l.notes || l.description || '',
                    debit: l.debitAmount || 0,
                    credit: l.creditAmount || 0,
                    currency: l.currency,
                    exchangeRate: l.exchangeRate
                };
            });
            const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
            const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
            return {
                voucherId: v.id,
                voucherNo: v.voucherNo || v.id,
                date: v.date,
                type: v.type,
                description: v.description,
                status: v.status,
                currency: v.currency,
                lines,
                totalDebit,
                totalCredit
            };
        });
    }
}
exports.GetJournalUseCase = GetJournalUseCase;
//# sourceMappingURL=LedgerUseCases.js.map