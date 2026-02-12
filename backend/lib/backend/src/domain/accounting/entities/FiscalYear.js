"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscalYear = exports.PeriodStatus = exports.FiscalYearStatus = void 0;
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
/**
 * Fiscal Year aggregate to manage period-based posting control and year-end closing.
 */
class FiscalYear {
    constructor(id, // e.g., "FY2026"
    companyId, name, startDate, endDate, status, periods, closingVoucherId, createdAt, createdBy) {
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
    }
    /**
     * Get period that contains the given ISO date.
     */
    getPeriodForDate(dateIso) {
        const ts = new Date(dateIso).getTime();
        if (Number.isNaN(ts))
            return undefined;
        return this.periods.find((p) => {
            const start = new Date(p.startDate).getTime();
            const end = new Date(p.endDate).getTime();
            return ts >= start && ts <= end;
        });
    }
    /**
     * Returns true if the date falls in an OPEN period.
     */
    isDatePostable(dateIso) {
        const period = this.getPeriodForDate(dateIso);
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
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, this.status, updated, this.closingVoucherId, this.createdAt, this.createdBy);
    }
    /**
     * Reopen a closed (not locked) period.
     */
    reopenPeriod(periodId) {
        const updated = this.periods.map((p) => p.id === periodId && p.status !== PeriodStatus.LOCKED
            ? Object.assign(Object.assign({}, p), { status: PeriodStatus.OPEN, closedAt: undefined, closedBy: undefined }) : p);
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, this.status, updated, this.closingVoucherId, this.createdAt, this.createdBy);
    }
    /**
     * Close the fiscal year (all periods should be closed already).
     */
    closeYear(closedBy, closingVoucherId) {
        return new FiscalYear(this.id, this.companyId, this.name, this.startDate, this.endDate, FiscalYearStatus.CLOSED, this.periods, closingVoucherId, this.createdAt, closedBy);
    }
}
exports.FiscalYear = FiscalYear;
//# sourceMappingURL=FiscalYear.js.map