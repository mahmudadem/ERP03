import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { VoucherLayoutV2, DisplayMode, VoucherTypeCode, HeaderAreaConfig, BodyAreaConfig, LinesAreaConfig, ActionsAreaConfig } from '../types/VoucherLayoutV2';
import { FieldDefinitionV2 } from '../types/FieldDefinitionV2';

/**
 * Converts canonical VoucherTypeDefinition (Schema V2) to VoucherLayoutV2 view model.
 * 
 * ⚠️ ONE-WAY CONVERSION ONLY
 * This function generates an ephemeral UI view model for rendering.
 * VoucherLayoutV2 must NEVER be persisted.
 * 
 * Accounting semantics (isPosting, postingRole, requiredPostingRoles) are INTENTIONALLY STRIPPED.
 * The UI does not need to know which fields are posting fields.
 * 
 * @param definition - Canonical VoucherTypeDefinition (schemaVersion must be 2)
 * @param mode - Display mode ('classic' | 'windows')
 * @returns VoucherLayoutV2 - Ephemer view model for rendering ONLY
 * 
 * @throws Error if definition.schemaVersion !== 2
 */
export function canonicalToLayout(
  definition: VoucherTypeDefinition,
  mode: DisplayMode = 'classic'
): VoucherLayoutV2 {
  // VALIDATION: Only Schema V2
  if (definition.schemaVersion !== 2) {
    throw new Error(
      `Cannot convert to layout: Only Schema V2 definitions are supported. ` +
      `Received schema version: ${definition.schemaVersion}`
    );
  }

  // DETERMINE: Lines area type based on voucher code
  const linesType = determineLinesType(definition.code);

  // CONVERT: Header fields to body fields (STRIP ACCOUNTING SEMANTICS)
  const bodyFields = convertHeaderFieldsToBodyFields(definition.headerFields);

  // CONVERT: Table columns (if applicable)
  const lineColumns = linesType === 'table' 
    ? convertTableColumnsToLineColumns(definition.tableColumns)
    : undefined;

  // EXTRACT: Layout hints from canonical (ordering only)
  const layoutHints = definition.layout || {};

  // BUILD: VoucherLayoutV2 (VIEW MODEL)
  return {
    id: definition.id,
    voucherType: definition.code as VoucherTypeCode,
    mode,
    companyId: definition.companyId,
    isDefault: false,
    
    header: buildHeaderArea(),
    body: buildBodyArea(bodyFields, layoutHints),
    lines: buildLinesArea(linesType, lineColumns),
    actions: buildActionsArea()
  };
}

/**
 * Determine lines area type based on voucher code
 */
function determineLinesType(code: string): 'table' | 'single-line' | 'preview' {
  // Multi-line vouchers: Journal Entry, Opening Balance
  if (code === 'JOURNAL_ENTRY' || code === 'OPENING_BALANCE') {
    return 'table';
  }
  
  // Single-line vouchers: Payment, Receipt
  return 'single-line';
}

/**
 * Convert canonical headerFields to body fields
 * STRIPS: isPosting, postingRole, schemaVersion
 */
function convertHeaderFieldsToBodyFields(
  headerFields: VoucherTypeDefinition['headerFields']
): FieldDefinitionV2[] {
  return headerFields.map(field => ({
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type as FieldDefinitionV2['type'],
    required: field.required,
    readOnly: field.readOnly,
    validationRules: field.validationRules,
    visibilityRules: field.visibilityRules,
    defaultValue: field.defaultValue
    // ✅ STRIPPED: isPosting (accounting concern)
    // ✅ STRIPPED: postingRole (accounting concern)
    // ✅ STRIPPED: schemaVersion (metadata)
  }));
}

/**
 * Convert canonical tableColumns to line columns
 */
function convertTableColumnsToLineColumns(
  tableColumns: VoucherTypeDefinition['tableColumns']
): FieldDefinitionV2[] {
  // For each column, create a FieldDefinitionV2
  // Width is preserved, but we need full field definitions
  return tableColumns.map((col, index) => ({
    id: col.fieldId,
    name: col.fieldId,
    label: formatColumnLabel(col.fieldId),
    type: inferColumnType(col.fieldId),
    width: col.width,
    required: false,
    readOnly: false,
    order: index
  }));
}

/**
 * Format column ID to human-readable label
 */
function formatColumnLabel(fieldId: string): string {
  return fieldId
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Infer field type from column ID
 */
function inferColumnType(fieldId: string): FieldDefinitionV2['type'] {
  if (fieldId.includes('account') || fieldId.includes('Account')) return 'ACCOUNT';
  if (fieldId.includes('amount') || fieldId.includes('debit') || fieldId.includes('credit')) return 'NUMBER';
  if (fieldId.includes('date') || fieldId.includes('Date')) return 'DATE';
  return 'TEXT';
}

/**
 * Build header area (system metadata fields)
 */
function buildHeaderArea(): HeaderAreaConfig {
  return {
    fields: [
      { id: 'voucherNo', name: 'voucherNo', label: 'Voucher No', type: 'TEXT', required: false, readOnly: true },
      { id: 'status', name: 'status', label: 'Status', type: 'TEXT', required: false, readOnly: true },
      { id: 'createdDate', name: 'createdDate', label: 'Created', type: 'DATE', required: false, readOnly: true }
    ],
    locked: true,
    layout: 'inline'
  };
}

/**
 * Build body area with field definitions
 */
function buildBodyArea(
  fields: FieldDefinitionV2[],
  layoutHints: Record<string, any>
): BodyAreaConfig {
  return {
    fields,
    columns: layoutHints.gridColumns || 4,
    gap: layoutHints.gap || 16
  };
}

/**
 * Build lines area configuration
 */
function buildLinesArea(
  type: 'table' | 'single-line' | 'preview',
  columns?: FieldDefinitionV2[]
): LinesAreaConfig {
  return {
    type,
    columns,
    minLines: type === 'table' ? 1 : undefined,
    maxLines: type === 'table' ? 999 : undefined,
    showTotals: type === 'table',
    showAddButton: type === 'table'
  };
}

/**
 * Build actions area with default buttons
 */
function buildActionsArea(): ActionsAreaConfig {
  return {
    buttons: [
      { id: 'submit', label: 'Submit', variant: 'primary', action: 'submit', visible: true, order: 1 },
      { id: 'draft', label: 'Save Draft', variant: 'secondary', action: 'saveDraft', visible: true, order: 2 },
      { id: 'print', label: 'Print', variant: 'secondary', action: 'print', visible: true, order: 3 }
    ],
    alignment: 'right'
  };
}
