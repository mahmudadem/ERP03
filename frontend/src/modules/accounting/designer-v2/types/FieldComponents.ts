/**
 * FieldComponents.ts
 * 
 * Defines available field component types and their configurations.
 * These are the actual UI components that render the field.
 */

/**
 * Available Field Component Types
 */
export type FieldComponentType = 
  | 'TEXT_INPUT'          // Basic text input
  | 'NUMBER_INPUT'        // Number input with decimal config
  | 'TEXTAREA'            // Multi-line text
  | 'DATE_PICKER'         // Date selector
  | 'DATETIME_PICKER'     // Date + time selector
  | 'ACCOUNT_PICKER'      // Chart of Accounts selector
  | 'CONTACT_PICKER'      // Customer/Supplier picker
  | 'USER_PICKER'         // User selector
  | 'CURRENCY_SELECTOR'   // Currency dropdown
  | 'DROPDOWN'            // Generic dropdown with options
  | 'CHECKBOX'            // Single checkbox
  | 'RADIO_GROUP'         // Radio button group
  | 'FILE_UPLOAD'         // File upload button
  | 'ATTACHMENT'          // Multiple file attachments
  | 'RICH_TEXT'           // Rich text editor
  | 'FORMULA'             // Calculated field
  | 'BARCODE_SCANNER'     // Barcode/QR scanner
  | 'SIGNATURE'           // Digital signature pad
  | 'LOCATION'            // GPS location picker
  | 'COLOR_PICKER'        // Color selector
  | 'RATING'              // Star rating
  | 'SLIDER'              // Range slider
  | 'SWITCH';             // Toggle switch

/**
 * Component-specific configuration
 */
export interface ComponentConfig {
  // Text Input
  textInput?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    mask?: string;
  };
  
  // Number Input
  numberInput?: {
    min?: number;
    max?: number;
    step?: number;
    decimals?: number;
    prefix?: string;  // e.g., "$", "€"
    suffix?: string;  // e.g., "%", "kg"
  };
  
  // Date Picker
  datePicker?: {
    minDate?: string;
    maxDate?: string;
    format?: string;  // e.g., "DD/MM/YYYY"
    defaultToToday?: boolean;
  };
  
  // Account Picker
  accountPicker?: {
    accountTypes?: string[];  // Filter by type
    excludeAccounts?: string[];
    includeInactive?: boolean;
  };
  
  // Dropdown
  dropdown?: {
    options: Array<{
      value: string;
      label: string;
      icon?: string;
    }>;
    allowCustomInput?: boolean;
    multiple?: boolean;
  };
  
  // File Upload
  fileUpload?: {
    acceptedTypes?: string[];  // e.g., [".pdf", ".jpg"]
    maxSize?: number;  // in bytes
    maxFiles?: number;
  };
  
  // Formula
  formula?: {
    expression: string;  // e.g., "amount * exchangeRate"
    dependencies: string[];  // Field IDs this depends on
  };
  
  // Slider
  slider?: {
    min: number;
    max: number;
    step?: number;
    showValue?: boolean;
  };
}

/**
 * Extended Field Definition with Component Type
 */
export interface FieldWithComponent {
  componentType: FieldComponentType;
  componentConfig?: ComponentConfig;
}

/**
 * Get default component type for a field type
 */
export function getDefaultComponentType(fieldType: string): FieldComponentType {
  const mapping: Record<string, FieldComponentType> = {
    'TEXT': 'TEXT_INPUT',
    'NUMBER': 'NUMBER_INPUT',
    'DATE': 'DATE_PICKER',
    'TEXTAREA': 'TEXTAREA',
    'SELECT': 'DROPDOWN',
    'CHECKBOX': 'CHECKBOX',
    'RELATION': 'ACCOUNT_PICKER',
    'UPLOAD': 'FILE_UPLOAD'
  };
  
  return mapping[fieldType] || 'TEXT_INPUT';
}

/**
 * Get available component types for a field type
 */
export function getAvailableComponents(fieldType: string): FieldComponentType[] {
  const availableByType: Record<string, FieldComponentType[]> = {
    'TEXT': ['TEXT_INPUT', 'TEXTAREA', 'RICH_TEXT', 'BARCODE_SCANNER'],
    'NUMBER': ['NUMBER_INPUT', 'SLIDER', 'RATING', 'FORMULA'],
    'DATE': ['DATE_PICKER', 'DATETIME_PICKER'],
    'SELECT': ['DROPDOWN', 'RADIO_GROUP'],
    'CHECKBOX': ['CHECKBOX', 'SWITCH'],
    'RELATION': ['ACCOUNT_PICKER', 'CONTACT_PICKER', 'USER_PICKER'],
    'UPLOAD': ['FILE_UPLOAD', 'ATTACHMENT', 'SIGNATURE']
  };
  
  return availableByType[fieldType] || ['TEXT_INPUT'];
}

/**
 * Component metadata for UI display
 */
export interface ComponentMetadata {
  type: FieldComponentType;
  label: string;
  description: string;
  icon: string;
  category: 'Basic' | 'Advanced' | 'Specialized';
}

export const COMPONENT_LIBRARY: ComponentMetadata[] = [
  // Basic
  { type: 'TEXT_INPUT', label: 'Text Input', description: 'Single line text', icon: '📝', category: 'Basic' },
  { type: 'NUMBER_INPUT', label: 'Number', description: 'Numeric input with decimals', icon: '🔢', category: 'Basic' },
  { type: 'TEXTAREA', label: 'Text Area', description: 'Multi-line text', icon: '📄', category: 'Basic' },
  { type: 'DATE_PICKER', label: 'Date', description: 'Date selector', icon: '📅', category: 'Basic' },
  { type: 'DROPDOWN', label: 'Dropdown', description: 'Select from list', icon: '📋', category: 'Basic' },
  { type: 'CHECKBOX', label: 'Checkbox', description: 'Yes/No toggle', icon: '☑️', category: 'Basic' },
  
  // Advanced
  { type: 'ACCOUNT_PICKER', label: 'Account Picker', description: 'Select from chart of accounts', icon: '🏦', category: 'Advanced' },
  { type: 'CONTACT_PICKER', label: 'Contact Picker', description: 'Select customer/supplier', icon: '👤', category: 'Advanced' },
  { type: 'USER_PICKER', label: 'User Picker', description: 'Select system user', icon: '👥', category: 'Advanced' },
  { type: 'CURRENCY_SELECTOR', label: 'Currency', description: 'Currency selector', icon: '💱', category: 'Advanced' },
  { type: 'FILE_UPLOAD', label: 'File Upload', description: 'Upload documents', icon: '📎', category: 'Advanced' },
  { type: 'RICH_TEXT', label: 'Rich Text', description: 'Formatted text editor', icon: '✍️', category: 'Advanced' },
  
  // Specialized
  { type: 'FORMULA', label: 'Formula', description: 'Calculated field', icon: '🧮', category: 'Specialized' },
  { type: 'BARCODE_SCANNER', label: 'Barcode', description: 'Scan barcode/QR', icon: '📷', category: 'Specialized' },
  { type: 'SIGNATURE', label: 'Signature', description: 'Digital signature', icon: '✒️', category: 'Specialized' },
  { type: 'LOCATION', label: 'Location', description: 'GPS coordinates', icon: '📍', category: 'Specialized' },
  { type: 'RATING', label: 'Rating', description: 'Star rating', icon: '⭐', category: 'Specialized' },
  { type: 'SLIDER', label: 'Slider', description: 'Range selector', icon: '🎚️', category: 'Specialized' }
];
