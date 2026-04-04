"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSOStatus = exports.addDaysToISODate = exports.roundMoney = void 0;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
exports.roundMoney = roundMoney;
const addDaysToISODate = (isoDate, days) => {
    const [year, month, day] = isoDate.split('-').map((part) => Number(part));
    const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    date.setUTCDate(date.getUTCDate() + days);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};
exports.addDaysToISODate = addDaysToISODate;
const updateSOStatus = (so) => {
    if (so.status === 'CANCELLED' || so.status === 'CLOSED') {
        return so.status;
    }
    const allLinesFullyDelivered = so.lines.every((line) => line.deliveredQty >= line.orderedQty);
    const anyLineDelivered = so.lines.some((line) => line.deliveredQty > 0);
    if (allLinesFullyDelivered)
        return 'FULLY_DELIVERED';
    if (anyLineDelivered)
        return 'PARTIALLY_DELIVERED';
    return so.status;
};
exports.updateSOStatus = updateSOStatus;
//# sourceMappingURL=SalesPostingHelpers.js.map