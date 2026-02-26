"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgingReportUseCase = void 0;
const BUCKETS = [
    { name: 'Current', min: 0, max: 0 },
    { name: '1-30', min: 1, max: 30 },
    { name: '31-60', min: 31, max: 60 },
    { name: '61-90', min: 61, max: 90 },
    { name: '91-120', min: 91, max: 120 },
    { name: '120+', min: 121, max: Number.MAX_SAFE_INTEGER }
];
const AR_MARKERS = [
    'accounts receivable',
    'account receivable',
    'receivable',
    'receivables',
    'trade receivable',
    'customer receivable',
    'customers receivable',
    'client receivable',
    'debtor',
    'debtors',
    'unbilled',
    'ذمم مدينة',
    'مدين',
    'عملاء',
];
const AP_MARKERS = [
    'accounts payable',
    'account payable',
    'trade payable',
    'payables',
    'supplier',
    'suppliers',
    'vendor',
    'vendors',
    'creditor',
    'creditors',
    'ذمم دائنة',
    'دائن',
    'مورد',
    'موردين',
];
class AgingReportUseCase {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, type, asOfDate, accountId, includeZeroBalance = false) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const accounts = await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        const scopedAccountIds = this.resolveScopedAccountIds(accountId, accounts);
        const isManualAccountMode = !!accountId;
        const targetAccounts = accounts.filter((a) => this.isTargetAgingAccount(a, type, scopedAccountIds, isManualAccountMode, accountMap));
        const rows = [];
        const totals = Array(BUCKETS.length).fill(0);
        for (const acc of targetAccounts) {
            const ledger = await this.ledgerRepo.getGeneralLedger(companyId, { accountId: acc.id, toDate: asOfDate });
            const bucketSums = Array(BUCKETS.length).fill(0);
            const entryDetails = [];
            ledger.forEach((e) => {
                const days = this.daysBetween(asOfDate, e.date);
                const amount = this.signedAmount(type, e.side, e.amount);
                const idx = this.bucketIndex(days);
                if (idx >= 0) {
                    bucketSums[idx] += amount;
                    entryDetails.push({
                        id: e.id,
                        date: typeof e.date === 'string' ? e.date : '',
                        description: e.description || e.notes,
                        amount,
                        days
                    });
                }
            });
            const total = bucketSums.reduce((s, v) => s + v, 0);
            if (!includeZeroBalance && Math.abs(total) < 0.0001)
                continue; // skip zero-balance accounts by default
            bucketSums.forEach((v, i) => (totals[i] += v));
            rows.push({
                accountId: acc.id,
                accountCode: acc.userCode || acc.code || '',
                accountName: acc.name,
                bucketAmounts: bucketSums,
                total,
                entries: entryDetails.sort((a, b) => b.days - a.days)
            });
        }
        const grandTotal = totals.reduce((s, v) => s + v, 0);
        return {
            asOfDate,
            type,
            buckets: BUCKETS.map((b) => b.name),
            accounts: rows,
            totals,
            grandTotal
        };
    }
    daysBetween(asOf, dateStr) {
        const asOfDate = new Date(asOf);
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        const diff = asOfDate.getTime() - date.getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    }
    bucketIndex(days) {
        for (let i = 0; i < BUCKETS.length; i++) {
            if (days >= BUCKETS[i].min && days <= BUCKETS[i].max)
                return i;
        }
        return -1;
    }
    signedAmount(type, side, amount) {
        const amt = Number(amount) || 0;
        if (type === 'AR') {
            return side === 'Credit' ? -amt : amt;
        }
        // AP: payable grows on credit
        return side === 'Credit' ? amt : -amt;
    }
    isTargetAgingAccount(account, type, scopedAccountIds, isManualAccountMode, accountMap) {
        if (scopedAccountIds && !scopedAccountIds.has(account.id))
            return false;
        const role = String((account === null || account === void 0 ? void 0 : account.accountRole) || '').toUpperCase();
        const classification = String((account === null || account === void 0 ? void 0 : account.classification) || '').toUpperCase();
        const isLegacyRoleMatch = type === 'AR'
            ? ['RECEIVABLE', 'AR', 'ACCOUNTS_RECEIVABLE'].includes(role)
            : ['PAYABLE', 'AP', 'ACCOUNTS_PAYABLE'].includes(role);
        const isClassificationMatch = type === 'AR'
            ? classification === 'ASSET'
            : classification === 'LIABILITY';
        if (!isLegacyRoleMatch && !isClassificationMatch)
            return false;
        if (!this.isPostingLikeAccount(account, role))
            return false;
        if (isLegacyRoleMatch)
            return true;
        if (isManualAccountMode)
            return true;
        const markers = type === 'AR' ? AR_MARKERS : AP_MARKERS;
        return this.hasMarkerInHierarchy(account, accountMap, markers);
    }
    isPostingLikeAccount(account, role) {
        if (role === 'HEADER')
            return false;
        if ((account === null || account === void 0 ? void 0 : account.hasChildren) === true)
            return false;
        return true;
    }
    hasMarkerInHierarchy(account, accountMap, markers) {
        let current = account;
        const seen = new Set();
        for (let depth = 0; depth < 20 && current; depth++) {
            const text = `${(current === null || current === void 0 ? void 0 : current.name) || ''} ${(current === null || current === void 0 ? void 0 : current.userCode) || (current === null || current === void 0 ? void 0 : current.code) || ''}`.toLowerCase();
            if (markers.some((marker) => text.includes(marker)))
                return true;
            const parentId = current === null || current === void 0 ? void 0 : current.parentId;
            if (!parentId || seen.has(parentId))
                break;
            seen.add(parentId);
            current = accountMap.get(parentId);
        }
        return false;
    }
    resolveScopedAccountIds(accountId, accounts) {
        if (!accountId)
            return null;
        const ids = new Set();
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        const childrenMap = new Map();
        for (const account of accounts) {
            const key = (account === null || account === void 0 ? void 0 : account.parentId) || null;
            const bucket = childrenMap.get(key) || [];
            bucket.push(account);
            childrenMap.set(key, bucket);
        }
        const queue = [accountId];
        const seen = new Set();
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (seen.has(currentId))
                continue;
            seen.add(currentId);
            const current = accountMap.get(currentId);
            if (!current)
                continue;
            ids.add(currentId);
            const children = childrenMap.get(currentId) || [];
            children.forEach((child) => {
                if ((child === null || child === void 0 ? void 0 : child.id) && !seen.has(child.id))
                    queue.push(child.id);
            });
        }
        return ids;
    }
}
exports.AgingReportUseCase = AgingReportUseCase;
//# sourceMappingURL=AgingReportUseCase.js.map