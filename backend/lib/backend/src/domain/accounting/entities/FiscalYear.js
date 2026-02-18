"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscalYear = exports.PeriodScheme = exports.PeriodStatus = exports.FiscalYearStatus = void 0;
const AppError_1 = require("../../../errors/AppError");
const ErrorCodes_1 = require("../../../errors/ErrorCodes");
var FiscalYearStatus;
(function (FiscalYearStatus) {
    FiscalYearStatus["OPEN"] = "OPEN";
    FiscalYearStatus["CLOSED"] = "CLOSED";
    FiscalYearStatus["LOCKED"] = "LOCKED";
})(FiscalYearStatus = exports.FiscalYearStatus || (exports.FiscalYearStatus = {}));
var PeriodStatus;
(function (PeriodStatus) {
    PeriodStatus["OPEN"] = "OPEN";
    PeriodStatus["CLOSED"] = "CLOSED";
    PeriodStatus["LOCKED"] = "LOCKED";
})(PeriodStatus = exports.PeriodStatus || (exports.PeriodStatus = {}));
var PeriodScheme;
(function (PeriodScheme) {
    PeriodScheme["MONTHLY"] = "MONTHLY";
    PeriodScheme["QUARTERLY"] = "QUARTERLY";
    PeriodScheme["SEMI_ANNUAL"] = "SEMI_ANNUAL";
})(PeriodScheme = exports.PeriodScheme || (exports.PeriodScheme = {}));
/**
 * Fiscal Year aggregate to manage period-based posting control and year-end closing.
 */
class FiscalYear {
    constructor(id, // e.g., "FY2026"
    companyId, name, startDate, endDate, status, periods, closingVoucherId, createdAt, createdBy, periodScheme = PeriodScheme.MONTHLY, specialPeriodsCount = 0) {
        this.id = id;
        this.companyId = companyId;
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status;
        this.periods = periods;
        this.closingVoucherId = closingVoucherId;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
        this.periodScheme = periodScheme;
        this.specialPeriodsCount = specialPeriodsCount;
    }
    /**
     * Get period that contains the given ISO date or matches the specific postingPeriodNo.
     *
     * @param dateIso The voucher date
     * @param postingPeriodNo Optional override for special periods (13..16)
     */
    getPeriodForDate(dateIso, postingPeriodNo) {
        // 1. If postingPeriodNo is provided, prioritize it
        if (postingPeriodNo !== undefined && postingPeriodNo !== null) {
            // Find period by number
            const targetPeriod = this.periods.find(p => p.periodNo === postingPeriodNo);
            if (!targetPeriod)
                return undefined; // Period not found in this FY
            // Validation for Special Periods (13..16)
            if (targetPeriod.isSpecial) {
                // MUST fall on the last day of the fiscal year
                // MUST fall on the last day of the fiscal year
                if (dateIso !== this.endDate) {
                    throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.INVALID_SPECIAL_PERIOD_USAGE, 'Special Period can only be used on the fiscal year end date.', {
                        postingPeriodNo,
                        dateIso,
                        fyEndDate: this.endDate,
                        specialPeriodsCount: this.specialPeriodsCount
                    });
                }
            }
            return targetPeriod;
        }
        // 2. Default Date-Based Resolution
        const ts = new Date(dateIso).getTime();
        if (Number.isNaN(ts))
            return undefined;
        // Filter matching date ranges
        const matching = this.periods.filter((p) => {
            const start = new Date(p.startDate).getTime();
            const end = new Date(p.endDate).getTime();
            return ts >= start && ts <= end;
        });
        if (matching.length === 0)
            return undefined;
        // If overlaps exist (e.g. Regular P12 vs Special P13 on last day),
        // and NO override was provided, we MUST return the REGULAR period.
        // Special periods require explicit opt-in via postingPeriodNo.
        return matching.find(p => !p.isSpecial) || matching[0];
    }
    /**
     * Returns true if the date falls in an OPEN period.
     */
    isDatePostable(dateIso, postingPeriodNo) {
        const period = this.getPeriodForDate(dateIso, postingPeriodNo);
        if (!period)
            return false;
        return period.status === PeriodStatus.OPEN;
    }
    /**
     * Close a specific period; returns a new FiscalYear instance with updated period.
     */
    closePeriod(periodId, closedBy) {
        const updated = this.periods.map((p) => p.id === periodId
            ? Object.assign(Object.assign({}, p), { status: PeriodStatus.CLOSED, closedAt: new Date(), closedBy }) : p);
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, this.status, updated, this.closingVoucherId, this.createdAt, this.createdBy, this.periodScheme, this.specialPeriodsCount);
    }
    /**
     * Reopen a closed (not locked) period.
     */
    reopenPeriod(periodId) {
        const updated = this.periods.map((p) => p.id === periodId && p.status !== PeriodStatus.LOCKED
            ? Object.assign(Object.assign({}, p), { status: PeriodStatus.OPEN, closedAt: undefined, closedBy: undefined }) : p);
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, this.status, updated, this.closingVoucherId, this.createdAt, this.createdBy, this.periodScheme, this.specialPeriodsCount);
    }
    /**
     * Close the fiscal year (all periods should be closed already).
     */
    /**
     * Close the fiscal year (all periods should be closed already).
     */
    closeYear(closedBy, closingVoucherId) {
        const now = new Date();
        const updatedPeriods = this.periods.map(p => (Object.assign(Object.assign({}, p), { status: p.status === PeriodStatus.OPEN ? PeriodStatus.CLOSED : p.status, closedBy: p.status === PeriodStatus.OPEN ? closedBy : p.closedBy, closedAt: p.status === PeriodStatus.OPEN ? now : p.closedAt })));
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, FiscalYearStatus.CLOSED, updatedPeriods, closingVoucherId, this.createdAt, closedBy, this.periodScheme, this.specialPeriodsCount);
    }
    /**
     * Reopen a closed fiscal year.
     */
    reopenYear() {
        if (this.status === FiscalYearStatus.LOCKED) {
            throw new Error('Cannot reopen a LOCKED fiscal year.');
        }
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, FiscalYearStatus.OPEN, this.periods, undefined, // Clear closing voucher reference
        this.createdAt, this.createdBy, this.periodScheme, this.specialPeriodsCount);
    }
}
exports.FiscalYear = FiscalYear;
//# sourceMappingURL=FiscalYear.js.map