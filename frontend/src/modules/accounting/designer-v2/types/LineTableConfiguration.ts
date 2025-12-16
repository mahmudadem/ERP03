/**
 * LineTableConfiguration.ts
 * 
 * Defines configurable line table columns for journal entries.
 * Essential columns (Account, Debit, Credit) cannot be removed.
 * Optional columns can be added/removed/reordered.
 */

/**
 * Line Table Column Definition
 */
export interface LineColumnDefinition {
  id: string;
  dataKey: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'RELATION' | 'SELECT' | 'DATE' | 'TEXTAREA';
  width?: number;  // Percentage or pixels
  essential: boolean;  // Cannot be removed if true
  order: number;
  visible: boolean;
  editable: boolean;
  
  // Component config
  componentType?: string;
  
  // Formatting
  align?: 'left' | 'center' | 'right';
  format?: string;  // e.g., "currency", "percentage"
}

/**
 * Essential Line Columns (Cannot be removed)
 */
export const ESSENTIAL_LINE_COLUMNS: LineColumnDefinition[] = [
  {
    id: 'account',
    dataKey: 'accountId',
    label: 'Account',
    type: 'RELATION',
    width: 250,
    essential: true,
    order: 1,
    visible: true,
    editable: true,
    componentType: 'ACCOUNT_PICKER',
    align: 'left'
  },
  {
    id: 'debit',
    dataKey: 'debit',
    label: 'Debit',
    type: 'NUMBER',
    width: 150,
    essential: true,
    order: 2,
    visible: true,
    editable: true,
    componentType: 'NUMBER_INPUT',
    align: 'right',
    format: 'currency'
  },
  {
    id: 'credit',
    dataKey: 'credit',
    label: 'Credit',
    type: 'NUMBER',
    width: 150,
    essential: true,
    order: 3,
    visible: true,
    editable: true,
    componentType: 'NUMBER_INPUT',
    align: 'right',
    format: 'currency'
  }
];

/**
 * Optional Line Columns (Can be added/removed)
 */
export const OPTIONAL_LINE_COLUMNS: LineColumnDefinition[] = [
  {
    id: 'description',
    dataKey: 'description',
    label: 'Description',
    type: 'TEXTAREA',
    width: 200,
    essential: false,
    order: 4,
    visible: true,
    editable: true,
    componentType: 'TEXTAREA',
    align: 'left'
  },
  {
    id: 'costCenter',
    dataKey: 'costCenterId',
    label: 'Cost Center',
    type: 'RELATION',
    width: 150,
    essential: false,
    order: 5,
    visible: false,
    editable: true,
    componentType: 'DROPDOWN',
    align: 'left'
  },
  {
    id: 'project',
    dataKey: 'projectId',
    label: 'Project',
    type: 'RELATION',
    width: 150,
    essential: false,
    order: 6,
    visible: false,
    editable: true,
    componentType: 'DROPDOWN',
    align: 'left'
  },
  {
    id: 'currency',
    dataKey: 'currency',
    label: 'Currency',
    type: 'SELECT',
    width: 100,
    essential: false,
    order: 7,
    visible: false,
    editable: true,
    componentType: 'CURRENCY_SELECTOR',
    align: 'center'
  },
  {
    id: 'exchangeRate',
    dataKey: 'exchangeRate',
    label: 'Exchange Rate',
    type: 'NUMBER',
    width: 120,
    essential: false,
    order: 8,
    visible: false,
    editable: true,
    componentType: 'NUMBER_INPUT',
    align: 'right',
    format: 'decimal'
  },
  {
    id: 'reference',
    dataKey: 'reference',
    label: 'Reference',
    type: 'TEXT',
    width: 150,
    essential: false,
    order: 9,
    visible: false,
    editable: true,
    componentType: 'TEXT_INPUT',
    align: 'left'
  },
  {
    id: 'taxCode',
    dataKey: 'taxCodeId',
    label: 'Tax Code',
    type: 'RELATION',
    width: 120,
    essential: false,
    order: 10,
    visible: false,
    editable: true,
    componentType: 'DROPDOWN',
    align: 'left'
  },
  {
    id: 'taxAmount',
    dataKey: 'taxAmount',
    label: 'Tax Amount',
    type: 'NUMBER',
    width: 120,
    essential: false,
    order: 11,
    visible: false,
    editable: false,  // Usually calculated
    componentType: 'NUMBER_INPUT',
    align: 'right',
    format: 'currency'
  },
  {
    id: 'quantity',
    dataKey: 'quantity',
    label: 'Quantity',
    type: 'NUMBER',
    width: 100,
    essential: false,
    order: 12,
    visible: false,
    editable: true,
    componentType: 'NUMBER_INPUT',
    align: 'right',
    format: 'decimal'
  },
  {
    id: 'unitPrice',
    dataKey: 'unitPrice',
    label: 'Unit Price',
    type: 'NUMBER',
    width: 120,
    essential: false,
    order: 13,
    visible: false,
    editable: true,
    componentType: 'NUMBER_INPUT',
    align: 'right',
    format: 'currency'
  }
];

/**
 * Line Table Configuration
 */
export interface LineTableConfiguration {
  columns: LineColumnDefinition[];
  showLineNumbers: boolean;
  showTotals: boolean;
  allowAddLines: boolean;
  allowDeleteLines: boolean;
  allowReorderLines: boolean;
  minLines?: number;
  maxLines?: number;
  defaultLines: number;
}

/**
 * Get default line table configuration
 */
export function getDefaultLineTableConfig(): LineTableConfiguration {
  return {
    columns: [
      ...ESSENTIAL_LINE_COLUMNS,
      ...OPTIONAL_LINE_COLUMNS.filter(c => c.visible)
    ],
    showLineNumbers: true,
    showTotals: true,
    allowAddLines: true,
    allowDeleteLines: true,
    allowReorderLines: true,
    minLines: 1,
    maxLines: undefined,  // No limit
    defaultLines: 3
  };
}

/**
 * Validate line table configuration
 */
export function validateLineTableConfig(config: LineTableConfiguration): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check essential columns are present
  const essentialIds = ESSENTIAL_LINE_COLUMNS.map(c => c.id);
  const configIds = config.columns.map(c => c.id);
  
  for (const essentialId of essentialIds) {
    if (!configIds.includes(essentialId)) {
      errors.push(`Essential column missing: ${essentialId}`);
    }
  }
  
  // Check no duplicate column IDs
  const duplicates = configIds.filter((id, index) => configIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate columns: ${duplicates.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get all available line columns
 */
export function getAllAvailableLineColumns(): LineColumnDefinition[] {
  return [...ESSENTIAL_LINE_COLUMNS, ...OPTIONAL_LINE_COLUMNS];
}

/**
 * Check if column is essential
 */
export function isEssentialColumn(columnId: string): boolean {
  return ESSENTIAL_LINE_COLUMNS.some(c => c.id === columnId);
}
