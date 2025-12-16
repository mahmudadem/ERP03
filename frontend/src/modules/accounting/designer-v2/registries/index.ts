/**
 * Central Field Registry
 * 
 * Exports all voucher type registries and provides lookup functions.
 */

import { SystemFieldRegistry, VoucherTypeFieldRegistry } from '../types/SystemFieldRegistry';
import { VoucherTypeCode } from '../types/VoucherLayoutV2';
import { PAYMENT_VOUCHER_REGISTRY } from './PaymentVoucherRegistry';
import { RECEIPT_VOUCHER_REGISTRY } from './ReceiptVoucherRegistry';
import { JOURNAL_ENTRY_REGISTRY } from './JournalEntryRegistry';
import { OPENING_BALANCE_REGISTRY } from './OpeningBalanceRegistry';

/**
 * Complete System Field Registry
 * 
 * Single source of truth for all voucher type field definitions.
 */
export const SYSTEM_FIELD_REGISTRY: SystemFieldRegistry = {
  PAYMENT: PAYMENT_VOUCHER_REGISTRY,
  RECEIPT: RECEIPT_VOUCHER_REGISTRY,
  JOURNAL_ENTRY: JOURNAL_ENTRY_REGISTRY,
  OPENING_BALANCE: OPENING_BALANCE_REGISTRY
};

/**
 * Get registry for a specific voucher type
 */
export function getVoucherTypeRegistry(voucherType: VoucherTypeCode): VoucherTypeFieldRegistry {
  const registry = SYSTEM_FIELD_REGISTRY[voucherType];
  
  if (!registry) {
    throw new Error(`No registry found for voucher type: ${voucherType}`);
  }
  
  return registry;
}

/**
 * Get all CORE fields for a voucher type
 */
export function getCoreFields(voucherType: VoucherTypeCode) {
  return getVoucherTypeRegistry(voucherType).coreFields;
}

/**
 * Get all SHARED fields for a voucher type
 */
export function getSharedFields(voucherType: VoucherTypeCode) {
  return getVoucherTypeRegistry(voucherType).sharedFields;
}

/**
 * Get all system fields (CORE + SHARED) for a voucher type
 */
export function getAllSystemFields(voucherType: VoucherTypeCode) {
  const registry = getVoucherTypeRegistry(voucherType);
  return [...registry.coreFields, ...registry.sharedFields];
}

 /**
 * Check if a field exists in system registry
 */
export function isSystemField(voucherType: VoucherTypeCode, fieldId: string): boolean {
  const allFields = getAllSystemFields(voucherType);
  return allFields.some(f => f.id === fieldId);
}

/**
 * Get a specific field by ID
 */
export function getFieldById(voucherType: VoucherTypeCode, fieldId: string) {
  const allFields = getAllSystemFields(voucherType);
  return allFields.find(f => f.id === fieldId);
}

/**
 * Validate that all CORE fields are present in user's layout
 */
export function validateCoreFieldsPresent(
  voucherType: VoucherTypeCode, 
  userFieldIds: string[]
): { valid: boolean; missingFields: string[] } {
  const coreFields = getCoreFields(voucherType);
  const missingFields: string[] = [];
  
  for (const coreField of coreFields) {
    if (!userFieldIds.includes(coreField.id)) {
      missingFields.push(coreField.label);
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

// Re-export individual registries for direct access
export {
  PAYMENT_VOUCHER_REGISTRY,
  RECEIPT_VOUCHER_REGISTRY,
  JOURNAL_ENTRY_REGISTRY,
  OPENING_BALANCE_REGISTRY
};
