/**
 * IAccountRepository Interface
 * 
 * Repository interface for Chart of Accounts operations.
 * Includes USED detection, system code generation, and uniqueness checks.
 */

import { Account, AccountClassification, AccountRole, AccountStatus, BalanceNature, BalanceEnforcement, CurrencyPolicy } from '../../../domain/accounting/models/Account';

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface NewAccountInput {
  // Optional - generated if not provided
  id?: string;
  
  // Required
  userCode: string;
  name: string;
  classification: AccountClassification;
  createdBy: string;
  
  // Optional with defaults
  description?: string | null;
  accountRole?: AccountRole;           // Default: POSTING
  balanceNature?: BalanceNature;       // Default: based on classification
  balanceEnforcement?: BalanceEnforcement; // Default: WARN_ABNORMAL
  parentId?: string | null;
  currencyPolicy?: CurrencyPolicy;     // Default: INHERIT
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  isProtected?: boolean;               // Default: false
  
  // Approval Policy
  requiresApproval?: boolean;
  requiresCustodyConfirmation?: boolean;
  custodianUserId?: string | null;
  
  // Legacy compat
  code?: string;  // Alias for userCode
  type?: string;  // Alias for classification
  currency?: string; // Alias for fixedCurrencyCode
}

export interface UpdateAccountInput {
  // Editable fields
  userCode?: string;
  name?: string;
  description?: string | null;
  status?: AccountStatus;
  replacedByAccountId?: string | null;
  
  // Conditionally editable (blocked after USED)
  accountRole?: AccountRole;
  classification?: AccountClassification;
  balanceNature?: BalanceNature;
  balanceEnforcement?: BalanceEnforcement;
  currencyPolicy?: CurrencyPolicy;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  
  // Hierarchy
  parentId?: string | null;
  
  // System
  isProtected?: boolean;
  
  // Approval Policy
  requiresApproval?: boolean;
  requiresCustodyConfirmation?: boolean;
  custodianUserId?: string | null;

  updatedBy: string;
  
  // Legacy compat
  code?: string;
  type?: string;
  isActive?: boolean;
  currency?: string;
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface IAccountRepository {
  // =========================================================================
  // QUERY METHODS
  // =========================================================================
  
  /**
   * List all accounts for a company
   */
  list(companyId: string): Promise<Account[]>;
  
  /**
   * Get account by ID (UUID)
   */
  getById(companyId: string, accountId: string, transaction?: any): Promise<Account | null>;
  
  /**
   * Get account by user code
   */
  getByUserCode(companyId: string, userCode: string): Promise<Account | null>;
  
  /**
   * Legacy: Get account by code (alias for getByUserCode)
   */
  getByCode(companyId: string, code: string): Promise<Account | null>;
  
  /**
   * Legacy alias for list
   */
  getAccounts?(companyId: string): Promise<Account[]>;
  
  // =========================================================================
  // MUTATION METHODS
  // =========================================================================
  
  /**
   * Create a new account
   * Generates systemCode automatically
   */
  create(companyId: string, data: NewAccountInput): Promise<Account>;
  
  /**
   * Update an existing account
   */
  update(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account>;
  
  /**
   * Delete an account (only if unused and no children)
   */
  delete(companyId: string, accountId: string): Promise<void>;
  
  /**
   * Legacy: Deactivate an account (sets status to INACTIVE)
   */
  deactivate(companyId: string, accountId: string): Promise<void>;
  
  // =========================================================================
  // VALIDATION/CHECK METHODS
  // =========================================================================
  
  /**
   * Check if account has been used in any voucher lines
   * USED = any VoucherLine references the account
   */
  isUsed(companyId: string, accountId: string): Promise<boolean>;
  
  /**
   * Check if account has children
   */
  hasChildren(companyId: string, accountId: string): Promise<boolean>;
  
  /**
   * Count children of an account
   */
  countChildren(companyId: string, accountId: string): Promise<number>;
  
  /**
   * Check if a userCode already exists (excluding a specific account)
   */
  existsByUserCode(companyId: string, userCode: string, excludeAccountId?: string): Promise<boolean>;
  
  /**
   * Generate the next system code for a company
   * Format: ACC-000001, ACC-000002, etc.
   */
  generateNextSystemCode(companyId: string): Promise<string>;
  
  /**
   * Count accounts using a specific currency
   */
  countByCurrency(companyId: string, currencyCode: string): Promise<number>;
  
  // =========================================================================
  // AUDIT METHODS
  // =========================================================================
  
  /**
   * Record an audit event for an account change
   */
  recordAuditEvent(
    companyId: string,
    accountId: string,
    event: {
      type: 'NAME_CHANGED' | 'USER_CODE_CHANGED' | 'STATUS_CHANGED' | 'REPLACED_BY_CHANGED' | 'CURRENCY_POLICY_CHANGED' | 'OTHER';
      field: string;
      oldValue: any;
      newValue: any;
      changedBy: string;
      changedAt: Date;
    }
  ): Promise<void>;
}
