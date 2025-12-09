"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferVoucherStrategy = void 0;
const VoucherLine_1 = require("../../entities/VoucherLine");
const crypto_1 = require("crypto");
class TransferVoucherStrategy {
    async generateLines(header, companyId) {
        // Expected header: { fromAccountId, toAccountId, amount, currency, exchangeRate, description }
        const lines = [];
        const amount = Number(header.amount) || 0;
        const exchangeRate = Number(header.exchangeRate) || 1;
        const baseAmount = amount * exchangeRate;
        // Line 1: Debit To Account (Receiving)
        const toLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', header.toAccountId, header.description || 'Transfer In');
        toLine.debitFx = amount;
        toLine.creditFx = 0;
        toLine.debitBase = baseAmount;
        toLine.creditBase = 0;
        toLine.exchangeRate = exchangeRate;
        toLine.lineCurrency = header.currency;
        lines.push(toLine);
        // Line 2: Credit From Account (Sending)
        const fromLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', header.fromAccountId, header.description || 'Transfer Out');
        fromLine.debitFx = 0;
        fromLine.creditFx = amount;
        fromLine.debitBase = 0;
        fromLine.creditBase = baseAmount;
        fromLine.exchangeRate = exchangeRate;
        fromLine.lineCurrency = header.currency;
        lines.push(fromLine);
        return lines;
    }
}
exports.TransferVoucherStrategy = TransferVoucherStrategy;
//# sourceMappingURL=TransferVoucherStrategy.js.map