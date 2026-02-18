"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCreateRetainedEarningsUseCase = exports.EnableSpecialPeriodsUseCase = exports.DeleteFiscalYearUseCase = exports.ReopenYearUseCase = exports.CloseYearUseCase = exports.ReopenPeriodUseCase = exports.ClosePeriodUseCase = exports.ListFiscalYearsUseCase = exports.CreateFiscalYearUseCase = void 0;
const crypto_1 = require("crypto");
const FiscalYear_1 = require("../../../domain/accounting/entities/FiscalYear");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const AppError_1 = require("../../../errors/AppError");
const ErrorCodes_1 = require("../../../errors/ErrorCodes");
const iso = (d) => d.toISOString().split('T')[0];
const FiscalPeriodGenerator_1 = require("../../../domain/accounting/services/FiscalPeriodGenerator");
class CreateFiscalYearUseCase {
    constructor(fiscalYearRepo, companyRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.companyRepo = companyRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, params) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        // Default scheme to MONTHLY if not provided
        const scheme = params.periodScheme || FiscalYear_1.PeriodScheme.MONTHLY;
        // Validate Period Scheme
        if (!Object.values(FiscalYear_1.PeriodScheme).includes(scheme)) {
            const err = new Error('Invalid Period Scheme');
            err.code = 'INVALID_PERIOD_SCHEME';
            err.details = { periodScheme: scheme };
            throw err;
        }
        const startMonth = Math.min(Math.max(params.startMonth, 1), 12);
        let yearNum;
        if (typeof params.year === 'string') {
            const d = new Date(params.year);
            yearNum = d.getFullYear();
        }
        else {
            yearNum = params.year;
        }
        const startDate = new Date(yearNum, startMonth - 1, 1);
        const endDate = new Date(yearNum, startMonth - 1 + 12, 0);
        // Prevent Overlapping Fiscal Years
        const existingYears = await this.fiscalYearRepo.findByCompany(companyId);
        const startIso = iso(startDate);
        const endIso = iso(endDate);
        const overlap = existingYears.find(fy => {
            return fy.startDate <= endIso && fy.endDate >= startIso;
        });
        if (overlap) {
            const err = new Error(`Overlapping fiscal year found: ${overlap.name} (${overlap.startDate} to ${overlap.endDate})`);
            err.code = 'FISCAL_YEAR_OVERLAP';
            err.status = 400;
            throw err;
        }
        // Special periods are NEVER created automatically anymore as per user request.
        // They are added later via EnableSpecialPeriodsUseCase.
        const spCount = 0;
        const periods = FiscalPeriodGenerator_1.FiscalPeriodGenerator.generate(startDate, endDate, scheme, spCount);
        const fyId = `FY${endDate.getFullYear()}`;
        const fiscalYear = new FiscalYear_1.FiscalYear(fyId, companyId, params.name || `Fiscal Year ${endDate.getFullYear()}`, iso(startDate), iso(endDate), FiscalYear_1.FiscalYearStatus.OPEN, periods, undefined, new Date(), userId, scheme, spCount);
        await this.fiscalYearRepo.save(fiscalYear);
        return fiscalYear;
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
        if (fy.status === 'CLOSED') {
            throw new Error('Cannot change period status because the fiscal year is closed.');
        }
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
        if (fy.status === 'CLOSED') {
            throw new Error('Cannot change period status because the fiscal year is closed.');
        }
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
        // If no P&L balances exist, we don't need a closing voucher
        if (lines.length === 0) {
            await this.transactionManager.runTransaction(async (tx) => {
                const closed = fy.closeYear(userId, 'NO_VOUCHER_NEEDED');
                await this.fiscalYearRepo.update(closed);
            });
            return { voucherId: null, message: 'Fiscal year closed. No closing voucher was needed as all Revenue and Expense accounts have zero balances.' };
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
class ReopenYearUseCase {
    constructor(fiscalYearRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        const updated = fy.reopenYear();
        await this.fiscalYearRepo.update(updated);
        return updated;
    }
}
exports.ReopenYearUseCase = ReopenYearUseCase;
class DeleteFiscalYearUseCase {
    constructor(fiscalYearRepo, voucherRepo, // Added dependency
    permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy) {
            throw new Error('Fiscal year not found');
        }
        // Prevent deletion if the year is CLOSED
        if (fy.status === FiscalYear_1.FiscalYearStatus.CLOSED) {
            throw new Error('Cannot delete a CLOSED fiscal year. You must reopen it first.');
        }
        // Prevent deletion if any period is CLOSED (includes special periods)
        const hasClosedPeriods = fy.periods.some(p => p.status === FiscalYear_1.PeriodStatus.CLOSED);
        if (hasClosedPeriods) {
            throw new Error('Cannot delete fiscal year with CLOSED periods. Open all periods first.');
        }
        // NEW BLOCK: Prevent deletion if ANY vouchers exist for this year
        // This protects data integrity and prevents orphaning special period vouchers
        const vouchers = await this.voucherRepo.findByDateRange(companyId, fy.startDate, fy.endDate, 1);
        if (vouchers.length > 0) {
            throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.ACC_FISCAL_YEAR_DELETE_FORBIDDEN, `Cannot delete Fiscal Year "${fy.name}". It contains vouchers. You must delete or move the vouchers first.`, { fyId: fiscalYearId, voucherCount: 'at least 1' });
        }
        // Ideally we should also check if there are any POSTED vouchers in this period range.
        // However, since vouchers are linked by DATE and not FY ID, deleting the FY definition 
        // doesn't orphan the vouchers, it just removes the "container".
        // Re-creating the FY later will re-capture them.
        // So deletion is safe regarding data integrity, but might be confusing.
        // We will allow it for open years.
        await this.fiscalYearRepo.delete(companyId, fiscalYearId);
    }
}
exports.DeleteFiscalYearUseCase = DeleteFiscalYearUseCase;
class EnableSpecialPeriodsUseCase {
    constructor(fiscalYearRepo, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId, definitions) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const count = definitions.length;
        if (count < 0 || count > 4) {
            throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.VAL_INVALID_RANGE, 'Special periods count must be between 0 and 4', { count });
        }
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.FISCAL_YEAR_NOT_FOUND, 'Fiscal year not found');
        const dStart = new Date(fy.startDate);
        const dEnd = new Date(fy.endDate);
        const newPeriodsList = FiscalPeriodGenerator_1.FiscalPeriodGenerator.generate(dStart, dEnd, fy.periodScheme, count);
        // Apply custom names to special periods
        const namedPeriods = newPeriodsList.map(p => {
            var _a;
            if (p.isSpecial) {
                const defIndex = p.periodNo - 13;
                if ((_a = definitions[defIndex]) === null || _a === void 0 ? void 0 : _a.name) {
                    return Object.assign(Object.assign({}, p), { name: definitions[defIndex].name });
                }
            }
            return p;
        });
        // Merge existing status into new list
        const mergedPeriods = namedPeriods.map(newP => {
            const existing = fy.periods.find(p => p.id === newP.id);
            if (existing) {
                return Object.assign(Object.assign({}, newP), { status: existing.status, closedAt: existing.closedAt, closedBy: existing.closedBy, lockedAt: existing.lockedAt, lockedBy: existing.lockedBy, metadata: Object.assign(Object.assign({}, existing.metadata), newP.metadata) });
            }
            return newP;
        });
        const updated = new FiscalYear_1.FiscalYear(fy.id, fy.companyId, fy.name, fy.startDate, fy.endDate, fy.status, mergedPeriods, fy.closingVoucherId, fy.createdAt, fy.createdBy, fy.periodScheme, count);
        await this.fiscalYearRepo.update(updated);
        return updated;
    }
}
exports.EnableSpecialPeriodsUseCase = EnableSpecialPeriodsUseCase;
class AutoCreateRetainedEarningsUseCase {
    constructor(accountRepo, permissionChecker) {
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const accounts = await this.accountRepo.list(companyId);
        // Idempotency Check: Look for existing "Retained Earnings"
        const existing = accounts.find(a => a.name.trim().toLowerCase() === 'retained earnings');
        if (existing) {
            return {
                account: existing,
                created: false,
                message: 'Retained Earnings account already exists.'
            };
        }
        // Find a free code starting at 30200
        let code = 30200;
        const usedCodes = new Set(accounts.map(a => a.userCode));
        while (usedCodes.has(code.toString())) {
            code++;
        }
        const finalCode = code.toString();
        // Create the account
        const newAccount = await this.accountRepo.create(companyId, {
            userCode: finalCode,
            name: 'Retained Earnings',
            classification: 'EQUITY',
            createdBy: userId,
            description: 'System-generated account for annual profit/loss retention.',
            balanceNature: 'CREDIT',
            isProtected: true // Protect system account
        });
        return {
            account: newAccount,
            created: true,
            message: `Created Retained Earnings account with code ${finalCode}`
        };
    }
}
exports.AutoCreateRetainedEarningsUseCase = AutoCreateRetainedEarningsUseCase;
//# sourceMappingURL=FiscalYearUseCases.js.map