"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherLine = void 0;
class VoucherLine {
    constructor(id, voucherId, accountId, description = null, fxAmount = 0, baseAmount = 0, rateAccToBase = 1, costCenterId) {
        this.id = id;
        this.voucherId = voucherId;
        this.accountId = accountId;
        this.description = description;
        this.fxAmount = fxAmount;
        this.baseAmount = baseAmount;
        this.rateAccToBase = rateAccToBase;
        this.costCenterId = costCenterId;
        this.metadata = {};
    }
}
exports.VoucherLine = VoucherLine;
//# sourceMappingURL=VoucherLine.js.map