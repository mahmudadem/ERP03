"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCreateRetainedEarningsUseCase = exports.EnableSpecialPeriodsUseCase = exports.DeleteFiscalYearUseCase = exports.ReopenYearUseCase = exports.CommitYearCloseUseCase = exports.CloseYearUseCase = exports.ReopenPeriodUseCase = exports.ClosePeriodUseCase = exports.ListFiscalYearsUseCase = exports.CreateFiscalYearUseCase = void 0;
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
        // If there is already a DRAFT closing voucher for this year, we delete it before regenerating
        if (fy.closingVoucherId) {
            const existingDraft = await this.voucherRepo.findById(companyId, fy.closingVoucherId);
            if (existingDraft && !existingDraft.isPosted) {
                await this.voucherRepo.delete(companyId, fy.closingVoucherId);
            }
            else if (existingDraft && existingDraft.isPosted) {
                throw new Error('This year is already closed and has a posted closing voucher.');
            }
        }
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
        // We will accumulate exactly how much hitting the P&L Clearing Account
        let clearingNetCredit = 0; // Positive = we are crediting clearing (Net Profit)
        const useClearing = !!params.pandLClearingAccountId;
        accounts.forEach((acc) => {
            const tb = tbMap.get(acc.id);
            if (!tb)
                return;
            const net = (tb.debit || 0) - (tb.credit || 0); // debit positive
            if (acc.classification === 'REVENUE') {
                const amount = Math.abs(net);
                revenueTotal += amount;
                if (amount > 0) {
                    // Normal Revenue is Credit. To close it, we Debit it.
                    // If the net is DEBIT (abnormal), we Credit it to close it.
                    const sideToClose = net > 0 ? 'Credit' : 'Debit';
                    lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, acc.id, sideToClose, amount, baseCurrency, amount, baseCurrency, 1));
                    if (useClearing) {
                        // Offset goes to P&L Clearing
                        const clearingSide = sideToClose === 'Debit' ? 'Credit' : 'Debit';
                        lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.pandLClearingAccountId, clearingSide, amount, baseCurrency, amount, baseCurrency, 1));
                        clearingNetCredit += (clearingSide === 'Credit' ? amount : -amount);
                    }
                }
            }
            else if (acc.classification === 'EXPENSE') {
                const amount = Math.abs(net);
                expenseTotal += amount;
                if (amount > 0) {
                    // Normal Expense is Debit. To close it, we Credit it.
                    // If the net is CREDIT (abnormal), we Debit it to close it.
                    const sideToClose = net > 0 ? 'Credit' : 'Debit';
                    lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, acc.id, sideToClose, amount, baseCurrency, amount, baseCurrency, 1));
                    if (useClearing) {
                        const clearingSide = sideToClose === 'Debit' ? 'Credit' : 'Debit';
                        lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.pandLClearingAccountId, clearingSide, amount, baseCurrency, amount, baseCurrency, 1));
                        clearingNetCredit += (clearingSide === 'Credit' ? amount : -amount);
                    }
                }
            }
        });
        const netIncome = revenueTotal - expenseTotal; // positive = profit
        const summary = {
            revenueTotal,
            expenseTotal,
            netIncome,
            baseCurrency
        };
        const retainedAccount = accountMap.get(params.retainedEarningsAccountId);
        if (!retainedAccount)
            throw new Error('Retained earnings account not found');
        if (useClearing) {
            // We must clear the P&L Clearing account to Retained Earnings
            // clearingNetCredit is the net balance sitting in P&L Clearing right now (Credit = Profit)
            // To close it out, if it's Credit, we Debit the Clearing Account and Credit Retained Earnings
            if (clearingNetCredit !== 0) {
                const sideToCloseClearing = clearingNetCredit > 0 ? 'Debit' : 'Credit';
                const sideForRetained = clearingNetCredit > 0 ? 'Credit' : 'Debit';
                const amount = Math.abs(clearingNetCredit);
                lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.pandLClearingAccountId, sideToCloseClearing, amount, baseCurrency, amount, baseCurrency, 1));
                lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, sideForRetained, amount, baseCurrency, amount, baseCurrency, 1));
            }
            else {
                // Both zero, just anchor Retained Earnings to make the voucher valid
                lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, 'Credit', 0, baseCurrency, 0, baseCurrency, 1));
                lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, 'Debit', 0, baseCurrency, 0, baseCurrency, 1));
            }
        }
        else {
            // Direct routing (NO P&L Clearing)
            const retainedSide = netIncome >= 0 ? 'Credit' : 'Debit';
            const retainedAmount = Math.abs(netIncome);
            lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, retainedSide, retainedAmount, baseCurrency, retainedAmount, baseCurrency, 1));
            if (lines.length === 1 && retainedAmount === 0) {
                lines.push(new VoucherLineEntity_1.VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, 'Debit', 0, baseCurrency, 0, baseCurrency, 1));
            }
        }
        const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
        const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Closing entry not balanced (Debit: ${totalDebit}, Credit: ${totalCredit}). Check account classifications.`);
        }
        const voucherId = (0, crypto_1.randomUUID)();
        const voucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, `CLOSE-${fy.id.substring(0, 8).toUpperCase()}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, asOfDate, `Year-end closing for ${fy.name}`, baseCurrency, baseCurrency, 1, lines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.DRAFT, // IMPORTANT: Now saved as DRAFT
        { systemGenerated: true, closingFiscalYear: fy.id, clearingAccountUsed: useClearing }, userId, new Date(), undefined, // not approved yet
        undefined);
        // Link the DRAFT voucher to the FY without actually "Closing" the FY yet
        const updatedFy = new FiscalYear_1.FiscalYear(fy.id, fy.companyId, fy.name, fy.startDate, fy.endDate, fy.status, fy.periods, voucher.id, // Set the closingVoucherId to our new Draft
        fy.createdAt, fy.createdBy, fy.periodScheme, fy.specialPeriodsCount);
        await this.transactionManager.runTransaction(async (tx) => {
            await this.voucherRepo.save(voucher, tx);
            await this.fiscalYearRepo.update(updatedFy);
        });
        return Object.assign({ voucherId: voucher.id }, summary);
    }
}
exports.CloseYearUseCase = CloseYearUseCase;
class CommitYearCloseUseCase {
    constructor(fiscalYearRepo, voucherRepo, ledgerRepo, transactionManager, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.transactionManager = transactionManager;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        if (!fy.closingVoucherId) {
            throw new Error('No draft closing voucher found for this fiscal year. Please generate one first.');
        }
        const draftVoucher = await this.voucherRepo.findById(companyId, fy.closingVoucherId);
        if (!draftVoucher)
            throw new Error('Draft closing voucher not found');
        if (draftVoucher.isPosted) {
            throw new Error('Closing voucher is already posted.');
        }
        // Approve and Post the draft voucher
        const approved = draftVoucher.approve(userId, new Date());
        const posted = approved.post(userId, new Date(), VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED);
        // Finally, close the Fiscal Year strictly
        const closedFy = fy.closeYear(userId, posted.id);
        await this.transactionManager.runTransaction(async (tx) => {
            await this.voucherRepo.save(posted, tx);
            await this.ledgerRepo.recordForVoucher(posted, tx);
            await this.fiscalYearRepo.update(closedFy);
        });
        return {
            voucherId: posted.id,
            success: true
        };
    }
}
exports.CommitYearCloseUseCase = CommitYearCloseUseCase;
class ReopenYearUseCase {
    constructor(fiscalYearRepo, voucherRepo, ledgerRepo, transactionManager, permissionChecker) {
        this.fiscalYearRepo = fiscalYearRepo;
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.transactionManager = transactionManager;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, fiscalYearId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        // Audit Correction: If there is a closing voucher, we must reverse it
        let reversalVoucher = null;
        let originalVoucher = null;
        if (fy.closingVoucherId) {
            originalVoucher = await this.voucherRepo.findById(companyId, fy.closingVoucherId);
            if (originalVoucher && originalVoucher.isPosted) {
                const ledgerLines = await this.ledgerRepo.getGeneralLedger(companyId, { voucherId: originalVoucher.id });
                reversalVoucher = originalVoucher.createReversal((0, crypto_1.randomUUID)(), iso(new Date()), // Today
                (0, crypto_1.randomUUID)(), userId, ledgerLines, `Invalidating closure of ${fy.name} for adjustments.`);
                // Link and mark as reversed for audit trail
                originalVoucher = originalVoucher.markAsReversed(reversalVoucher.id);
                // Auto-approve and post the reversal (system event)
                reversalVoucher = reversalVoucher.approve(userId, new Date());
                reversalVoucher = reversalVoucher.post(userId, new Date(), VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED);
            }
        }
        const updated = fy.reopenYear();
        await this.transactionManager.runTransaction(async (tx) => {
            if (reversalVoucher && originalVoucher) {
                await this.voucherRepo.save(originalVoucher, tx); // Save with isReversed flag from createReversal
                await this.voucherRepo.save(reversalVoucher, tx);
                await this.ledgerRepo.recordForVoucher(reversalVoucher, tx);
            }
            await this.fiscalYearRepo.update(updated);
        });
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
        // Idempotency Check: find existing retained earnings account
        // Primary: field-based lookup (reliable)
        // Fallback: name-based lookup (backward compat for old COA without tags)
        const existing = accounts.find(a => a.equitySubgroup === 'RETAINED_EARNINGS')
            || accounts.find(a => a.name.trim().toLowerCase() === 'retained earnings');
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
            isProtected: true,
            equitySubgroup: 'RETAINED_EARNINGS'
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