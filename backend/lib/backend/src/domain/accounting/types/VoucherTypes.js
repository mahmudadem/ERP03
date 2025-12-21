"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountType = exports.VoucherStatus = exports.VoucherType = void 0;
/**
 * Voucher Type Enumeration
 *
 * Fixed set of voucher types with explicit posting logic.
 * Each type has a dedicated handler that defines how it posts to the general ledger.
 *
 * Following ADR-005: Auditable Accounting Architecture
 * - No dynamic types
 * - No runtime configuration of posting rules
 * - Each type has clear, readable posting logic
 */
var VoucherType;
(function (VoucherType) {
    /**
     * Payment Voucher
     * Used for: Payments to suppliers, expenses, etc.
     * Posting: Debit Expense/Payable, Credit Cash/Bank
     */
    VoucherType["PAYMENT"] = "payment";
    /**
     * Receipt Voucher (Future)
     * Used for: Receipts from customers, income, etc.
     * Posting: Debit Cash/Bank, Credit Revenue/Receivable
     */
    VoucherType["RECEIPT"] = "receipt";
    /**
     * Journal Entry (Future)
     * Used for: Manual GL adjustments, corrections, etc.
     * Posting: User-defined debits and credits (must balance)
     */
    VoucherType["JOURNAL_ENTRY"] = "journal_entry";
    /**
     * Opening Balance (Future)
     * Used for: Initial balances when starting system
     * Posting: Various debits/credits based on opening balances
     */
    VoucherType["OPENING_BALANCE"] = "opening_balance";
})(VoucherType = exports.VoucherType || (exports.VoucherType = {}));
/**
 * Voucher Status Enumeration
 *
 * Simple state-based workflow (no complex approval chains)
 *
 * Flow:
 * DRAFT → APPROVED → LOCKED
 *    ↓
 * REJECTED
 */
var VoucherStatus;
(function (VoucherStatus) {
    /**
     * DRAFT - Being created, editable
     * - Can be edited by creator
     * - Can be submitted for approval
     * - Can be deleted
     */
    VoucherStatus["DRAFT"] = "draft";
    /**
     * APPROVED - Approved and posted to ledger
     * - Posted to general ledger
     * - Cannot be edited (must reverse/adjust)
     * - Can be locked for period close
     */
    VoucherStatus["APPROVED"] = "approved";
    /**
     * LOCKED - Finalized, period closed
     * - Cannot be edited or reversed
     * - Part of closed period
     * - Permanent record
     */
    VoucherStatus["LOCKED"] = "locked";
    /**
     * REJECTED - Rejected, cannot be posted
     * - Not posted to ledger
     * - Can return to DRAFT for correction
     * - Audit trail preserved
     */
    VoucherStatus["REJECTED"] = "rejected";
})(VoucherStatus = exports.VoucherStatus || (exports.VoucherStatus = {}));
/**
 * Account Type (for reference, defined in Chart of Accounts)
 */
var AccountType;
(function (AccountType) {
    AccountType["ASSET"] = "Asset";
    AccountType["LIABILITY"] = "Liability";
    AccountType["EQUITY"] = "Equity";
    AccountType["REVENUE"] = "Revenue";
    AccountType["EXPENSE"] = "Expense";
})(AccountType = exports.AccountType || (exports.AccountType = {}));
//# sourceMappingURL=VoucherTypes.js.map