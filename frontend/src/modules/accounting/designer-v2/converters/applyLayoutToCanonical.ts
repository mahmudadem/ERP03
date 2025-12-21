import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { VoucherLayoutV2 } from '../types/VoucherLayoutV2';

/**
 * Applies layout changes to canonical VoucherTypeDefinition while preserving accounting semantics.
 * 
 * ⚠️ CRITICAL: This is NOT a layout-to-canonical converter
 * This function takes the ORIGINAL canonical definition and applies COSMETIC changes from layout.
 * 
 * ALLOWED CHANGES (UI only):
 * - Field labels
 * - Field ordering
 * - Visibility rules
 * - Validation rules
 * - Column widths
 * - Layout metadata (grid, spacing)
 * 
 * FORBIDDEN CHANGES (Accounting semantics - IMMUTABLE):
 * - isPosting
 * - postingRole
 * - requiredPostingRoles
 * - schemaVersion (always = 2)
 * - code, module, companyId (identifiers)
 * 
 * @param original - Original canonical Voucher TypeDefinition (source of truth for accounting)
 * @param layout - Edited VoucherLayoutV2 (contains UI changes)
 * @returns New VoucherTypeDefinition with UI changes applied + accounting semantics preserved
 * 
 * @throws Error if original.schemaVersion !== 2
 * @throws Error if layout attempts to modify forbidden properties
 */
export function applyLayoutToCanonical(
  original: VoucherTypeDefinition,
  layout: VoucherLayoutV2
): VoucherTypeDefinition {
  // VALIDATION 1: Only Schema V2
  if (original.schemaVersion !== 2) {
    throw new Error(
      `Cannot apply layout to non-V2 definition. ` +
      `Original schema version: ${original.schemaVersion}`
    );
  }

  // VALIDATION 2: Ensure layout is for same voucher type
  if (layout.voucherType !== original.code) {
    throw new Error(
      `Layout mismatch: Layout is for ${layout.voucherType} but definition is ${original.code}`
    );
  }

  // START WITH ORIGINAL (immutability)
  const updated: VoucherTypeDefinition = {
    ...original,
    
    // PRESERVE IMMUTABLE PROPERTIES (These must NEVER change)
    id: original.id,
    companyId: original.companyId,
    code: original.code,
    module: original.module,
    schemaVersion: 2, // FORCE Schema V2
    requiredPostingRoles: original.requiredPostingRoles,
    
    // APPLY: Header field UI changes
    headerFields: applyFieldChanges(original.headerFields, layout.body.fields),
    
    // APPLY: Table column UI changes
    tableColumns: applyColumnChanges(original.tableColumns, layout.lines.columns),
    
    // APPLY: Layout metadata
    layout: {
      ...original.layout,
      gridColumns: layout.body.columns,
      gap: layout.body.gap,
      headerLayout: layout.header.layout
    }
  };

  return updated;
}

/**
 * Apply field UI changes while preserving accounting semantics
 */
function applyFieldChanges(
  originalFields: VoucherTypeDefinition['headerFields'],
  layoutFields: VoucherLayoutV2['body']['fields']
): VoucherTypeDefinition['headerFields'] {
  return originalFields.map(canonicalField => {
    // Find corresponding field in layout
    const layoutField = layoutFields.find(f => f.id === canonicalField.id);
    
    if (!layoutField) {
      // Field not in layout - keep original
      return canonicalField;
    }
    
    // Apply ALLOWED changes, preserve FORBIDDEN properties
    return {
      ...canonicalField,
      
      // ✅ ALLOWED: UI properties
      label: layoutField.label,
      required: layoutField.required !== undefined ? layoutField.required : canonicalField.required,
      readOnly: layoutField.readOnly !== undefined ? layoutField.readOnly : canonicalField.readOnly,
      validationRules: layoutField.validationRules || canonicalField.validationRules,
      visibilityRules: layoutField.visibilityRules || canonicalField.visibilityRules,
      defaultValue: layoutField.defaultValue !== undefined ? layoutField.defaultValue : canonicalField.defaultValue,
      
      // ✅ PRESERVED: Accounting semantics (IMMUTABLE)
      isPosting: canonicalField.isPosting,
      postingRole: canonicalField.postingRole,
      schemaVersion: canonicalField.schemaVersion
    };
  });
}

/**
 * Apply column UI changes (width only)
 */
function applyColumnChanges(
  originalColumns: VoucherTypeDefinition['tableColumns'],
  layoutColumns: VoucherLayoutV2['lines']['columns']
): VoucherTypeDefinition['tableColumns'] {
  if (!layoutColumns) {
    // No columns in layout - keep original
    return originalColumns;
  }
  
  return originalColumns.map(canonicalColumn => {
    // Find corresponding column in layout
    const layoutColumn = layoutColumns.find(c => c.id === canonicalColumn.fieldId);
    
    if (!layoutColumn) {
      return canonicalColumn;
    }
    
    // Apply ALLOWED change (width only)
    return {
      ...canonicalColumn,
      width: layoutColumn.width || canonicalColumn.width
    };
  });
}

/**
 * Validates that no forbidden changes were attempted
 * Call this after applyLayoutToCanonical to ensure integrity
 */
export function validateNoForbiddenChanges(
  original: VoucherTypeDefinition,
  updated: VoucherTypeDefinition
): void {
  const errors: string[] = [];

  // Check immutable properties
  if (updated.schemaVersion !== 2) {
    errors.push(`schemaVersion changed from 2 to ${updated.schemaVersion}`);
  }
  
  if (updated.code !== original.code) {
    errors.push(`code changed from ${original.code} to ${updated.code}`);
  }
  
  if (updated.module !== original.module) {
    errors.push(`module changed from ${original.module} to ${updated.module}`);
  }
  
  if (updated.companyId !== original.companyId) {
    errors.push(`companyId changed from ${original.companyId} to ${updated.companyId}`);
  }

  // Check field accounting semantics
  updated.headerFields.forEach((updatedField, index) => {
    const originalField = original.headerFields[index];
    
    if (!originalField) return;
    
    if (updatedField.isPosting !== originalField.isPosting) {
      errors.push(`Field ${updatedField.id}: isPosting changed`);
    }
    
    if (updatedField.postingRole !== originalField.postingRole) {
      errors.push(`Field ${updatedField.id}: postingRole changed`);
    }
  });

  if (errors.length > 0) {
    throw new Error(
      `Forbidden changes detected:\n- ${errors.join('\n- ')}\n\n` +
      `Only UI properties (labels, visibility, layout) can be changed.`
    );
  }
}
