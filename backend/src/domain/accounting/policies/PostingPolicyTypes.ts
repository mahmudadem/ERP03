import { VoucherLineEntity } from '../entities/VoucherLineEntity';
import { VoucherType, VoucherStatus } from '../types/VoucherTypes';

/**
 * Context provided to posting policies for validation
 * 
 * This is the stable contract between PostVoucherUseCase and policies.
 * Keep this minimal but sufficient for all policy decisions.
 */
export interface PostingPolicyContext {
  // Identifiers
  companyId: string;
  voucherId: string;
  userId: string; // For user scope lookup in AccountAccessPolicy
  
  // Voucher metadata
  voucherType: VoucherType;
  voucherDate: string; // ISO date (YYYY-MM-DD)
  voucherNo: string;
  
  // Financial data
  baseCurrency: string;
  totalDebit: number;
  totalCredit: number;
  
  // Status flags
  status: VoucherStatus;
  isApproved: boolean;
  
  // Lines (canonical source of truth)
  lines: readonly VoucherLineEntity[];
  
  // Header metadata (for policy-specific checks)
  metadata: Record<string, any>;
}

/**
 * Policy validation error details
 */
export interface PolicyError {
  code: string;
  message: string;
  fieldHints?: string[]; // Optional hints for which fields caused the error
}

/**
 * Result of policy validation
 */
export type PolicyResult = 
  | { ok: true }
  | { ok: false; error: PolicyError };

/**
 * Accounting policy configuration for a company
 * 
 * This defines which policies are enabled and their parameters.
 * Loaded from backend config source (Firestore, JSON, etc.)
 */
export interface AccountingPolicyConfig {
  // ========== Approval Policy V1 Toggles ==========
  
  /**
   * Financial Approval (FA) - Role-based approval gate
   * When enabled, vouchers touching accounts with requiresApproval=true
   * must be approved by a user with approval role before posting.
   */
  financialApprovalEnabled: boolean;
  
  /**
   * FA Application Mode:
   * - 'ALL': When FA is ON, ALL vouchers require approval (company-wide)
   * - 'MARKED_ONLY': Only vouchers touching accounts with requiresApproval=true need approval
   */
  faApplyMode: 'ALL' | 'MARKED_ONLY';
  
  /**
   * Custody Confirmation (CC) - User-bound custody gate
   * When enabled, vouchers touching accounts with requiresCustodyConfirmation=true
   * must be confirmed by the assigned custodian before posting.
   */
  custodyConfirmationEnabled: boolean;
  
  // Legacy field (maps to financialApprovalEnabled for backward compatibility)
  approvalRequired: boolean;
  
  // ========== Mode A Controls (Solo/Flexible Mode) ==========
  
  /**
   * Strict Approval Mode (V3)
   * When true: System operates in STRICT MODE
   *   - Approval workflow is enabled
   *   - Posted vouchers are permanently immutable
   *   - Corrections ONLY via reversal
   * When false: System operates in FLEXIBLE MODE
   *   - Approval can be bypassed (submit = approved)
   *   - Posted vouchers can be edited/deleted if allowEditDeletePosted is ON
   * Default: true
   */
  strictApprovalMode?: boolean;
  
  /**
   * Auto-Post Enabled (V1)
   * When true: Vouchers are posted to ledger immediately when approved
   * When false: Vouchers remain Approved but NOT POSTED until explicit PostToLedger action
   * Default: true
   */
  autoPostEnabled: boolean;
  
  /**
   * Allow Edit/Delete Posted Vouchers (V3)
   * ONLY APPLIES IN FLEXIBLE MODE (strictApprovalMode=false)
   * When true: Posted vouchers can be edited (ledger resynced) or deleted (ledger cleared)
   * When false: Posted vouchers are immutable, corrections via reversal only
   * Default: false
   */
  allowEditDeletePosted?: boolean;
  
  /**
   * @deprecated Use allowEditDeletePosted instead
   * Legacy field for backward compatibility
   */

  
  // ========== Period Lock Policy ==========
  periodLockEnabled: boolean;
  
  /**
   * Locked Through Date (V1)
   * HARD RULE: if voucher.date <= lockedThroughDate => voucher is immutable
   * This overrides all other settings including allowEditPostedVouchersEnabled
   * ISO date format: YYYY-MM-DD
   */
  lockedThroughDate?: string;
  
  /**
   * Account access control policy configuration
   */
  accountAccessEnabled?: boolean;

  /**
   * Cost center required policy configuration
   */
  costCenterPolicy?: {
    enabled: boolean;
    requiredFor: {
      /**
       * Specific account IDs that require cost center
       */
      accountIds?: string[];
      /**
       * Account types that require cost center (e.g., "expense")
       */
      accountTypes?: string[];
    };
  };

  /**
   * Policy error handling mode
   * - FAIL_FAST: Stop at first policy violation (default)
   * - AGGREGATE: Collect all policy violations before failing
   */
  policyErrorMode?: 'FAIL_FAST' | 'AGGREGATE';
}
