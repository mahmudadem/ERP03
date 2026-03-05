"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetProfitAndLossUseCase = void 0;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
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
const toSortedAmounts = (map) => Array.from(map.entries())
    .map(([accountId, data]) => ({
    accountId,
    accountName: data.accountName,
    amount: round2(data.amount),
}))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
class GetProfitAndLossUseCase {
    constructor(ledgerRepo, accountRepository, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepository = accountRepository;
        this.permissionChecker = permissionChecker;
    }
    async execute(input) {
        var _a;
        await this.permissionChecker.assertOrThrow(input.userId, input.companyId, 'accounting.reports.profitAndLoss.view');
        const fromDate = normalizeDateInput(input.fromDate);
        const toDate = normalizeDateInput(input.toDate);
        const dayBefore = (() => {
            const d = new Date(fromDate);
            d.setDate(d.getDate() - 1);
            return d.toISOString().slice(0, 10);
        })();
        const [openingTB, closingTB, accounts] = await Promise.all([
            this.ledgerRepo.getTrialBalance(input.companyId, dayBefore),
            this.ledgerRepo.getTrialBalance(input.companyId, toDate),
            this.accountRepository.list(input.companyId),
        ]);
        const openMap = new Map(openingTB.map((row) => [row.accountId, { debit: row.debit || 0, credit: row.credit || 0 }]));
        const closeMap = new Map(closingTB.map((row) => [row.accountId, { debit: row.debit || 0, credit: row.credit || 0 }]));
        const revenueMap = new Map();
        const expenseMap = new Map();
        const salesMap = new Map();
        const cogsMap = new Map();
        const opexMap = new Map();
        const otherRevenueMap = new Map();
        const otherExpenseMap = new Map();
        const unclassifiedRevenueMap = new Map();
        const unclassifiedExpenseMap = new Map();
        let totalRevenue = 0;
        let totalExpenses = 0;
        let netSales = 0;
        let costOfSales = 0;
        let operatingExpenses = 0;
        let otherRevenue = 0;
        let otherExpenses = 0;
        let unclassifiedRevenue = 0;
        let unclassifiedExpenses = 0;
        let hasTaggedSubgroup = false;
        for (const account of accounts) {
            const classification = classificationOf(account);
            if (classification !== 'REVENUE' && classification !== 'EXPENSE')
                continue;
            const subgroup = (_a = account === null || account === void 0 ? void 0 : account.plSubgroup) !== null && _a !== void 0 ? _a : null;
            if (subgroup)
                hasTaggedSubgroup = true;
            const openBal = openMap.get(account.id) || { debit: 0, credit: 0 };
            const closeBal = closeMap.get(account.id) || { debit: 0, credit: 0 };
            const periodDebit = closeBal.debit - openBal.debit;
            const periodCredit = closeBal.credit - openBal.credit;
            if (classification === 'REVENUE') {
                const amount = periodCredit - periodDebit;
                if (Math.abs(amount) >= 0.005) {
                    const line = {
                        accountName: accountLabel(account, account.id),
                        amount,
                    };
                    totalRevenue += amount;
                    revenueMap.set(account.id, line);
                    if (subgroup === 'SALES') {
                        netSales += amount;
                        salesMap.set(account.id, line);
                    }
                    else if (subgroup === 'OTHER_REVENUE') {
                        otherRevenue += amount;
                        otherRevenueMap.set(account.id, line);
                    }
                    else {
                        unclassifiedRevenue += amount;
                        unclassifiedRevenueMap.set(account.id, line);
                    }
                }
            }
            if (classification === 'EXPENSE') {
                const amount = periodDebit - periodCredit;
                if (Math.abs(amount) >= 0.005) {
                    const line = {
                        accountName: accountLabel(account, account.id),
                        amount,
                    };
                    totalExpenses += amount;
                    expenseMap.set(account.id, line);
                    if (subgroup === 'COST_OF_SALES') {
                        costOfSales += amount;
                        cogsMap.set(account.id, line);
                    }
                    else if (subgroup === 'OPERATING_EXPENSES') {
                        operatingExpenses += amount;
                        opexMap.set(account.id, line);
                    }
                    else if (subgroup === 'OTHER_EXPENSES') {
                        otherExpenses += amount;
                        otherExpenseMap.set(account.id, line);
                    }
                    else {
                        unclassifiedExpenses += amount;
                        unclassifiedExpenseMap.set(account.id, line);
                    }
                }
            }
        }
        const output = {
            revenue: round2(totalRevenue),
            expenses: round2(totalExpenses),
            netProfit: round2(totalRevenue - totalExpenses),
            revenueByAccount: toSortedAmounts(revenueMap),
            expensesByAccount: toSortedAmounts(expenseMap),
            period: {
                from: fromDate,
                to: toDate,
            },
        };
        if (hasTaggedSubgroup) {
            const grossProfit = netSales - costOfSales;
            const operatingProfit = grossProfit - operatingExpenses;
            output.structured = {
                netSales: round2(netSales),
                costOfSales: round2(costOfSales),
                grossProfit: round2(grossProfit),
                operatingExpenses: round2(operatingExpenses),
                operatingProfit: round2(operatingProfit),
                otherRevenue: round2(otherRevenue),
                otherExpenses: round2(otherExpenses),
                salesByAccount: toSortedAmounts(salesMap),
                cogsByAccount: toSortedAmounts(cogsMap),
                opexByAccount: toSortedAmounts(opexMap),
                otherRevenueByAccount: toSortedAmounts(otherRevenueMap),
                otherExpensesByAccount: toSortedAmounts(otherExpenseMap),
                unclassifiedRevenueByAccount: toSortedAmounts(unclassifiedRevenueMap),
                unclassifiedExpensesByAccount: toSortedAmounts(unclassifiedExpenseMap),
            };
        }
        return output;
    }
}
exports.GetProfitAndLossUseCase = GetProfitAndLossUseCase;
//# sourceMappingURL=GetProfitAndLossUseCase.js.map