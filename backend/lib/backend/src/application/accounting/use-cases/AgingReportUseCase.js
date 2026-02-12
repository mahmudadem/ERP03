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
class AgingReportUseCase {
    constructor(ledgerRepo, accountRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, type, asOfDate, accountId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const accounts = await this.accountRepo.list(companyId);
        const targetAccounts = accounts.filter((a) => {
            const role = (a.accountRole || '').toUpperCase();
            const classification = (a.classification || '').toUpperCase();
            if (accountId && a.id !== accountId)
                return false;
            if (type === 'AR') {
                return role === 'RECEIVABLE' || classification === 'ASSET';
            }
            return role === 'PAYABLE' || classification === 'LIABILITY';
        });
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
            if (Math.abs(total) < 0.0001)
                continue; // skip zero-balance accounts
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
}
exports.AgingReportUseCase = AgingReportUseCase;
//# sourceMappingURL=AgingReportUseCase.js.map