"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentVoucherStrategy = void 0;
const VoucherLine_1 = require("../../entities/VoucherLine");
const crypto_1 = require("crypto");
class PaymentVoucherStrategy {
    async generateLines(header, companyId) {
        // Expected header: { vendorAccountId, cashAccountId, amount, currency, exchangeRate, description }
        const lines = [];
        const amount = Number(header.amount) || 0;
        const exchangeRate = Number(header.exchangeRate) || 1;
        const baseAmount = amount * exchangeRate;
        // Line 1: Debit Vendor (Payable)
        const vendorLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', // voucherId will be set by UseCase
        header.vendorAccountId, header.description || 'Payment to Vendor');
        vendorLine.debitFx = amount;
        vendorLine.creditFx = 0;
        vendorLine.debitBase = baseAmount;
        vendorLine.creditBase = 0;
        vendorLine.exchangeRate = exchangeRate;
        vendorLine.lineCurrency = header.currency;
        lines.push(vendorLine);
        // Line 2: Credit Cash/Bank
        const cashLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', header.cashAccountId, header.description || 'Payment from Cash/Bank');
        cashLine.debitFx = 0;
        cashLine.creditFx = amount;
        cashLine.debitBase = 0;
        cashLine.creditBase = baseAmount;
        cashLine.exchangeRate = exchangeRate;
        cashLine.lineCurrency = header.currency;
        lines.push(cashLine);
        return lines;
    }
}
exports.PaymentVoucherStrategy = PaymentVoucherStrategy;
//# sourceMappingURL=PaymentVoucherStrategy.js.map