"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptVoucherStrategy = void 0;
const VoucherLineEntity_1 = require("../../entities/VoucherLineEntity");
/**
 * ReceiptVoucherStrategy
 *
 * MANY-TO-ONE Structure:
 * - MANY sources (lines with receiveFromAccountId) - receiving from different accounts
 * - ONE destination (depositToAccountId) - the account money goes to
 *
 * Example: Receive 500 TRY from multiple customers to USD CashBox
 * Input:
 * {
 *   depositToAccountId: "acc_cashbox_usd",
 *   currency: "TRY",
 *   exchangeRate: 0.03,
 *   lines: [
 *     { receiveFromAccountId: "acc_customer_ali", amount: 300, notes: "Inv#101" },
 *     { receiveFromAccountId: "acc_customer_fatima", amount: 200, notes: "Inv#102" }
 *   ]
 * }
 */
class ReceiptVoucherStrategy {
    async generateLines(header, companyId, baseCurrency) {
        const lines = [];
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
        let totalFx = 0;
        let totalBaseCalculated = 0;
        const tempLines = [];
        // 1. Generate CREDIT lines for each source first
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const amountFx = Number(source.amount) || 0;
            const amountBase = (0, VoucherLineEntity_1.roundMoney)(amountFx * exchangeRate);
            totalFx = (0, VoucherLineEntity_1.roundMoney)(totalFx + amountFx);
            totalBaseCalculated = (0, VoucherLineEntity_1.roundMoney)(totalBaseCalculated + amountBase);
            if (!source.receiveFromAccountId) {
                throw new Error(`Line ${i + 1}: Source must have receiveFromAccountId`);
            }
            const creditCurrency = currency.toUpperCase();
            const creditLine = new VoucherLineEntity_1.VoucherLineEntity(i + 2, // Leave index 1 for the debit line
            source.receiveFromAccountId, 'Credit', amountBase, // baseAmount
            baseCurrency, // baseCurrency
            amountFx, // amount
            creditCurrency, // currency
            exchangeRate, source.notes || source.description || 'Receipt source', source.costCenterId, source.metadata || {});
            tempLines.push(creditLine);
        }
        // 2. Generate single DEBIT line for destination account using SUM OF CREDITS
        const debitCurrency = currency.toUpperCase();
        const debitLine = new VoucherLineEntity_1.VoucherLineEntity(1, depositToAccountId, 'Debit', totalBaseCalculated, // baseAmount (SUM OF CREDITS)
        baseCurrency, // baseCurrency
        totalFx, // amount
        debitCurrency, // currency
        exchangeRate, header.description || 'Receipt deposited', undefined, {});
        lines.push(debitLine);
        lines.push(...tempLines);
        return lines;
    }
}
exports.ReceiptVoucherStrategy = ReceiptVoucherStrategy;
//# sourceMappingURL=ReceiptVoucherStrategy.js.map