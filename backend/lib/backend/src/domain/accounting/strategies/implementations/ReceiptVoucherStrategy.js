"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptVoucherStrategy = void 0;
const VoucherLine_1 = require("../../entities/VoucherLine");
const crypto_1 = require("crypto");
class ReceiptVoucherStrategy {
    async generateLines(header, companyId) {
        // Expected header: { customerAccountId, cashAccountId, amount, currency, exchangeRate, description }
        const lines = [];
        const amount = Number(header.amount) || 0;
        const exchangeRate = Number(header.exchangeRate) || 1;
        const baseAmount = amount * exchangeRate;
        // Line 1: Debit Cash/Bank
        const cashLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', // voucherId will be set by UseCase
        header.cashAccountId, header.description || 'Receipt into Cash/Bank');
        cashLine.debitFx = amount;
        cashLine.creditFx = 0;
        cashLine.debitBase = baseAmount;
        cashLine.creditBase = 0;
        cashLine.exchangeRate = exchangeRate;
        cashLine.lineCurrency = header.currency;
        lines.push(cashLine);
        // Line 2: Credit Customer (Receivable)
        const customerLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', header.customerAccountId, header.description || 'Receipt from Customer');
        customerLine.debitFx = 0;
        customerLine.creditFx = amount;
        customerLine.debitBase = 0;
        customerLine.creditBase = baseAmount;
        customerLine.exchangeRate = exchangeRate;
        customerLine.lineCurrency = header.currency;
        lines.push(customerLine);
        return lines;
    }
}
exports.ReceiptVoucherStrategy = ReceiptVoucherStrategy;
//# sourceMappingURL=ReceiptVoucherStrategy.js.map