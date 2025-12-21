/**
 * SystemFieldRegistry.ts
 * 
 * System-level field registry defining CORE and SHARED fields
 * for each voucher type.
 * 
 * CORE fields are required by backend handlers (ADR-005).
 * SHARED fields are optional but system-defined.
 * 
 * This registry is the SINGLE SOURCE OF TRUTH for what fields exist.
 */

import { FieldDefinitionV2 } from './FieldDefinitionV2';
import { VoucherTypeCode } from './VoucherLayoutV2';

/**
 * Field Registry for a Single Voucher Type
 */
export interface VoucherTypeFieldRegistry {
  /**
   * Voucher type code
   */
  voucherType: VoucherTypeCode;
  
  /**
   * CORE fields (required by backend)
   * These CANNOT be removed or hidden
   */
  coreFields: FieldDefinitionV2[];
  
  /**
   * SHARED fields (optional, system-defined)
   * These CAN be hidden but NOT removed
   */
  sharedFields: FieldDefinitionV2[];
  
  /**
   * Metadata
   */
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Complete System Field Registry
 * 
 * Maps voucher type to its field definitions.
 */
export interface SystemFieldRegistry {
  [voucherType: string]: VoucherTypeFieldRegistry;
}

/**
 * Registry Storage Location
 * 
 * Stored in Firestore at:
 * system/voucherFieldRegistry/{voucherType}
 */
export const FIELD_REGISTRY_COLLECTION = 'system/voucherFieldRegistry';

/**
 * Validation Result
 */
export interface FieldRegistryValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Helper to validate a field registry entry
 */
export function validateFieldRegistry(registry: VoucherTypeFieldRegistry): FieldRegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check CORE fields
  if (!registry.coreFields || registry.coreFields.length === 0) {
    errors.push('CORE fields are required');
  }
  
  // Validate CORE fields
  for (const field of registry.coreFields || []) {
    if (field.category !== 'CORE') {
      errors.push(`Field "${field.label}" must have category CORE`);
    }
    if (field.canRemove) {
      errors.push(`CORE field "${field.label}" cannot have canRemove=true`);
    }
    if (field.canHide) {
      errors.push(`CORE field "${field.label}" cannot have canHide=true`);
    }
    if (field.storedIn !== 'voucher') {
      errors.push(`CORE field "${field.label}" must be stored in voucher`);
    }
  }
  
  // Validate SHARED fields
  for (const field of registry.sharedFields || []) {
    if (field.category !== 'SHARED') {
      errors.push(`Field "${field.label}" must have category SHARED`);
    }
    if (field.canRemove) {
      errors.push(`SHARED field "${field.label}" cannot have canRemove=true`);
    }
    if (!field.canHide) {
      warnings.push(`SHARED field "${field.label}" should have canHide=true`);
    }
    if (field.storedIn !== 'voucher') {
      errors.push(`SHARED field "${field.label}" must be stored in voucher`);
    }
  }
  
  // Check for duplicate IDs
  const allFields = [...(registry.coreFields || []), ...(registry.sharedFields || [])];
  const ids = allFields.map(f => f.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate field IDs: ${duplicates.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper to get all fields (CORE + SHARED)
 */
export function getAllSystemFields(registry: VoucherTypeFieldRegistry): FieldDefinitionV2[] {
  return [
    ...(registry.coreFields || []),
    ...(registry.sharedFields || [])
  ];
}

/**
 * Helper to check if a field is modifiable
 */
export function isFieldModifiable(field: FieldDefinitionV2, action: 'remove' | 'hide' | 'rename' | 'changeType'): boolean {
  switch (action) {
    case 'remove':
      return field.canRemove;
    case 'hide':
      return field.canHide;
    case 'rename':
      return field.canRenameLabel;
    case 'changeType':
      return field.canChangeType;
    default:
      return false;
  }
}
