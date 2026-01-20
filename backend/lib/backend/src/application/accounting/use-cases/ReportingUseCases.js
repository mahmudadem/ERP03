"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetGeneralLedgerUseCase = exports.GetTrialBalanceUseCase = void 0;
class GetTrialBalanceUseCase {
    constructor(accountRepo, voucherRepo, permissionChecker) {
        this.accountRepo = accountRepo;
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId) {
        // RBAC: Check permission
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');
        // 1. Fetch all accounts to map names and codes
        const accounts = this.accountRepo.getAccounts
            ? await this.accountRepo.getAccounts(companyId)
            : await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        // 2. Fetch all vouchers and filter by status (V1: use isApproved and isPosted)
        const allVouchers = await this.voucherRepo.findByCompany(companyId) || [];
        // V1: Include APPROVED vouchers (which may or may not be posted) and any posted vouchers
        const validVouchers = allVouchers.filter(v => v.isApproved || v.isPosted);
        // 3. Aggregate Balances
        const balances = {};
        accounts.forEach(acc => {
            balances[acc.id] = { debit: 0, credit: 0 };
        });
        for (const voucher of validVouchers) {
            if (!voucher.lines)
                continue;
            for (const line of voucher.lines) {
                if (!balances[line.accountId]) {
                    balances[line.accountId] = { debit: 0, credit: 0 };
                }
                // V2 VoucherLineEntity uses debitAmount/creditAmount getters
                balances[line.accountId].debit += line.debitAmount || 0;
                balances[line.accountId].credit += line.creditAmount || 0;
            }
        }
        // 4. Transform to Result
        const report = Object.keys(balances).map(accId => {
            const b = balances[accId];
            const acc = accountMap.get(accId);
            const code = (acc === null || acc === void 0 ? void 0 : acc.code) || '???';
            const name = (acc === null || acc === void 0 ? void 0 : acc.name) || `Unknown Account (${accId})`;
            const type = (acc === null || acc === void 0 ? void 0 : acc.type) || 'EXPENSE';
            let net = 0;
            if (['ASSET', 'EXPENSE'].includes(type)) {
                net = b.debit - b.credit;
            }
            else {
                net = b.credit - b.debit;
            }
            return {
                accountId: accId,
                code: code,
                name: name,
                type: type,
                totalDebit: b.debit,
                totalCredit: b.credit,
                netBalance: net
            };
        });
        // Sort by Account Code
        return report.sort((a, b) => a.code.localeCompare(b.code));
    }
}
exports.GetTrialBalanceUseCase = GetTrialBalanceUseCase;
class GetGeneralLedgerUseCase {
    constructor(ledgerRepo, accountRepo, voucherRepo, userRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.voucherRepo = voucherRepo;
        this.userRepo = userRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, filters) {
        // RBAC: Check permission
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        // 1. Fetch ledger entries
        const ledgerEntries = await this.ledgerRepo.getGeneralLedger(companyId, {
            accountId: filters.accountId,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
        });
        // 2. Fetch accounts for enrichment (Batch)
        const accounts = this.accountRepo.getAccounts
            ? await this.accountRepo.getAccounts(companyId)
            : await this.accountRepo.list(companyId);
        console.log(`[GetGeneralLedger] CompanyId: ${companyId}, Fetched ${accounts.length} accounts`);
        // Create maps for both ID and UserCode for robustness
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        const accountCodeMap = new Map(accounts.map(a => [a.userCode || a.code, a]));
        // 3. Fetch vouchers for voucher numbers
        const voucherIds = [...new Set(ledgerEntries.map(e => e.voucherId))];
        const vouchers = await Promise.all(voucherIds.map(id => this.voucherRepo.findById(companyId, id).catch(() => null)));
        const voucherMap = new Map(vouchers.filter(v => v).map(v => [v.id, v]));
        // 5. Fetch Users for Audit Metadata
        const userIds = new Set();
        voucherMap.forEach(v => {
            if (v.createdBy)
                userIds.add(v.createdBy);
            if (v.approvedBy)
                userIds.add(v.approvedBy);
            if (v.postedBy)
                userIds.add(v.postedBy);
        });
        const userMap = new Map();
        if (userIds.size > 0) {
            console.log(`[GetGeneralLedger] Fetching details for ${userIds.size} users...`);
            await Promise.all(Array.from(userIds).map(async (uid) => {
                try {
                    const u = await this.userRepo.getUserById(uid);
                    if (u)
                        userMap.set(uid, u);
                }
                catch (e) {
                    console.warn(`[GetGeneralLedger] Failed to fetch user ${uid}`, e);
                }
            }));
        }
        // 4. Transform and enrich
        let runningBalance = 0;
        // Pre-fetch missing accounts to handle pagination/limit issues
        const validAccountIds = new Set([...accountMap.keys()]);
        const missingAccountIds = [...new Set(ledgerEntries.map(e => e.accountId))]
            .filter(id => !validAccountIds.has(id));
        if (missingAccountIds.length > 0) {
            console.log(`[GetGeneralLedger] Found ${missingAccountIds.length} accounts missing from batch list. Fetching individually...`);
            // Try to fetch missing accounts individually (or in batch if repo supports it)
            // Since repo doesn't support getManyByIds, we fetch individually (parallel)
            await Promise.all(missingAccountIds.map(async (id) => {
                try {
                    const acc = await this.accountRepo.getById(companyId, id);
                    if (acc) {
                        accountMap.set(acc.id, acc);
                        if (acc.userCode)
                            accountCodeMap.set(acc.userCode, acc);
                        if (acc.code)
                            accountCodeMap.set(acc.code, acc);
                    }
                }
                catch (e) {
                    console.warn(`[GetGeneralLedger] Failed to lazy-load account ${id}`, e);
                }
            }));
        }
        const result = ledgerEntries.map(entry => {
            var _a, _b, _c, _d, _e, _f;
            // Try ID first, then UserCode
            const acc = accountMap.get(entry.accountId) || accountCodeMap.get(entry.accountId);
            const voucher = voucherMap.get(entry.voucherId);
            const dateStr = (() => {
                const d = entry.date;
                if (!d)
                    return '';
                if (d instanceof Date)
                    return d.toISOString().split('T')[0];
                if (typeof d === 'string')
                    return d.includes('T') ? d.split('T')[0] : d;
                if (typeof d === 'object' && 'seconds' in d) {
                    return new Date(d.seconds * 1000).toISOString().split('T')[0];
                }
                return String(d);
            })();
            // Update running balance (Debit positive, Credit negative)
            // Note: This logic assumes Asset/Expense nature. For Liabilities/Revenue, it might be inverted,
            // but standard GL view usually presents Dr-Cr or separate columns.
            const dr = entry.debit || 0;
            const cr = entry.credit || 0;
            runningBalance += (dr - cr);
            return {
                id: entry.id,
                date: dateStr,
                voucherId: entry.voucherId,
                voucherNo: (voucher === null || voucher === void 0 ? void 0 : voucher.voucherNo) || 'N/A',
                accountId: entry.accountId,
                accountCode: (acc === null || acc === void 0 ? void 0 : acc.code) || '???',
                accountName: (acc === null || acc === void 0 ? void 0 : acc.name) || 'Unknown Account',
                description: entry.notes || (voucher === null || voucher === void 0 ? void 0 : voucher.description) || '',
                debit: dr,
                credit: cr,
                currency: entry.currency || 'USD',
                amount: entry.amount || 0,
                baseCurrency: entry.baseCurrency || 'USD',
                baseAmount: entry.baseAmount || 0,
                exchangeRate: entry.exchangeRate || 1,
                runningBalance: filters.accountId ? runningBalance : undefined,
                // Audit Metadata
                createdAt: (voucher === null || voucher === void 0 ? void 0 : voucher.createdAt) ? new Date(voucher.createdAt).toISOString() : undefined,
                createdBy: voucher === null || voucher === void 0 ? void 0 : voucher.createdBy,
                createdByName: (_a = userMap.get((voucher === null || voucher === void 0 ? void 0 : voucher.createdBy) || '')) === null || _a === void 0 ? void 0 : _a.name,
                createdByEmail: (_b = userMap.get((voucher === null || voucher === void 0 ? void 0 : voucher.createdBy) || '')) === null || _b === void 0 ? void 0 : _b.email,
                approvedAt: (voucher === null || voucher === void 0 ? void 0 : voucher.approvedAt) ? new Date(voucher.approvedAt).toISOString() : undefined,
                approvedBy: voucher === null || voucher === void 0 ? void 0 : voucher.approvedBy,
                approvedByName: (_c = userMap.get((voucher === null || voucher === void 0 ? void 0 : voucher.approvedBy) || '')) === null || _c === void 0 ? void 0 : _c.name,
                approvedByEmail: (_d = userMap.get((voucher === null || voucher === void 0 ? void 0 : voucher.approvedBy) || '')) === null || _d === void 0 ? void 0 : _d.email,
                postedAt: (voucher === null || voucher === void 0 ? void 0 : voucher.postedAt) ? new Date(voucher.postedAt).toISOString() : undefined,
                postedBy: voucher === null || voucher === void 0 ? void 0 : voucher.postedBy,
                postedByName: (_e = userMap.get((voucher === null || voucher === void 0 ? void 0 : voucher.postedBy) || '')) === null || _e === void 0 ? void 0 : _e.name,
                postedByEmail: (_f = userMap.get((voucher === null || voucher === void 0 ? void 0 : voucher.postedBy) || '')) === null || _f === void 0 ? void 0 : _f.email,
            };
        });
        return result;
    }
}
exports.GetGeneralLedgerUseCase = GetGeneralLedgerUseCase;
//# sourceMappingURL=ReportingUseCases.js.map