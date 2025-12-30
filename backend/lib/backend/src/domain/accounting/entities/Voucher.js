"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Voucher = void 0;
class Voucher {
    constructor(id, companyId, type, date, currency, exchangeRate, status, totalDebit, totalCredit, createdBy, reference = null, lines = []) {
        this.id = id;
        this.companyId = companyId;
        this.type = type;
        this.date = date;
        this.currency = currency;
        this.exchangeRate = exchangeRate;
        this.status = status;
        this.totalDebit = totalDebit;
        this.totalCredit = totalCredit;
        this.createdBy = createdBy;
        this.reference = reference;
        this.lines = lines;
        this.metadata = {};
    }
    /**
     * Check if voucher can be edited (only DRAFT or REJECTED status)
     */
    get canEdit() {
        var _a;
        const s = (_a = this.status) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        return s === 'DRAFT' || s === 'REJECTED';
    }
    /**
     * Check if voucher is in draft status
     */
    get isDraft() {
        var _a;
        return ((_a = this.status) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'DRAFT';
    }
}
exports.Voucher = Voucher;
//# sourceMappingURL=Voucher.js.map