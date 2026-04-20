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
 * In development: enabled with parallel run
 * In production: disabled until tested (controlled by env var)
 */
export const VALIDATION_CONFIG: ValidationConfig = {
  enabled: process.env.REACT_APP_NEW_VALIDATION === 'true',
  parallelRun: process.env.NODE_ENV === 'development',
  enableByType: {
    // Start with journal entries (simplest)
    JOURNAL_ENTRY: true,
    FX_REVALUATION: true,
    OPENING_BALANCE: true,
    
    // Then expand to sales/purchase
    SALES_INVOICE: false,
    SALES_ORDER: false,
    PURCHASE_INVOICE: false,
    PURCHASE_ORDER: false,
    
    // Receipt/payment last (most complex)
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
