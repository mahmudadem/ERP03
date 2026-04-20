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
 * ENABLED for testing - validation is active for Journal, Sales, and Purchase forms
 */
export const VALIDATION_CONFIG: ValidationConfig = {
  enabled: true, // ENABLED for testing
  parallelRun: process.env.NODE_ENV === 'development',
  enableByType: {
    // Phase 1: Journal entries - ENABLED
    JOURNAL_ENTRY: true,
    FX_REVALUATION: true,
    OPENING_BALANCE: true,
    REVERSAL: true,
    
    // Phase 2: Sales forms - ENABLED
    SALES_INVOICE: true,
    SALES_ORDER: true,
    SALES_RETURN: true,
    DELIVERY_NOTE: true,
    
    // Phase 3: Purchase forms - ENABLED
    PURCHASE_INVOICE: true,
    PURCHASE_ORDER: true,
    GOODS_RECEIPT: true,
    PURCHASE_RETURN: true,
    
    // Phase 4: Receipt/payment - DISABLED for now
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
