"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseYearUseCase = exports.ReopenPeriodUseCase = exports.ClosePeriodUseCase = exports.ListFiscalYearsUseCase = exports.CreateFiscalYearUseCase = void 0;
const crypto_1 = require("crypto");
const FiscalYear_1 = require("../../../domain/accounting/entities/FiscalYear");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const iso = (d) => d.toISOString().split('T')[0];
const generatePeriods = (year, startMonth) => {
    const periods = [];
    for (let i = 0; i < 12; i++) {
        const start = new Date(year, startMonth - 1 + i, 1);
        const end = new Date(year, startMonth - 1 + i + 1, 0);
        const id = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        const name = start.toLocaleString('en', { month: 'long', year: 'numeric' });
        periods.push({
            id,
            name,
            startDate: iso(start),
            endDate: iso(end),
            status: FiscalYear_1.PeriodStatus.OPEN
        });
    }
    return periods;
};
class CreateFiscalYearUseCase {
    constructor(fiscalYearRepo, companyRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.companyRepo = companyRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, params) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const startMonth = Math.min(Math.max(params.startMonth, 1), 12);
        const startDate = new Date(params.year, startMonth - 1, 1);
        const endDate = new Date(params.year, startMonth - 1 + 12, 0);
        const id = `FY${params.year}`;
        const name = params.name || `Fiscal Year ${params.year}`;
        const periods = generatePeriods(params.year, startMonth);
        const fy = new FiscalYear_1.FiscalYear(id, companyId, name, iso(startDate), iso(endDate), FiscalYear_1.FiscalYearStatus.OPEN, periods, undefined, new Date(), userId);
        await this.fiscalYearRepo.save(fy);
        return fy;
    }
}
exports.CreateFiscalYearUseCase = CreateFiscalYearUseCase;
class ListFiscalYearsUseCase {
    constructor(fiscalYearRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.read');
        return this.fiscalYearRepo.findByCompany(companyId);
    }
}
exports.ListFiscalYearsUseCase = ListFiscalYearsUseCase;
class ClosePeriodUseCase {
    constructor(fiscalYearRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId, periodId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        const updated = fy.closePeriod(periodId, userId);
        await this.fiscalYearRepo.update(updated);
        return updated;
    }
}
exports.ClosePeriodUseCase = ClosePeriodUseCase;
class ReopenPeriodUseCase {
    constructor(fiscalYearRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId, periodId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        const updated = fy.reopenPeriod(periodId);
        await this.fiscalYearRepo.update(updated);
        return updated;
    }
}
exports.ReopenPeriodUseCase = ReopenPeriodUseCase;
class CloseYearUseCase {
    constructor(fiscalYearRepo, ledgerRepo, accountRepo, companyRepo, voucherRepo, transactionManager, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
        this.companyRepo = companyRepo;
        this.voucherRepo = voucherRepo;
        this.transactionManager = transactionManager;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId, params) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        const asOfDate = fy.endDate;
        const company = await this.companyRepo.findById(companyId).catch(() => null);
        const baseCurrency = (company === null || company === void 0 ? void 0 : company.baseCurrency) || 'USD';
        const trial = await this.ledgerRepo.getTrialBalance(companyId, asOfDate);
        const accounts = await this.accountRepo.list(companyId);
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        const tbMap = new Map(trial.map((r) => [r.accountId, r]));
        let revenueTotal = 0;
        let expenseTotal = 0;
        const lines = [];
        accounts.forEach((acc) => {
            const tb = tbMap.get(acc.id);
            if (!tb)
                return;
            const net = (tb.debit || 0) - (tb.credit || 0); // debit positive
            if (acc.classification === 'REVENUE') {
                const amount = Math.abs(net);
                revenueTotal += amount;
                if (amount > 0) {
                    lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, acc.id, 'Debit', amount, baseCurrency, amount, baseCurrency, 1));
                }
            }
            else if (acc.classification === 'EXPENSE') {
                const amount = Math.abs(net);
                expenseTotal += amount;
                if (amount > 0) {
                    lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, acc.id, 'Credit', amount, baseCurrency, amount, baseCurrency, 1));
                }
            }
        });
        const netIncome = revenueTotal - expenseTotal; // positive = profit
        const retainedSide = netIncome >= 0 ? 'Credit' : 'Debit';
        const retainedAmount = Math.abs(netIncome);
        if (retainedAmount > 0) {
            const retainedAccount = accountMap.get(params.retainedEarningsAccountId);
            if (!retainedAccount)
                throw new Error('Retained earnings account not found');
            lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, retainedSide, retainedAmount, baseCurrency, retainedAmount, baseCurrency, 1));
        }
        const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
        const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error('Closing entry not balanced');
        }
        const voucherId = (0, crypto_1.randomUUID)();
        const voucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, `CLOSE-${fy.id}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, asOfDate, `Year-end closing for ${fy.name}`, baseCurrency, baseCurrency, 1, lines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, { systemGenerated: true, closingFiscalYear: fy.id }, userId, new Date(), userId, new Date());
        const posted = voucher.post(userId, new Date(), VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED);
        await this.transactionManager.runTransaction(async (tx) => {
            await this.ledgerRepo.recordForVoucher(posted, tx);
            await this.voucherRepo.save(posted);
            const closed = fy.closeYear(userId, posted.id);
            await this.fiscalYearRepo.update(closed);
        });
        return { voucherId: posted.id };
    }
}
exports.CloseYearUseCase = CloseYearUseCase;
//# sourceMappingURL=FiscalYearUseCases.js.map