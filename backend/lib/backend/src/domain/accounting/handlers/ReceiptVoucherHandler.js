"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptVoucherHandler = void 0;
const VoucherLineEntity_1 = require("../entities/VoucherLineEntity");
/**
 * Receipt Voucher Handler
 *
 * ADR-005 Compliant - Mirror of Payment Voucher
 *
 * EXPLICIT POSTING LOGIC:
 * -------------------
 * Receipt vouchers ALWAYS create exactly 2 lines:
 *
 * 1. DEBIT: Cash/Bank Account (increase asset - money coming in)
 * 2. CREDIT: Revenue/Receivable Account (increase revenue or decrease receivable)
 *
 * Example:
 * Receive $100 from customer:
 *   DR: Cash/Bank Account       $100
 *   CR: Sales Revenue           $100
 *
 * This is the OPPOSITE of Payment Voucher.
 * The logic is HARD-CODED and EXPLICIT - no runtime evaluation.
 */
class ReceiptVoucherHandler {
    /**
     * Validate receipt input
     *
     * Checks business rules before creating lines.
     * This runs BEFORE posting logic.
     */
    async validate(input) {
        const errors = [];
        // Required fields
        if (!input.date || input.date.trim() === '') {
            errors.push('Date is required');
        }
        if (!input.amount || input.amount <= 0) {
            errors.push('Amount must be greater than zero');
        }
        if (!input.cashAccountId || input.cashAccountId.trim() === '') {
            errors.push('Cash/Bank account is required');
        }
        if (!input.revenueAccountId || input.revenueAccountId.trim() === '') {
            errors.push('Revenue/Receivable account is required');
        }
        if (!input.description || input.description.trim() === '') {
            errors.push('Description is required');
        }
        // Business rule: Cannot receive from and to the same account
        if (input.cashAccountId === input.revenueAccountId) {
            errors.push('Cash account and revenue account cannot be the same');
        }
        if (errors.length > 0) {
            throw new Error(`Receipt voucher validation failed:\n${errors.join('\n')}`);
        }
    }
    /**
     * Create voucher lines for receipt
     *
     * EXPLICIT POSTING LOGIC - This is the core accounting logic.
     *
     * Every receipt creates exactly 2 lines:
     * - Line 1: DEBIT the cash/bank account
     * - Line 2: CREDIT the revenue/receivable account
     *
     * No dynamic rules. No field mapping. No runtime evaluation.
     * Just clear, auditable, accounting logic.
     *
     * @param input Receipt data from user
     * @param baseCurrency Company's base currency
     * @param exchangeRate FX rate (from currency service)
     * @returns Array of exactly 2 voucher lines
     */
    createLines(input, baseCurrency, exchangeRate) {
        const currency = input.currency || baseCurrency;
        const amount = input.amount;
        const baseAmount = amount * exchangeRate;
        // Line 1: DEBIT Cash/Bank
        const debitLine = new VoucherLineEntity_1.VoucherLineEntity(1, // Line ID
        input.cashAccountId, 'Debit', amount, currency, baseAmount, baseCurrency, exchangeRate, input.notes || input.description, input.costCenterId);
        // Line 2: CREDIT Revenue/Receivable
        const creditLine = new VoucherLineEntity_1.VoucherLineEntity(2, // Line ID
        input.revenueAccountId, 'Credit', amount, currency, baseAmount, baseCurrency, exchangeRate, input.notes || input.description, input.costCenterId);
        // ALWAYS return exactly 2 lines
        // This is the contract of a receipt voucher
        return [debitLine, creditLine];
    }
    /**
     * Get human-readable description of posting logic
     *
     * For documentation and audit purposes.
     */
    getPostingDescription() {
        return `Receipt Voucher Posting Logic:
    
    Line 1: DEBIT  - Cash/Bank Account (increases cash/bank balance)
    Line 2: CREDIT - Revenue/Receivable Account (increases revenue or reduces receivable)
    
    Example: Receive $100 from customer
      DR: Bank Account        $100
      CR: Sales Revenue       $100
    
    This represents money coming into the company from sales or collections.
    `;
    }
}
exports.ReceiptVoucherHandler = ReceiptVoucherHandler;
//# sourceMappingURL=ReceiptVoucherHandler.js.map