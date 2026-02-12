"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetConsolidatedTrialBalanceUseCase = void 0;
class GetConsolidatedTrialBalanceUseCase {
    constructor(groupRepo, companyRepo, ledgerRepo, accountRepo, rateRepo, permissionChecker) {
        this.groupRepo = groupRepo;
        this.companyRepo = companyRepo;
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.rateRepo = rateRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(groupId, companyId, userId, asOfDate) {
        var _a;
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const group = await this.groupRepo.findById(groupId);
        if (!group)
            throw new Error('Group not found');
        const memberCompanies = await Promise.all(group.members.map((m) => this.companyRepo.findById(m.companyId)));
        const reportingCurrency = group.reportingCurrency.toUpperCase();
        const linesMap = {};
        for (const member of memberCompanies) {
            if (!member)
                continue;
            const tb = await this.ledgerRepo.getTrialBalance(member.id, asOfDate);
            const baseCurrency = ((_a = member.baseCurrency) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || reportingCurrency;
            const fx = baseCurrency === reportingCurrency ? 1 : await this.getRate(member.id, baseCurrency, reportingCurrency, asOfDate);
            tb.forEach((row) => {
                const key = row.accountId;
                const debit = row.debit * fx;
                const credit = row.credit * fx;
                if (!linesMap[key]) {
                    linesMap[key] = Object.assign(Object.assign({}, row), { debit, credit });
                }
                else {
                    linesMap[key].debit += debit;
                    linesMap[key].credit += credit;
                }
            });
        }
        // compute balances
        const lines = Object.values(linesMap).map((r) => (Object.assign(Object.assign({}, r), { balance: (r.debit || 0) - (r.credit || 0) })));
        const totals = lines.reduce((acc, r) => ({
            debit: acc.debit + (r.debit || 0),
            credit: acc.credit + (r.credit || 0),
            balance: acc.balance + (r.balance || 0)
        }), { debit: 0, credit: 0, balance: 0 });
        return {
            groupId,
            reportingCurrency,
            asOfDate,
            lines,
            totals
        };
    }
    async getRate(companyId, from, to, date) {
        const rate = await this.rateRepo.getMostRecentRateBeforeDate(companyId, from, to, new Date(date));
        if (!rate)
            throw new Error(`Missing FX rate ${from}->${to} for ${date}`);
        return rate.rate;
    }
}
exports.GetConsolidatedTrialBalanceUseCase = GetConsolidatedTrialBalanceUseCase;
//# sourceMappingURL=ConsolidationUseCases.js.map