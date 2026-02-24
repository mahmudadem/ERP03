"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCashFlowStatementUseCase = void 0;
const cashAccountMatcher_1 = require("../utils/cashAccountMatcher");
const iso = (d) => d.toISOString().split('T')[0];
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const isNonZero = (value) => Math.abs(value) >= 0.005;
const INVESTING_HINTS = [
    'property',
    'plant',
    'equipment',
    'ppe',
    'building',
    'land',
    'vehicle',
    'machinery',
    'intangible',
    'investment',
    'capital work',
    'capex',
];
const FINANCING_HINTS = [
    'loan',
    'debt',
    'borrow',
    'bond',
    'mortgage',
    'lease liability',
    'notes payable',
    'capital',
    'share',
    'equity',
    'owner',
    'partner',
    'dividend',
];
const RETAINED_EARNINGS_HINTS = ['retained earnings', 'retained earning', 'current year earnings'];
const NON_CASH_PNL_HINTS = ['depreciation', 'amortization', 'impairment', 'provision', 'unrealized', 'accrual'];
const normalizeText = (account) => `${(account === null || account === void 0 ? void 0 : account.name) || ''} ${(account === null || account === void 0 ? void 0 : account.userCode) || ''} ${(account === null || account === void 0 ? void 0 : account.systemCode) || ''}`.toLowerCase();
const inferCashFlowCategory = (account) => {
    const explicit = String((account === null || account === void 0 ? void 0 : account.cashFlowCategory) || '').toUpperCase();
    if (explicit === 'OPERATING' || explicit === 'INVESTING' || explicit === 'FINANCING') {
        return explicit;
    }
    const classification = String((account === null || account === void 0 ? void 0 : account.classification) || '').toUpperCase();
    const text = normalizeText(account);
    if (classification === 'ASSET') {
        if (INVESTING_HINTS.some((hint) => text.includes(hint)))
            return 'INVESTING';
        return 'OPERATING';
    }
    if (classification === 'LIABILITY') {
        if (FINANCING_HINTS.some((hint) => text.includes(hint)))
            return 'FINANCING';
        return 'OPERATING';
    }
    if (classification === 'EQUITY') {
        if (RETAINED_EARNINGS_HINTS.some((hint) => text.includes(hint)))
            return 'OPERATING';
        return 'FINANCING';
    }
    return 'OPERATING';
};
const isLikelyNonCashPnl = (account) => {
    const text = normalizeText(account);
    return NON_CASH_PNL_HINTS.some((hint) => text.includes(hint));
};
const cashEffectFromDelta = (classification, delta) => {
    const cls = String(classification || '').toUpperCase();
    if (cls === 'ASSET' || cls === 'EXPENSE')
        return -delta;
    return delta;
};
const accountLabel = (account) => {
    const code = ((account === null || account === void 0 ? void 0 : account.userCode) || (account === null || account === void 0 ? void 0 : account.systemCode) || '').trim();
    const name = ((account === null || account === void 0 ? void 0 : account.name) || 'Account').trim();
    return code ? `${code} - ${name}` : name;
};
class GetCashFlowStatementUseCase {
    constructor(ledgerRepo, accountRepo, companyRepo, permissionChecker) {
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.companyRepo = companyRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fromDate, toDate) {
        var _a, _b, _c;
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
        const cashIds = new Set(accounts.filter((acc) => (0, cashAccountMatcher_1.isCashLikeAccount)(acc)).map((a) => a.id));
        const balanceOf = (map, accId, cls) => {
            const v = map.get(accId);
            if (!v)
                return 0;
            return ['ASSET', 'EXPENSE'].includes(cls) ? (v.debit - v.credit) : (v.credit - v.debit);
        };
        const openingCashBalance = Array.from(cashIds).reduce((s, id) => {
            const acc = accountMap.get(id);
            return s + balanceOf(openMap, id, (acc === null || acc === void 0 ? void 0 : acc.classification) || 'ASSET');
        }, 0);
        const closingCashBalance = Array.from(cashIds).reduce((s, id) => {
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
        const movementRows = accounts
            .filter((acc) => !cashIds.has(acc.id))
            .map((acc) => {
            const delta = balanceOf(closeMap, acc.id, acc.classification) - balanceOf(openMap, acc.id, acc.classification);
            return {
                account: acc,
                delta,
                cashEffect: cashEffectFromDelta(acc.classification, delta),
                category: inferCashFlowCategory(acc),
            };
        })
            .filter((row) => isNonZero(row.delta) || isNonZero(row.cashEffect));
        const sectionFromCategory = (category) => {
            const rows = movementRows.filter((row) => row.category === category && isNonZero(row.cashEffect));
            const total = rows.reduce((sum, row) => sum + row.cashEffect, 0);
            const items = rows
                .sort((a, b) => Math.abs(b.cashEffect) - Math.abs(a.cashEffect))
                .map((row) => ({
                name: accountLabel(row.account),
                amount: round2(row.cashEffect),
                accountId: row.account.id,
            }));
            return { items, total: round2(total) };
        };
        const investing = sectionFromCategory('INVESTING');
        const financing = sectionFromCategory('FINANCING');
        const roundedNetCashChange = round2(netCashChange);
        const operatingTarget = round2(roundedNetCashChange - investing.total - financing.total);
        const operatingRows = movementRows.filter((row) => row.category === 'OPERATING');
        const workingCapitalChange = operatingRows
            .filter((row) => ['ASSET', 'LIABILITY'].includes(String(row.account.classification || '').toUpperCase()))
            .reduce((sum, row) => sum + row.cashEffect, 0);
        const nonCashAdjustments = operatingRows
            .filter((row) => ['REVENUE', 'EXPENSE'].includes(String(row.account.classification || '').toUpperCase()) &&
            isLikelyNonCashPnl(row.account))
            .reduce((sum, row) => sum - row.cashEffect, 0);
        const operatingItems = [{ name: 'Net Income', amount: round2(netIncome) }];
        if (isNonZero(nonCashAdjustments)) {
            operatingItems.push({ name: 'Non-Cash Adjustments', amount: round2(nonCashAdjustments) });
        }
        operatingItems.push({ name: 'Working Capital Changes', amount: round2(workingCapitalChange) });
        const derivedOperating = (((_a = operatingItems[0]) === null || _a === void 0 ? void 0 : _a.amount) || 0) +
            (((_b = operatingItems.find((i) => i.name === 'Non-Cash Adjustments')) === null || _b === void 0 ? void 0 : _b.amount) || 0) +
            (((_c = operatingItems.find((i) => i.name === 'Working Capital Changes')) === null || _c === void 0 ? void 0 : _c.amount) || 0);
        const otherOperating = operatingTarget - derivedOperating;
        if (isNonZero(otherOperating)) {
            operatingItems.push({ name: 'Other Operating Movements', amount: round2(otherOperating) });
        }
        const operating = {
            items: operatingItems,
            total: round2(operatingTarget),
        };
        return {
            period: { from: effectiveFrom, to: effectiveTo },
            baseCurrency,
            netIncome: round2(netIncome),
            operating,
            investing,
            financing,
            netCashChange: roundedNetCashChange,
            openingCashBalance: round2(openingCashBalance),
            closingCashBalance: round2(closingCashBalance),
        };
    }
}
exports.GetCashFlowStatementUseCase = GetCashFlowStatementUseCase;
//# sourceMappingURL=CashFlowUseCases.js.map