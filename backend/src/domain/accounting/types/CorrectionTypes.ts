/**
 * Voucher Correction Types
 * 
 * Defines the correction flow for posted vouchers without editing originals.
 */

/**
 * Correction mode determines the type of correction operation
 */
export enum CorrectionMode {
  /**
   * Creates only a reversal voucher (negates original impact)
   */
  REVERSE_ONLY = 'REVERSE_ONLY',

  /**
   * Creates a reversal voucher AND a replacement voucher
   */
  REVERSE_AND_REPLACE = 'REVERSE_AND_REPLACE'
}

/**
 * Options for correction operations
 */
export interface CorrectionOptions {
  /**
   * Whether replacement voucher starts as DRAFT (default: true)
   * If false, will attempt to post replacement immediately (subject to policies)
   */
  replaceStartsAsDraft?: boolean;

  /**
   * Reversal date strategy:
   * - undefined (default): Use original voucher date
   * - "today": Use today's accounting date
   * - "YYYY-MM-DD": Use specific date
   */
  reversalDate?: 'today' | string;

  /**
   * Reason for the correction (audit trail)
   */
  reason?: string;
}

/**
 * Result of a correction operation
 */
export interface CorrectionResult {
  /**
   * ID of the created reversal voucher (always POSTED if operation succeeds)
   */
  reverseVoucherId: string;

  /**
   * ID of the created replacement voucher (optional)
   */
  replaceVoucherId?: string;

  /**
   * Unique identifier linking reversal and replacement vouchers
   */
  correctionGroupId: string;

  /**
   * Status summary
   */
  summary: {
    reversalPosted: boolean;
    replacementCreated: boolean;
    replacementPosted: boolean;
  };
}

/**
 * Input payload for creating a replacement voucher
 */
export interface ReplacementPayload {
  /**
   * Voucher date (accounting date)
   */
  date?: string;

  /**
   * Description/memo
   */
  description?: string;

  /**
   * Reference number (external)
   */
  reference?: string;

  /**
   * Voucher lines (for manual corrections)
   */
  lines?: Array<{
    accountId: string;
    debitFx?: number;
    creditFx?: number;
    debitBase?: number;
    creditBase?: number;
    side?: 'Debit' | 'Credit';
    currency?: string;
    rate?: number;
    memo?: string;
  }>;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Voucher correction metadata fields
 * Stored in voucher.metadata
 */
export interface VoucherCorrectionMetadata {
  /**
   * For reversal vouchers: ID of the original voucher being reversed
   */
  reversalOfVoucherId?: string;

  /**
   * For replacement vouchers: ID of the original voucher being replaced
   */
  replacesVoucherId?: string;

  /**
   * UUID linking reversal and replacement vouchers in a correction group
   */
  correctionGroupId?: string;

  /**
   * Reason for correction (audit trail)
   */
  correctionReason?: string;
}
