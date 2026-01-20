"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpeningBalanceHandler = void 0;
const VoucherLineEntity_1 = require("../entities/VoucherLineEntity");
/**
 * Opening Balance Voucher Handler
 *
 * ADR-005 Compliant - Same Pattern as Journal Entry
 *
 * EXPLICIT POSTING LOGIC:
 * -------------------
 * Opening Balance is essentially a special-purpose Journal Entry
 * used for system initialization.
 *
 * User provides opening balances for accounts:
 * - Assets: Debit balances
 * - Liabilities: Credit balances
 * - Equity: Credit balances
 *
 * The accounting equation MUST balance:
 * Assets (Debits) = Liabilities + Equity (Credits)
 *
 * Example:
 * Initialize system with:
 *   Lines: [
 *     { account: 'Cash', debit: 10000, credit: 0 },
 *     { account: 'Equipment', debit: 5000, credit: 0 },
 *     { account: 'Accounts Payable', debit: 0, credit: 3000 },
 *     { account: 'Owner Equity', debit: 0, credit: 12000 }
 *   ]
 *
 * The logic is EXPLICIT - what the user specifies is what gets posted.
 * Same as Journal Entry, but for a specific purpose.
 */
class OpeningBalanceHandler {
    /**
     * Validate opening balance input
     *
     * Validation is identical to Journal Entry:
     * - At least 2 lines
     * - Each line has account
     * - Each line has debit OR credit
     * - Debits = Credits (accounting equation)
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
            errors.push('At least 2 lines are required');
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
                    errors.push(`Line ${index + 1}: Must have either debit or credit balance`);
                }
                if (hasDebit && hasCredit) {
                    errors.push(`Line ${index + 1}: Cannot have both debit and credit balance`);
                }
                if (line.debit < 0 || line.credit < 0) {
                    errors.push(`Line ${index + 1}: Balances cannot be negative`);
                }
            });
            // Validate accounting equation: Assets (DR) = Liabilities + Equity (CR)
            const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
            const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                errors.push(`Opening balances not balanced: Total Debit (Assets) = ${totalDebit.toFixed(2)}, ` +
                    `Total Credit (Liabilities + Equity) = ${totalCredit.toFixed(2)}. ` +
                    `The accounting equation must balance: Assets = Liabilities + Equity`);
            }
        }
        if (errors.length > 0) {
            throw new Error(`Opening balance validation failed:\n${errors.join('\n')}`);
        }
    }
    /**
     * Create voucher lines for opening balances
     *
     * EXPLICIT CONVERSION - User's balances become voucher lines.
     *
     * This is identical to Journal Entry conversion logic.
     * Each opening balance becomes a debit or credit line.
     *
     * @param input Opening balance data from user
     * @param baseCurrency Company's base currency
     * @param exchangeRate FX rate (usually 1.0 for opening balances)
     * @returns Array of voucher lines (debits + credits)
     */
    createLines(input, baseCurrency, exchangeRate) {
        const currency = input.currency || baseCurrency;
        const voucherLines = [];
        let lineId = 1;
        // Convert each opening balance to voucher line(s)
        for (const inputLine of input.lines) {
            // Create debit line if balance > 0 (Asset accounts)
            if (inputLine.debit > 0) {
                const baseAmount = inputLine.debit * exchangeRate;
                voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(lineId++, inputLine.accountId, 'Debit', baseAmount, baseCurrency, inputLine.debit, currency, exchangeRate, inputLine.notes));
            }
            // Create credit line if balance > 0 (Liability/Equity accounts)
            if (inputLine.credit > 0) {
                const baseAmount = inputLine.credit * exchangeRate;
                voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(lineId++, inputLine.accountId, 'Credit', baseAmount, baseCurrency, inputLine.credit, currency, exchangeRate, inputLine.notes));
            }
        }
        return voucherLines;
    }
    /**
     * Get human-readable description of posting logic
     *
     * For documentation and audit purposes.
     */
    getPostingDescription() {
        return `Opening Balance Posting Logic:
    
    Used for initializing the accounting system with existing balances.
    
    User provides opening balance for each account:
    - Assets: Debit balances
    - Liabilities: Credit balances
    - Equity: Credit balances
    
    System validates the accounting equation:
    Assets (Debits) = Liabilities + Equity (Credits)
    
    Example: Initialize system on Jan 1, 2025
      Input:
        Cash (Asset)             DR $10,000
        Equipment (Asset)        DR $5,000
        Accounts Payable (Liab)  CR $3,000
        Owner Equity             CR $12,000
      
      Posted:
        DR: Cash                 $10,000
        DR: Equipment            $5,000
        CR: Accounts Payable     $3,000
        CR: Owner Equity         $12,000
    
    This sets up the initial state of the accounting system.
    Typically created once at system initialization.
    `;
    }
}
exports.OpeningBalanceHandler = OpeningBalanceHandler;
//# sourceMappingURL=OpeningBalanceHandler.js.map