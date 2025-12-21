"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalEntryHandler = void 0;
const VoucherLineEntity_1 = require("../entities/VoucherLineEntity");
/**
 * Journal Entry Voucher Handler
 *
 * ADR-005 Compliant - More Flexible than Payment/Receipt
 *
 * EXPLICIT POSTING LOGIC:
 * -------------------
 * Unlike Payment/Receipt which have FIXED posting patterns,
 * Journal Entry allows users to specify ANY debits and credits.
 *
 * However, it still maintains explicit validation:
 * - User provides exact accounts to debit/credit
 * - System validates debits = credits
 * - System converts to internal format
 * - No runtime evaluation or templates
 *
 * Example:
 * Record depreciation $500:
 *   Lines: [
 *     { account: 'Depreciation Expense', debit: 500, credit: 0 },
 *     { account: 'Accumulated Depreciation', debit: 0, credit: 500 }
 *   ]
 *
 * The logic is EXPLICIT - what the user specifies is what gets posted.
 */
class JournalEntryHandler {
    /**
     * Validate journal entry input
     *
     * Checks business rules before creating lines.
     */
    async validate(input) {
        const errors = [];
        // Required fields
        if (!input.date || input.date.trim() === '') {
            errors.push('Date is required');
        }
        if (!input.description || input.description.trim() === '') {
            errors.push('Description is required');
        }
        if (!input.lines || !Array.isArray(input.lines)) {
            errors.push('Lines are required');
        }
        if (input.lines && input.lines.length < 2) {
            errors.push('At least 2 lines are required (minimum 1 debit and 1 credit)');
        }
        // Validate each line
        if (input.lines && Array.isArray(input.lines)) {
            input.lines.forEach((line, index) => {
                if (!line.accountId || line.accountId.trim() === '') {
                    errors.push(`Line ${index + 1}: Account is required`);
                }
                // Line must have EITHER debit OR credit (not both, not neither)
                const hasDebit = line.debit > 0;
                const hasCredit = line.credit > 0;
                if (!hasDebit && !hasCredit) {
                    errors.push(`Line ${index + 1}: Must have either debit or credit amount`);
                }
                if (hasDebit && hasCredit) {
                    errors.push(`Line ${index + 1}: Cannot have both debit and credit`);
                }
                if (line.debit < 0 || line.credit < 0) {
                    errors.push(`Line ${index + 1}: Amounts cannot be negative`);
                }
            });
            // Validate balanced entry
            const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
            const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                errors.push(`Entry is not balanced: Total Debit = ${totalDebit.toFixed(2)}, ` +
                    `Total Credit = ${totalCredit.toFixed(2)}`);
            }
        }
        if (errors.length > 0) {
            throw new Error(`Journal entry validation failed:\n${errors.join('\n')}`);
        }
    }
    /**
     * Create voucher lines for journal entry
     *
     * EXPLICIT CONVERSION - User's input becomes voucher lines.
     *
     * Unlike Payment/Receipt with fixed patterns, Journal Entry
     * accepts user-defined debits/credits and converts them to
     * the internal VoucherLineEntity format.
     *
     * Each input line with debit/credit becomes 1 or 2 voucher lines:
     * - If debit only: 1 debit line
     * - If credit only: 1 credit line
     *
     * The conversion is EXPLICIT and TRACEABLE.
     *
     * @param input Journal entry data from user
     * @param baseCurrency Company's base currency
     * @param exchangeRate FX rate (from currency service)
     * @returns Array of voucher lines (debits + credits)
     */
    createLines(input, baseCurrency, exchangeRate) {
        const currency = input.currency || baseCurrency;
        const voucherLines = [];
        let lineId = 1;
        // Convert each user line to voucher line(s)
        for (const inputLine of input.lines) {
            // Create debit line if amount > 0
            if (inputLine.debit > 0) {
                const baseAmount = inputLine.debit * exchangeRate;
                voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(lineId++, inputLine.accountId, 'Debit', inputLine.debit, currency, baseAmount, baseCurrency, exchangeRate, inputLine.notes, inputLine.costCenterId));
            }
            // Create credit line if amount > 0
            if (inputLine.credit > 0) {
                const baseAmount = inputLine.credit * exchangeRate;
                voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(lineId++, inputLine.accountId, 'Credit', inputLine.credit, currency, baseAmount, baseCurrency, exchangeRate, inputLine.notes, inputLine.costCenterId));
            }
        }
        // Return all generated lines
        // Unlike Payment/Receipt which always return exactly 2,
        // Journal Entry returns variable number based on input
        return voucherLines;
    }
    /**
     * Get human-readable description of posting logic
     *
     * For documentation and audit purposes.
     */
    getPostingDescription() {
        return `Journal Entry Posting Logic:
    
    User provides complete debit/credit breakdown:
    - Each line specifies account and amount (debit OR credit)
    - System validates: Total Debits = Total Credits
    - System converts to internal format
    
    Example: Record depreciation $500
      Input:
        Line 1: Depreciation Expense    DR $500
        Line 2: Accum. Depreciation     CR $500
      
      Posted:
        DR: Depreciation Expense        $500
        CR: Accumulated Depreciation    $500
    
    This allows flexible manual accounting adjustments while
    maintaining explicit validation and auditability.
    `;
    }
}
exports.JournalEntryHandler = JournalEntryHandler;
//# sourceMappingURL=JournalEntryHandler.js.map