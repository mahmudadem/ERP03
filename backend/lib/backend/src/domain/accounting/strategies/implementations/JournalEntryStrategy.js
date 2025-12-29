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
 */
class JournalEntryStrategy {
    async generateLines(header, companyId) {
        // Expected header: { lines: Array<{accountId, debitFx, creditFx, debitBase, creditBase, description, lineCurrency, exchangeRate}> }
        if (!header.lines || !Array.isArray(header.lines) || header.lines.length === 0) {
            throw new Error('Journal entry must have at least one line');
        }
        const lines = [];
        let totalDebitBase = 0;
        let totalCreditBase = 0;
        header.lines.forEach((inputLine, idx) => {
            if (!inputLine.accountId) {
                throw new Error(`Line ${idx + 1}: Account ID required`);
            }
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
            const side = debitFx > 0 ? 'Debit' : 'Credit';
            const amount = debitFx > 0 ? debitFx : creditFx;
            const baseAmount = debitBase > 0 ? debitBase : creditBase;
            const line = new VoucherLineEntity_1.VoucherLineEntity(idx + 1, inputLine.accountId, side, amount, inputLine.lineCurrency || 'USD', baseAmount, header.baseCurrency || 'USD', Number(inputLine.exchangeRate) || 1, inputLine.description || undefined, inputLine.costCenterId, inputLine.metadata || {});
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