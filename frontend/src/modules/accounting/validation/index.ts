/**
 * Document Validation System
 * 
 * Two-Layer (plus warnings) validation architecture:
 * - Layer 1: Structural (developer-defined, always blocks)
 * - Layer 2: Business Rules (user-configured, 4 outcomes)
 * - Layer 3: System Warnings (never configurable, always warns)
 * 
 * Workflow gates (Flexible/Strict) are independent of validation.
 */

// Types
export * from './types';

// Core classes
export { DocumentValidator } from './DocumentValidator';
export { JournalValidator } from './JournalValidator';
export { SalesValidator } from './SalesValidator';
export { PurchaseValidator } from './PurchaseValidator';
export { ReceiptPaymentValidator } from './ReceiptPaymentValidator';

// Factory
export { DocumentValidatorFactory } from './DocumentValidatorFactory';

// Hook
export { useDocumentValidation, useDocumentValidationAsync } from './useDocumentValidation';

// Config
export { VALIDATION_CONFIG, isValidationEnabled, getValidationDebugConfig } from './config';
