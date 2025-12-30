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
            // Support both V2 format (side, amount) and legacy format (debitFx, creditFx)
            let side;
            let amount;
            let baseAmount;
            if (inputLine.side && inputLine.amount !== undefined) {
                // V2 format
                side = inputLine.side;
                amount = Math.abs(Number(inputLine.amount) || 0);
                baseAmount = Math.abs(Number(inputLine.baseAmount) || 0);
                // Calculate baseAmount if not provided
                if (baseAmount === 0 && amount > 0) {
                    const rate = Number(inputLine.exchangeRate) || headerRate;
                    baseAmount = (0, VoucherLineEntity_1.roundMoney)(amount * rate);
                }
            }
            else {
                // Legacy format
                const debitFx = Number(inputLine.debitFx) || 0;
                const creditFx = Number(inputLine.creditFx) || 0;
                const debitBase = Number(inputLine.debitBase) || 0;
                const creditBase = Number(inputLine.creditBase) || 0;
                if (debitFx > 0 && creditFx > 0) {
                    throw new Error(`Line ${idx + 1}: Line cannot have both debit and credit`);
                }
                if (debitFx <= 0 && creditFx <= 0) {
                    throw new Error(`Line ${idx + 1}: Line must have either debit or credit`);
                }
                side = debitFx > 0 ? 'Debit' : 'Credit';
                amount = debitFx > 0 ? debitFx : creditFx;
                baseAmount = debitBase > 0 ? debitBase : creditBase;
                // Calculate baseAmount if not provided
                if (baseAmount === 0 && amount > 0) {
                    const rate = Number(inputLine.exchangeRate) || headerRate;
                    baseAmount = (0, VoucherLineEntity_1.roundMoney)(amount * rate);
                }
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