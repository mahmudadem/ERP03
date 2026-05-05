/**
 * DocumentValidatorFactory
 * 
 * Factory pattern for resolving the correct validator class based on voucher type.
 * Uses a registry pattern for extensibility.
 */

import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { DocumentValidator } from './DocumentValidator';
import { JournalValidator } from './JournalValidator';
import { SalesValidator } from './SalesValidator';
import { PurchaseValidator } from './PurchaseValidator';
import { ReceiptPaymentValidator } from './ReceiptPaymentValidator';
import { BusinessRulesConfig } from './types';

/**
 * Validator registry - maps type patterns to validator classes
 */
type ValidatorClass = new (
  definition: VoucherTypeDefinition,
  formData: any,
  businessRules?: BusinessRulesConfig
) => DocumentValidator;

export class DocumentValidatorFactory {
  private static registry = new Map<string, ValidatorClass>();

  /**
   * Register a validator class for a specific type pattern
   * Called once at module initialization
   */
  static register(typePattern: string, validatorClass: ValidatorClass): void {
    this.registry.set(typePattern.toUpperCase(), validatorClass);
  }

  /**
   * Get the appropriate validator for the given document definition
   */
  static getValidator(
    definition: VoucherTypeDefinition,
    formData: any,
    businessRules?: BusinessRulesConfig
  ): DocumentValidator {
    const typeKey = this.resolveTypeKey(definition, formData);
    const module = (definition.module || '').toUpperCase();

    // Priority 1: Exact type match
    const exactValidator = this.registry.get(typeKey);
    if (exactValidator) {
      return new exactValidator(definition, formData, businessRules);
    }

    // Priority 2: Module-level match
    const moduleValidator = this.registry.get(module);
    if (moduleValidator) {
      return new moduleValidator(definition, formData, businessRules);
    }

    // Priority 3: DEFAULT fallback (JournalValidator - most permissive)
    const defaultValidator = this.registry.get('DEFAULT');
    if (defaultValidator) {
      return new defaultValidator(definition, formData, businessRules);
    }

    // Fallback to JournalValidator if nothing registered
    return new JournalValidator(definition, formData, businessRules);
  }

  /**
   * Resolve the type key from definition using the same chain as VoucherWindow
   */
  private static resolveTypeKey(
    definition: VoucherTypeDefinition,
    formData: any
  ): string {
    // Collect all possible type identifiers
    const candidates = [
      definition.formType || definition.baseType,
      definition.code,
      definition.module,
      formData?.type,
      formData?.voucherType,
    ]
      .filter(Boolean)
      .map((s) => String(s).toUpperCase());

    // Check each candidate against known patterns
    for (const candidate of candidates) {
      // Journal types
      if (
        candidate.includes('JOURNAL') ||
        candidate === 'JV' ||
        candidate.includes('REVALUATION') ||
        candidate.includes('OPENING')
      ) {
        return 'JOURNAL_ENTRY';
      }

      // Purchase types must be checked before generic INVOICE/ORDER/RETURN sales matches.
      if (
        candidate.includes('PURCHASE') ||
        candidate.includes('BILL') ||
        candidate === 'PI' ||
        candidate === 'PO' ||
        candidate === 'GRN' ||
        candidate.includes('GOODS_RECEIPT') ||
        candidate === 'PR'
      ) {
        return 'PURCHASE';
      }

      // Sales types
      if (
        candidate.includes('SALES') ||
        candidate.includes('INVOICE') ||
        candidate === 'SI' ||
        candidate.includes('ORDER') ||
        candidate === 'SO' ||
        candidate.includes('DELIVERY') ||
        candidate === 'DN' ||
        candidate.includes('RETURN') ||
        candidate === 'SR'
      ) {
        return 'SALES';
      }

      // Receipt
      if (candidate === 'RECEIPT' || candidate.includes('RECEIPT') && !candidate.includes('GOODS')) {
        return 'RECEIPT';
      }

      // Payment
      if (candidate === 'PAYMENT' || candidate.includes('PAYMENT')) {
        return 'PAYMENT';
      }

      // Reversal - special case, use JournalValidator
      if (candidate === 'REVERSAL' || candidate.includes('REVERSAL')) {
        return 'JOURNAL_ENTRY';
      }
    }

    // Default to JOURNAL_ENTRY if no match
    return 'JOURNAL_ENTRY';
  }

  /**
   * Initialize the factory with default validators
   * Called once at application startup
   */
  static initializeDefaults(): void {
    // Specific type registrations
    this.register('JOURNAL_ENTRY', JournalValidator);
    this.register('FX_REVALUATION', JournalValidator);
    this.register('OPENING_BALANCE', JournalValidator);
    this.register('REVERSAL', JournalValidator);

    this.register('SALES_INVOICE', SalesValidator);
    this.register('SALES_ORDER', SalesValidator);
    this.register('SALES_RETURN', SalesValidator);
    this.register('DELIVERY_NOTE', SalesValidator);

    this.register('PURCHASE_INVOICE', PurchaseValidator);
    this.register('PURCHASE_ORDER', PurchaseValidator);
    this.register('GOODS_RECEIPT', PurchaseValidator);
    this.register('PURCHASE_RETURN', PurchaseValidator);

    this.register('RECEIPT', ReceiptPaymentValidator);
    this.register('PAYMENT', ReceiptPaymentValidator);

    // Module-level fallbacks
    this.register('ACCOUNTING', JournalValidator);
    this.register('SALES', SalesValidator);
    this.register('PURCHASE', PurchaseValidator);
    this.register('INVENTORY', JournalValidator);

    // Default fallback
    this.register('DEFAULT', JournalValidator);
  }
}

// Auto-initialize on module load
DocumentValidatorFactory.initializeDefaults();
