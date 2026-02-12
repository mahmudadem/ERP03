"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Budget = void 0;
class Budget {
    constructor(id, companyId, fiscalYearId, name, version, status, lines, createdAt, createdBy, updatedAt, updatedBy) {
        this.id = id;
        this.companyId = companyId;
        this.fiscalYearId = fiscalYearId;
        this.name = name;
        this.version = version;
        this.status = status;
        this.lines = lines;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
        this.updatedAt = updatedAt;
        this.updatedBy = updatedBy;
        if (!lines || lines.length === 0) {
            throw new Error('Budget must contain at least one line');
        }
        lines.forEach((l, idx) => {
            if (!Array.isArray(l.monthlyAmounts) || l.monthlyAmounts.length !== 12) {
                throw new Error(`Line ${idx + 1} must have 12 monthly amounts`);
            }
            const total = l.monthlyAmounts.reduce((s, v) => s + (Number(v) || 0), 0);
            if (Math.abs(total - l.annualTotal) > 0.0001) {
                throw new Error(`Line ${idx + 1} annualTotal does not match sum of monthly amounts`);
            }
        });
    }
    approve(by, at) {
        return new Budget(this.id, this.companyId, this.fiscalYearId, this.name, this.version, 'APPROVED', this.lines, this.createdAt, this.createdBy, at, by);
    }
    close(by, at) {
        return new Budget(this.id, this.companyId, this.fiscalYearId, this.name, this.version, 'CLOSED', this.lines, this.createdAt, this.createdBy, at, by);
    }
}
exports.Budget = Budget;
//# sourceMappingURL=Budget.js.map