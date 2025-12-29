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
export enum VoucherType {
  /**
   * Payment Voucher
   * Used for: Payments to suppliers, expenses, etc.
   * Posting: Debit Expense/Payable, Credit Cash/Bank
   */
  PAYMENT = 'payment',

  /**
   * Receipt Voucher (Future)
   * Used for: Receipts from customers, income, etc.
   * Posting: Debit Cash/Bank, Credit Revenue/Receivable
   */
  RECEIPT = 'receipt',

  /**
   * Journal Entry (Future)
   * Used for: Manual GL adjustments, corrections, etc.
   * Posting: User-defined debits and credits (must balance)
   */
  JOURNAL_ENTRY = 'journal_entry',

  /**
   * Opening Balance (Future)
   * Used for: Initial balances when starting system
   * Posting: Various debits/credits based on opening balances
   */
  OPENING_BALANCE = 'opening_balance'
}

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
export enum VoucherStatus {
  /**
   * DRAFT - Being created, editable
   * - Can be edited by creator
   * - Can be submitted for approval
   * - Can be deleted
   */
  DRAFT = 'draft',

  /**
   * APPROVED - Approval workflow completed
   * - Ready to be posted
   * - Not yet impacting the ledger
   * - Can be reverted to DRAFT
   */
  APPROVED = 'approved',

  /**
   * POSTED - Financial impact created
   * - Immutable: cannot be edited (must reverse/adjust)
   * - Lines frozen
   * - Records exist in Ledger
   */
  POSTED = 'posted',

  /**
   * LOCKED - Finalized, period closed
   * - Cannot be edited or reversed
   */
  LOCKED = 'locked',

  /**
   * REJECTED - Rejected, cannot be posted
   * - Can return to DRAFT for correction
   */
  REJECTED = 'rejected'
}

/**
 * Debit or Credit side
 */
export type TransactionSide = 'Debit' | 'Credit';

/**
 * Account Type (for reference, defined in Chart of Accounts)
 */
export enum AccountType {
  ASSET = 'Asset',
  LIABILITY = 'Liability',
  EQUITY = 'Equity',
  REVENUE = 'Revenue',
  EXPENSE = 'Expense'
}
