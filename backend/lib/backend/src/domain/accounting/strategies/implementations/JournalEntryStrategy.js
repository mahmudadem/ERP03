"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalEntryStrategy = void 0;
const VoucherLineEntity_1 = require("../../entities/VoucherLineEntity");
/**
 * JournalEntryStrategy
 *
 * Handles manual general ledger entries.
 * No automatic posting logic - accepts user-defined debit/credit lines.
 * Validates that entries balance (debits = credits).
 *
 * Accepts both V2 format (side, amount, baseAmount) and legacy format (debitFx, creditFx).
 */
class JournalEntryStrategy {
    async generateLines(header, companyId) {
        if (!header.lines || !Array.isArray(header.lines) || header.lines.length === 0) {
            throw new Error('Journal entry must have at least one line');
        }
        const baseCurrency = header.baseCurrency || 'USD';
        const headerRate = Number(header.exchangeRate) || 1;
        const lines = [];
        let totalDebitBase = 0;
        let totalCreditBase = 0;
        header.lines.forEach((inputLine, idx) => {
            if (!inputLine.accountId) {
                throw new Error(`Line ${idx + 1}: Account ID required`);
            }
            // Strict V2 format: side and amount are required
            if (!inputLine.side || inputLine.amount === undefined) {
                throw new Error(`Line ${idx + 1}: Missing required V2 fields: side, amount`);
            }
            const side = inputLine.side;
            const amount = Math.abs(Number(inputLine.amount) || 0);
            let baseAmount = Math.abs(Number(inputLine.baseAmount) || 0);
            // Calculate baseAmount if not provided
            if (baseAmount === 0 && amount > 0) {
                const rate = Number(inputLine.exchangeRate) || headerRate;
                baseAmount = (0, VoucherLineEntity_1.roundMoney)(amount * rate);
            }
            // Validate we have valid amounts
            if (amount <= 0) {
                throw new Error(`Line ${idx + 1}: Amount must be positive`);
            }
            if (baseAmount <= 0) {
                throw new Error(`Line ${idx + 1}: Base amount must be positive`);
            }
            const lineCurrency = inputLine.currency || inputLine.lineCurrency || header.currency || baseCurrency;
            const lineRate = Number(inputLine.exchangeRate) || headerRate;
            const line = new VoucherLineEntity_1.VoucherLineEntity(idx + 1, inputLine.accountId, side, baseAmount, // baseAmount
            baseCurrency, // baseCurrency
            amount, // amount
            lineCurrency, // currency
            lineRate, inputLine.notes || inputLine.description || undefined, inputLine.costCenterId, inputLine.metadata || {});
            totalDebitBase += line.debitAmount;
            totalCreditBase += line.creditAmount;
            lines.push(line);
        });
        // Validation: debits must equal credits
        const tolerance = 0.01;
        if (Math.abs(totalDebitBase - totalCreditBase) > tolerance) {
            throw new Error(`Debits must equal credits. Total debits: ${totalDebitBase.toFixed(2)}, Total credits: ${totalCreditBase.toFixed(2)}`);
        }
        return lines;
    }
}
exports.JournalEntryStrategy = JournalEntryStrategy;
//# sourceMappingURL=JournalEntryStrategy.js.map