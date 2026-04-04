"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePOStatus = exports.addDaysToISODate = exports.roundMoney = void 0;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
exports.roundMoney = roundMoney;
const addDaysToISODate = (isoDate, days) => {
    const [year, month, day] = isoDate.split('-').map((part) => Number(part));
    const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    date.setUTCDate(date.getUTCDate() + days);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};
exports.addDaysToISODate = addDaysToISODate;
const updatePOStatus = (po) => {
    if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
        return po.status;
    }
    const allLinesFullyReceived = po.lines.every((line) => !line.trackInventory || line.receivedQty >= line.orderedQty);
    const anyLinePartiallyReceived = po.lines.some((line) => line.receivedQty > 0 && line.receivedQty < line.orderedQty);
    if (allLinesFullyReceived)
        return 'FULLY_RECEIVED';
    if (anyLinePartiallyReceived)
        return 'PARTIALLY_RECEIVED';
    return po.status;
};
exports.updatePOStatus = updatePOStatus;
//# sourceMappingURL=PurchasePostingHelpers.js.map