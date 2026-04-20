/**
 * useDocumentValidation Hook
 * 
 * React hook that integrates the 3-layer validation system with VoucherWindow.
 * Returns validation results and computed canSave state.
 */

import { useMemo } from 'react';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { DocumentValidatorFactory } from './DocumentValidatorFactory';
import { ValidationResult, BusinessRulesConfig } from './types';

export interface UseDocumentValidationOptions {
  /** Company-level business rules (default for all forms) */
  companyBusinessRules?: BusinessRulesConfig;
  /** Feature flag to enable/disable new validation */
  enabled?: boolean;
  /** Enable parallel run logging (compare with old validation) */
  parallelRun?: boolean;
}

/**
 * Hook for document validation
 */
export function useDocumentValidation(
  definition: VoucherTypeDefinition | undefined,
  formData: any,
  options: UseDocumentValidationOptions = {}
): ValidationResult {
  const {
    companyBusinessRules,
    enabled = true,
    parallelRun = false,
  } = options;

  return useMemo(() => {
    // Guard: No definition = invalid
    if (!definition) {
      return {
        structuralErrors: ['Form definition is missing'],
        businessErrors: [],
        businessWarnings: [],
        systemWarnings: [],
        canSave: false,
        hasWarnings: false,
        hasErrors: true,
      };
    }

    // Get validator from factory
    const validator = DocumentValidatorFactory.getValidator(
      definition,
      formData,
      companyBusinessRules
    );

    // Run validation
    const result = validator.validate();

    // Parallel run logging (development only)
    if (parallelRun && process.env.NODE_ENV === 'development') {
      console.log('[VALIDATION] Parallel run:', {
        type: definition.code || definition.baseType,
        ...result._debug,
      });
    }

    return result;
  }, [definition, formData, companyBusinessRules, enabled, parallelRun]);
}

/**
 * Hook for async validation (API-dependent rules)
 * Run on-demand (e.g., on save click) for rules that require server calls
 */
export async function useDocumentValidationAsync(
  definition: VoucherTypeDefinition,
  formData: any,
  companyBusinessRules?: BusinessRulesConfig
): Promise<{
  creditLimitWarning?: string;
  stockAvailabilityWarning?: string;
  customerStatusWarning?: string;
}> {
  const warnings: {
    creditLimitWarning?: string;
    stockAvailabilityWarning?: string;
    customerStatusWarning?: string;
  } = {};

  // Placeholder for async checks
  // These would be implemented in concrete validator classes
  // and called via a separate validateAsync() method

  return warnings;
}
