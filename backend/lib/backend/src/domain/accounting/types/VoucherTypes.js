"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountType = exports.VoucherStatus = exports.PostingLockPolicy = exports.VoucherType = void 0;
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
    /**
     * Reversal Voucher
     * Used for: Correcting posted vouchers by inverting their ledger effects.
     * Posting: Inverse of the original voucher referenced.
     */
    VoucherType["REVERSAL"] = "reversal";
})(VoucherType = exports.VoucherType || (exports.VoucherType = {}));
/**
 * Posting Lock Policy
 * Defines the structural immutability of a voucher once posted.
 */
var PostingLockPolicy;
(function (PostingLockPolicy) {
    /**
     * STRICT_LOCKED - Permanent, structural lock. No mutations allowed.
     */
    PostingLockPolicy["STRICT_LOCKED"] = "STRICT_LOCKED";
    /**
     * FLEXIBLE_EDITABLE - Mutability allowed; updates trigger ledger re-sync.
     */
    PostingLockPolicy["FLEXIBLE_EDITABLE"] = "FLEXIBLE_EDITABLE";
    /**
     * FLEXIBLE_LOCKED - Flexible mode but editing is currently disabled.
     */
    PostingLockPolicy["FLEXIBLE_LOCKED"] = "FLEXIBLE_LOCKED";
})(PostingLockPolicy = exports.PostingLockPolicy || (exports.PostingLockPolicy = {}));
/**
 * Voucher Status Enumeration (V1 Locked)
 *
 * Workflow States ONLY. POSTED is NOT a workflow state.
 * POSTED is a derived financial effect badge based on voucher.postedAt.
 *
 * Flow:
 * DRAFT → PENDING → APPROVED
 *            ↓
 *        REJECTED
 *            ↓
 *       CANCELLED
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
     * PENDING - Submitted for approval
     * - Waiting for approver action
     * - May be editable (marks as "edited")
     * - Can be approved or rejected
     */
    VoucherStatus["PENDING"] = "pending";
    /**
     * APPROVED - Approval workflow completed
     * - All required gates satisfied
     * - May or may not be POSTED (check postedAt)
     * - Financial effect created only when postedAt is set
     */
    VoucherStatus["APPROVED"] = "approved";
    /**
     * REJECTED - Rejected by approver
     * - Can return to DRAFT for correction
     */
    VoucherStatus["REJECTED"] = "rejected";
    /**
     * CANCELLED - Cancelled by user
     * - Terminal state, no further action
     */
    VoucherStatus["CANCELLED"] = "cancelled";
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