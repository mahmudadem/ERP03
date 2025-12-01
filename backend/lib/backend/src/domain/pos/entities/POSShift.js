"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSShift = void 0;
class POSShift {
    constructor(id, companyId, userId, openedAt, openingBalance, closedAt, closingBalance) {
        this.id = id;
        this.companyId = companyId;
        this.userId = userId;
        this.openedAt = openedAt;
        this.openingBalance = openingBalance;
        this.closedAt = closedAt;
        this.closingBalance = closingBalance;
    }
    isOpen() {
        return !this.closedAt;
    }
}
exports.POSShift = POSShift;
//# sourceMappingURL=POSShift.js.map