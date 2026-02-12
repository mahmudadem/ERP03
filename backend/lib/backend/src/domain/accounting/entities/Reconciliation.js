"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reconciliation = void 0;
class Reconciliation {
    constructor(id, companyId, accountId, bankStatementId, periodEnd, bookBalance, bankBalance, adjustments = [], status = 'IN_PROGRESS', completedAt, completedBy) {
        this.id = id;
        this.companyId = companyId;
        this.accountId = accountId;
        this.bankStatementId = bankStatementId;
        this.periodEnd = periodEnd;
        this.bookBalance = bookBalance;
        this.bankBalance = bankBalance;
        this.adjustments = adjustments;
        this.status = status;
        this.completedAt = completedAt;
        this.completedBy = completedBy;
    }
    complete(byUser, completedAt) {
        return new Reconciliation(this.id, this.companyId, this.accountId, this.bankStatementId, this.periodEnd, this.bookBalance, this.bankBalance, this.adjustments, 'COMPLETED', completedAt, byUser);
    }
    withAdjustments(adjustments) {
        return new Reconciliation(this.id, this.companyId, this.accountId, this.bankStatementId, this.periodEnd, this.bookBalance, this.bankBalance, adjustments, this.status, this.completedAt, this.completedBy);
    }
}
exports.Reconciliation = Reconciliation;
//# sourceMappingURL=Reconciliation.js.map