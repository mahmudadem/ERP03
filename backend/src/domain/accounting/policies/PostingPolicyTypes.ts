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
  // Approval Policy
  approvalRequired: boolean;
  
  // Period Lock Policy
  periodLockEnabled: boolean;
  lockedThroughDate?: string; // ISO date (YYYY-MM-DD) - all dates <= this are locked
  
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
