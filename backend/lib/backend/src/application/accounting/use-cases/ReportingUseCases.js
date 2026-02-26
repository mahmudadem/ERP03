"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetGeneralLedgerUseCase = void 0;
class GetGeneralLedgerUseCase {
    constructor(ledgerRepo, accountRepo, voucherRepo, userRepo, permissionChecker, costCenterRepo) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.voucherRepo = voucherRepo;
        this.userRepo = userRepo;
        this.permissionChecker = permissionChecker;
        this.costCenterRepo = costCenterRepo;
    }
    async execute(companyId, userId, filters) {
        // RBAC: Check permission
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        // Prepare account scope (supports selecting header/group accounts for reporting)
        const accounts = this.accountRepo.getAccounts
            ? await this.accountRepo.getAccounts(companyId)
            : await this.accountRepo.list(companyId);
        const scopedAccountIds = this.resolveScopedAccountIds(filters.accountId, accounts);
        // 1. Calculate opening balance (all entries before fromDate)
        let openingBalance = 0;
        if (filters.fromDate) {
            try {
                const openingQuery = {
                    toDate: new Date(new Date(filters.fromDate).getTime() - 1).toISOString().split('T')[0],
                    costCenterId: filters.costCenterId,
                };
                if (!scopedAccountIds && filters.accountId) {
                    openingQuery.accountId = filters.accountId;
                }
                const openingEntries = await this.ledgerRepo.getGeneralLedger(companyId, openingQuery);
                openingEntries.forEach(e => {
                    if (this.belongsToScope(e.accountId, scopedAccountIds)) {
                        openingBalance += ((e.debit || 0) - (e.credit || 0));
                    }
                });
            }
            catch (e) {
                console.warn(`[GetGeneralLedger] Error calculating opening balance: ${e}`);
            }
        }
        // 2. Fetch entries (for count + pagination)
        const baseQuery = {
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            costCenterId: filters.costCenterId,
        };
        if (!scopedAccountIds && filters.accountId) {
            baseQuery.accountId = filters.accountId;
        }
        const allEntries = await this.ledgerRepo.getGeneralLedger(companyId, baseQuery);
        const scopedEntries = scopedAccountIds
            ? allEntries.filter(e => this.belongsToScope(e.accountId, scopedAccountIds))
            : allEntries;
        const totalItems = scopedEntries.length;
        const offset = Math.max(0, filters.offset || 0);
        const limit = filters.limit && filters.limit > 0 ? filters.limit : totalItems || 100;
        const ledgerEntries = scopedEntries.slice(offset, offset + limit);
        // 3. Enrich account data
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        const accountCodeMap = new Map(accounts.map(a => [a.userCode || a.code, a]));
        // 4. Fetch vouchers
        const voucherIds = [...new Set(ledgerEntries.map(e => e.voucherId))];
        const vouchers = await Promise.all(voucherIds.map(id => this.voucherRepo.findById(companyId, id).catch(() => null)));
        const voucherMap = new Map(vouchers.filter(v => v).map(v => [v.id, v]));
        // 5. Enrichment missing accounts and users
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
            await Promise.all(Array.from(userIds).map(async (uid) => {
                try {
                    const u = await this.userRepo.getUserById(uid);
                    if (u)
                        userMap.set(uid, u);
                }
                catch (e) { }
            }));
        }
        // 5b. Enrich cost center data
        const costCenterIds = new Set(ledgerEntries.map(e => e.costCenterId).filter(Boolean));
        const costCenterMap = new Map();
        if (costCenterIds.size > 0 && this.costCenterRepo) {
            try {
                const allCCs = await this.costCenterRepo.findAll(companyId);
                allCCs.forEach(cc => costCenterMap.set(cc.id, { code: cc.code, name: cc.name }));
            }
            catch (e) {
                console.warn('[GetGeneralLedger] Error loading cost centers:', e);
            }
        }
        // 6. Calculate Running Balance for the CURRENT page
        // We need the balance up to the offset
        let pageStartingBalance = openingBalance;
        if (offset > 0) {
            // Add balance from entries skipped by current offset
            scopedEntries.slice(0, offset).forEach(e => {
                pageStartingBalance += ((e.debit || 0) - (e.credit || 0));
            });
        }
        let runningBalance = pageStartingBalance;
        const data = ledgerEntries.map(entry => {
            var _a, _b;
            const acc = accountMap.get(entry.accountId) || accountCodeMap.get(entry.accountId);
            const voucher = voucherMap.get(entry.voucherId);
            const dr = entry.debit || 0;
            const cr = entry.credit || 0;
            runningBalance += (dr - cr);
            return {
                id: entry.id,
                date: entry.date,
                voucherId: entry.voucherId,
                voucherNo: (voucher === null || voucher === void 0 ? void 0 : voucher.voucherNo) || 'N/A',
                accountId: entry.accountId,
                accountCode: (acc === null || acc === void 0 ? void 0 : acc.code) || '???',
                accountName: (acc === null || acc === void 0 ? void 0 : acc.name) || 'Unknown Account',
                description: entry.notes || (voucher === null || voucher === void 0 ? void 0 : voucher.description) || '',
                debit: dr,
                credit: cr,
                currency: entry.currency || '',
                amount: entry.amount || 0,
                baseCurrency: entry.baseCurrency || '',
                baseAmount: entry.baseAmount || 0,
                exchangeRate: entry.exchangeRate || 1,
                runningBalance: filters.accountId ? runningBalance : undefined,
                costCenterId: entry.costCenterId || undefined,
                costCenterCode: entry.costCenterId ? (_a = costCenterMap.get(entry.costCenterId)) === null || _a === void 0 ? void 0 : _a.code : undefined,
                costCenterName: entry.costCenterId ? (_b = costCenterMap.get(entry.costCenterId)) === null || _b === void 0 ? void 0 : _b.name : undefined,
            };
        });
        return {
            data,
            metadata: {
                totalItems,
                openingBalance
            }
        };
    }
    resolveScopedAccountIds(accountId, accounts) {
        if (!accountId)
            return null;
        const byId = new Map(accounts.map((a) => [a.id, a]));
        const childrenMap = new Map();
        for (const account of accounts) {
            const key = (account === null || account === void 0 ? void 0 : account.parentId) || null;
            const bucket = childrenMap.get(key) || [];
            bucket.push(account);
            childrenMap.set(key, bucket);
        }
        const scoped = new Set();
        const visited = new Set();
        const queue = [accountId];
        while (queue.length > 0) {
            const id = queue.shift();
            if (visited.has(id))
                continue;
            visited.add(id);
            const account = byId.get(id);
            if (!account)
                continue;
            const role = String((account === null || account === void 0 ? void 0 : account.accountRole) || '').toUpperCase();
            const isHeader = role === 'HEADER' || (account === null || account === void 0 ? void 0 : account.hasChildren) === true;
            if (!isHeader)
                scoped.add(id);
            const children = childrenMap.get(id) || [];
            children.forEach((child) => {
                if ((child === null || child === void 0 ? void 0 : child.id) && !visited.has(child.id))
                    queue.push(child.id);
            });
        }
        return scoped;
    }
    belongsToScope(accountId, scopedAccountIds) {
        if (!scopedAccountIds)
            return true;
        return scopedAccountIds.has(accountId);
    }
}
exports.GetGeneralLedgerUseCase = GetGeneralLedgerUseCase;
//# sourceMappingURL=ReportingUseCases.js.map