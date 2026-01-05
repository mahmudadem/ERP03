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
  OPENING_BALANCE = 'opening_balance',
  
  /**
   * Reversal Voucher
   * Used for: Correcting posted vouchers by inverting their ledger effects.
   * Posting: Inverse of the original voucher referenced.
   */
  REVERSAL = 'reversal'
}

/**
 * Posting Lock Policy
 * Defines the structural immutability of a voucher once posted.
 */
export enum PostingLockPolicy {
  /**
   * STRICT_LOCKED - Permanent, structural lock. No mutations allowed.
   */
  STRICT_LOCKED = 'STRICT_LOCKED',

  /**
   * FLEXIBLE_EDITABLE - Mutability allowed; updates trigger ledger re-sync.
   */
  FLEXIBLE_EDITABLE = 'FLEXIBLE_EDITABLE',

  /**
   * FLEXIBLE_LOCKED - Flexible mode but editing is currently disabled.
   */
  FLEXIBLE_LOCKED = 'FLEXIBLE_LOCKED'
}

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
export enum VoucherStatus {
  /**
   * DRAFT - Being created, editable
   * - Can be edited by creator
   * - Can be submitted for approval
   * - Can be deleted
   */
  DRAFT = 'draft',

  /**
   * PENDING - Submitted for approval
   * - Waiting for approver action
   * - May be editable (marks as "edited")
   * - Can be approved or rejected
   */
  PENDING = 'pending',

  /**
   * APPROVED - Approval workflow completed
   * - All required gates satisfied
   * - May or may not be POSTED (check postedAt)
   * - Financial effect created only when postedAt is set
   */
  APPROVED = 'approved',

  /**
   * REJECTED - Rejected by approver
   * - Can return to DRAFT for correction
   */
  REJECTED = 'rejected',

  /**
   * CANCELLED - Cancelled by user
   * - Terminal state, no further action
   */
  CANCELLED = 'cancelled'
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
