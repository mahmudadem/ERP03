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
    }
}
exports.Voucher = Voucher;
//# sourceMappingURL=Voucher.js.map