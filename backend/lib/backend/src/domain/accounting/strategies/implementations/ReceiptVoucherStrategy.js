"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptVoucherStrategy = void 0;
const VoucherLine_1 = require("../../entities/VoucherLine");
const crypto_1 = require("crypto");
/**
 * ReceiptVoucherStrategy
 *
 * MANY-TO-ONE Structure:
 * - MANY sources (lines with receiveFromAccountId) - receiving from different accounts
 * - ONE destination (depositToAccountId) - the account money goes to
 *
 * Example: Receive 500 TRY (at rate 35:1) from multiple customers to USD CashBox
 * Input:
 * {
 *   depositToAccountId: "acc_cashbox_usd",
 *   currency: "TRY",
 *   exchangeRate: 35,
 *   lines: [
 *     { receiveFromAccountId: "acc_customer_ali", amount: 300, notes: "Inv#101" },
 *     { receiveFromAccountId: "acc_customer_fatima", amount: 200, notes: "Inv#102" }
 *   ]
 * }
 *
 * Output GL Entries:
 * DR CashBox       500 TRY (14.29 USD base)
 * CR Customer Ali  300 TRY (8.57 USD base)
 * CR Customer Fatima 200 TRY (5.71 USD base)
 */
class ReceiptVoucherStrategy {
    async generateLines(header, companyId) {
        const lines = [];
        // Extract posting fields
        const depositToAccountId = header.depositToAccountId;
        const currency = header.currency || 'USD';
        const exchangeRate = Number(header.exchangeRate) || 1;
        const sources = header.lines || [];
        if (!depositToAccountId) {
            throw new Error('Receipt requires depositToAccountId (Deposit To account)');
        }
        if (!sources || sources.length === 0) {
            throw new Error('Receipt requires at least one source line');
        }
        // Calculate total from sources
        let totalFx = 0;
        // Generate single DEBIT line for destination account
        for (const source of sources) {
            const amountFx = Number(source.amount) || 0;
            totalFx += amountFx;
        }
        const totalBase = totalFx / exchangeRate;
        const debitLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', // voucherId set later
        depositToAccountId, header.description || 'Receipt deposited');
        debitLine.debitFx = totalFx;
        debitLine.creditFx = 0;
        debitLine.debitBase = totalBase;
        debitLine.creditBase = 0;
        debitLine.lineCurrency = currency;
        debitLine.exchangeRate = exchangeRate;
        debitLine.fxAmount = totalFx;
        debitLine.baseAmount = totalBase;
        lines.push(debitLine);
        // Generate CREDIT lines for each source
        for (const source of sources) {
            const amountFx = Number(source.amount) || 0;
            const amountBase = amountFx / exchangeRate;
            if (!source.receiveFromAccountId) {
                throw new Error('Each source must have receiveFromAccountId (Receive From account)');
            }
            const creditLine = new VoucherLine_1.VoucherLine((0, crypto_1.randomUUID)(), '', source.receiveFromAccountId, source.notes || source.description || 'Receipt source');
            creditLine.debitFx = 0;
            creditLine.creditFx = amountFx;
            creditLine.debitBase = 0;
            creditLine.creditBase = amountBase;
            creditLine.lineCurrency = currency;
            creditLine.exchangeRate = exchangeRate;
            creditLine.fxAmount = -amountFx;
            creditLine.baseAmount = -amountBase;
            lines.push(creditLine);
        }
        return lines;
    }
}
exports.ReceiptVoucherStrategy = ReceiptVoucherStrategy;
//# sourceMappingURL=ReceiptVoucherStrategy.js.map