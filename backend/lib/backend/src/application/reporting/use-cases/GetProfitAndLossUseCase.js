"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetProfitAndLossUseCase = void 0;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const REPORT_VOUCHER_LIMIT = 100000;
const normalizeDateInput = (value) => {
    if (DATE_ONLY_RE.test(value))
        return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        throw new Error(`Invalid date: ${value}`);
    return parsed.toISOString().slice(0, 10);
};
const classificationOf = (account) => String((account === null || account === void 0 ? void 0 : account.classification) || '').toUpperCase();
const accountLabel = (account, fallbackId) => {
    const code = String((account === null || account === void 0 ? void 0 : account.userCode) || (account === null || account === void 0 ? void 0 : account.systemCode) || '').trim();
    const name = String((account === null || account === void 0 ? void 0 : account.name) || '').trim();
    if (code && name)
        return `${code} - ${name}`;
    if (name)
        return name;
    return fallbackId;
};
class GetProfitAndLossUseCase {
    constructor(voucherRepository, accountRepository, permissionChecker) {
        this.voucherRepository = voucherRepository;
        this.accountRepository = accountRepository;
        this.permissionChecker = permissionChecker;
    }
    async execute(input) {
        await this.permissionChecker.assertOrThrow(input.userId, input.companyId, 'accounting.reports.profitAndLoss.view');
        const fromDate = normalizeDateInput(input.fromDate);
        const toDate = normalizeDateInput(input.toDate);
        const [vouchers, accounts] = await Promise.all([
            this.voucherRepository.findByDateRange(input.companyId, fromDate, toDate, REPORT_VOUCHER_LIMIT),
            this.accountRepository.list(input.companyId),
        ]);
        const accountMap = new Map(accounts.map((account) => [account.id, account]));
        const postedVouchers = vouchers.filter((voucher) => voucher.isPosted);
        const revenueMap = new Map();
        const expenseMap = new Map();
        let totalRevenue = 0;
        let totalExpenses = 0;
        for (const voucher of postedVouchers) {
            for (const line of voucher.lines || []) {
                const accountId = line.accountId;
                const account = accountMap.get(accountId);
                const classification = classificationOf(account);
                if (classification === 'REVENUE') {
                    const amount = (line.creditAmount || 0) - (line.debitAmount || 0);
                    if (amount !== 0) {
                        totalRevenue += amount;
                        const existing = revenueMap.get(accountId) || {
                            accountName: accountLabel(account, accountId),
                            amount: 0,
                        };
                        existing.amount += amount;
                        revenueMap.set(accountId, existing);
                    }
                }
                if (classification === 'EXPENSE') {
                    const amount = (line.debitAmount || 0) - (line.creditAmount || 0);
                    if (amount !== 0) {
                        totalExpenses += amount;
                        const existing = expenseMap.get(accountId) || {
                            accountName: accountLabel(account, accountId),
                            amount: 0,
                        };
                        existing.amount += amount;
                        expenseMap.set(accountId, existing);
                    }
                }
            }
        }
        return {
            revenue: round2(totalRevenue),
            expenses: round2(totalExpenses),
            netProfit: round2(totalRevenue - totalExpenses),
            revenueByAccount: Array.from(revenueMap.entries())
                .map(([accountId, data]) => ({
                accountId,
                accountName: data.accountName,
                amount: round2(data.amount),
            }))
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
            expensesByAccount: Array.from(expenseMap.entries())
                .map(([accountId, data]) => ({
                accountId,
                accountName: data.accountName,
                amount: round2(data.amount),
            }))
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
            period: {
                from: fromDate,
                to: toDate,
            },
        };
    }
}
exports.GetProfitAndLossUseCase = GetProfitAndLossUseCase;
//# sourceMappingURL=GetProfitAndLossUseCase.js.map