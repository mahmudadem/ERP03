"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCashFlowStatementUseCase = void 0;
const cashAccountMatcher_1 = require("../utils/cashAccountMatcher");
const iso = (d) => d.toISOString().split('T')[0];
class GetCashFlowStatementUseCase {
    constructor(ledgerRepo, accountRepo, companyRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.companyRepo = companyRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fromDate, toDate) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.cashFlow.view');
        const effectiveFrom = fromDate || iso(new Date(new Date().getFullYear(), 0, 1));
        const effectiveTo = toDate || iso(new Date());
        const accounts = await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        const company = await this.companyRepo.findById(companyId).catch(() => null);
        const baseCurrency = (company === null || company === void 0 ? void 0 : company.baseCurrency) || '';
        // Trial balance at start-1 and at end
        const openingDate = (() => {
            const d = new Date(effectiveFrom);
            d.setDate(d.getDate() - 1);
            return iso(d);
        })();
        const openingTB = await this.ledgerRepo.getTrialBalance(companyId, openingDate);
        const closingTB = await this.ledgerRepo.getTrialBalance(companyId, effectiveTo);
        const tbMap = (tb) => {
            const m = new Map();
            tb.forEach((r) => m.set(r.accountId, { debit: r.debit || 0, credit: r.credit || 0 }));
            return m;
        };
        const openMap = tbMap(openingTB);
        const closeMap = tbMap(closingTB);
        const cashIds = accounts.filter((acc) => (0, cashAccountMatcher_1.isCashLikeAccount)(acc)).map((a) => a.id);
        const balanceOf = (map, accId, cls) => {
            const v = map.get(accId);
            if (!v)
                return 0;
            return ['ASSET', 'EXPENSE'].includes(cls) ? (v.debit - v.credit) : (v.credit - v.debit);
        };
        const openingCashBalance = cashIds.reduce((s, id) => {
            const acc = accountMap.get(id);
            return s + balanceOf(openMap, id, (acc === null || acc === void 0 ? void 0 : acc.classification) || 'ASSET');
        }, 0);
        const closingCashBalance = cashIds.reduce((s, id) => {
            const acc = accountMap.get(id);
            return s + balanceOf(closeMap, id, (acc === null || acc === void 0 ? void 0 : acc.classification) || 'ASSET');
        }, 0);
        const netCashChange = closingCashBalance - openingCashBalance;
        // Net income: delta of revenue/expense accounts
        let netIncome = 0;
        accounts.forEach((acc) => {
            if (['REVENUE', 'EXPENSE'].includes(acc.classification)) {
                const delta = balanceOf(closeMap, acc.id, acc.classification) - balanceOf(openMap, acc.id, acc.classification);
                netIncome += acc.classification === 'REVENUE' ? delta : -delta;
            }
        });
        // Working capital change (current assets/liabilities excluding cash/bank)
        let workingCapitalChange = 0;
        accounts.forEach((acc) => {
            if (cashIds.includes(acc.id))
                return;
            const delta = balanceOf(closeMap, acc.id, acc.classification) - balanceOf(openMap, acc.id, acc.classification);
            if (['ASSET'].includes(acc.classification)) {
                workingCapitalChange -= delta; // increase in asset reduces cash
            }
            else if (['LIABILITY'].includes(acc.classification)) {
                workingCapitalChange += delta; // increase in liability increases cash
            }
        });
        const operatingTotal = netIncome + workingCapitalChange;
        const operating = {
            items: [
                { name: 'Net Income', amount: netIncome },
                { name: 'Working Capital Changes', amount: workingCapitalChange }
            ],
            total: operatingTotal
        };
        const investing = { items: [], total: 0 };
        const financing = { items: [], total: 0 };
        return {
            period: { from: effectiveFrom, to: effectiveTo },
            baseCurrency,
            netIncome,
            operating,
            investing,
            financing,
            netCashChange,
            openingCashBalance,
            closingCashBalance
        };
    }
}
exports.GetCashFlowStatementUseCase = GetCashFlowStatementUseCase;
//# sourceMappingURL=CashFlowUseCases.js.map