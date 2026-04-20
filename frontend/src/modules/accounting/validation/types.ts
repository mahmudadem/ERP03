/**
 * Validation Types for Two-Layer Document Validation System
 * 
 * Layer 1: Structural (Developer-Defined) - Always blocks
 * Layer 2: Business Rules (User-Configured) - 4 outcomes
 * Layer 3: System Warnings (Never Configurable) - Always warns
 */

/**
 * Outcome for Layer 2 business rules
 * Defines how a rule violation affects the save/submit action
 */
export enum RuleOutcome {
  /** Hard error - save/submit blocked */
  BLOCK = 'BLOCK',
  /** Save enabled, warning shown */
  ALLOW_WITH_WARN = 'ALLOW_WITH_WARN',
  /** Hard error + detailed warning message */
  BLOCK_AND_WARN = 'BLOCK_AND_WARN',
  /** Silent pass - no error, no warning */
  ALLOW = 'ALLOW',
}

/**
 * Configuration for a business rule
 * Stored in voucherConfig.metadata.businessRules
 */
export interface BusinessRuleConfig {
  /** Whether the rule is enabled */
  enabled: boolean;
  /** What happens when rule is violated */
  outcome: RuleOutcome;
  /** Custom error message (optional, uses default if not provided) */
  errorMessage?: string;
  /** Custom warning message (optional) */
  warningMessage?: string;
}

/**
 * Predefined business rules available for configuration
 */
export interface BusinessRulesConfig {
  requirePositiveTotal?: BusinessRuleConfig;
  preventBelowCost?: BusinessRuleConfig;
  enforceCreditLimit?: BusinessRuleConfig;
  requireWarehouse?: BusinessRuleConfig;
  minLineCount?: BusinessRuleConfig & { value?: number };
  [key: string]: BusinessRuleConfig & { value?: any } | undefined;
}

/**
 * Result from Layer 1 (Structural) validation
 */
export interface StructuralResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Result from Layer 2 (Business Rules) validation
 */
export interface BusinessResult {
  /** Rules that resulted in BLOCK or BLOCK_AND_WARN */
  errors: string[];
  /** Rules that resulted in ALLOW_WITH_WARN */
  warnings: string[];
  /** Rules that resulted in ALLOW (silent) */
  passed: string[];
}

/**
 * Result from Layer 3 (System Warnings)
 */
export interface SystemWarningResult {
  warnings: string[];
}

/**
 * Combined validation result returned by the hook
 */
export interface ValidationResult {
  // Layer 1
  structuralErrors: string[];
  
  // Layer 2
  businessErrors: string[];
  businessWarnings: string[];
  
  // Layer 3
  systemWarnings: string[];
  
  // Computed
  canSave: boolean;
  hasWarnings: boolean;
  hasErrors: boolean;
  
  // Debug info (removed in production)
  _debug?: {
    layer1: StructuralResult;
    layer2: BusinessResult;
    layer3: SystemWarningResult;
  };
}

/**
 * Business rule definition for dynamic rules
 * Extends existing RuleDefinition with outcome configuration
 */
export interface ValidationRuleDefinition {
  id: string;
  type: 'VALIDATION';
  targetFieldId?: string;
  conditions: Array<{
    fieldId: string;
    operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN' | 'IS_EMPTY' | 'IS_NOT_EMPTY';
    value?: any;
  }>;
  matchType: 'AND' | 'OR';
  errorMessage?: string;
  outcome?: RuleOutcome;
  enabled?: boolean;
}
