/**
 * Validation Configuration
 * 
 * Feature flags and settings for the new validation system.
 * Allows gradual rollout and parallel run for testing.
 */

export interface ValidationConfig {
  /** Master switch for new validation system */
  enabled: boolean;
  /** Run new validation alongside old (log both results) */
  parallelRun: boolean;
  /** Enable per-type for gradual rollout */
  enableByType: {
    [type: string]: boolean;
  };
}

/**
 * Current validation configuration
 * 
 * TEMPORARILY DISABLED for testing - set to false to prevent blank page
 */
export const VALIDATION_CONFIG: ValidationConfig = {
  enabled: false, // DISABLED until TypeScript errors are fixed
  parallelRun: process.env.NODE_ENV === 'development',
  enableByType: {
    // All disabled for now
    JOURNAL_ENTRY: false,
    FX_REVALUATION: false,
    OPENING_BALANCE: false,
    REVERSAL: false,
    SALES_INVOICE: false,
    SALES_ORDER: false,
    SALES_RETURN: false,
    DELIVERY_NOTE: false,
    PURCHASE_INVOICE: false,
    PURCHASE_ORDER: false,
    GOODS_RECEIPT: false,
    PURCHASE_RETURN: false,
    RECEIPT: false,
    PAYMENT: false,
  },
};

/**
 * Check if new validation is enabled for a specific type
 */
export function isValidationEnabled(type: string): boolean {
  if (!VALIDATION_CONFIG.enabled) {
    return false;
  }
  
  const typeUpper = type.toUpperCase();
  
  // Check type-specific flag
  if (typeUpper in VALIDATION_CONFIG.enableByType) {
    return VALIDATION_CONFIG.enableByType[typeUpper];
  }
  
  // Default: enabled for types not explicitly listed
  return true;
}

/**
 * Get validation config for debugging
 */
export function getValidationDebugConfig(): {
  enabled: boolean;
  parallelRun: boolean;
  envVar: string | undefined;
} {
  return {
    enabled: VALIDATION_CONFIG.enabled,
    parallelRun: VALIDATION_CONFIG.parallelRun,
    envVar: process.env.REACT_APP_NEW_VALIDATION,
  };
}
