/**
 * Voucher Wizard - Type Definitions (Pure UI)
 * 
 * ⚠️ WARNING: These are UI-ONLY types!
 * 
 * These types represent the wizard's UI state and user choices.
 * They do NOT contain:
 * - Accounting logic
 * - Schema definitions
 * - Validation rules
 * - Persistence concerns
 * 
 * The wizard collects user design choices and outputs a plain
 * VoucherTypeConfig object. Any transformation to accounting schemas
 * or validation must happen OUTSIDE the wizard.
 */

// UI Modes
export type UIMode = 'classic' | 'windows';
export type SectionType = 'HEADER' | 'BODY' | 'EXTRA' | 'ACTIONS';

// Field Categories (stored in DB with voucher type)
export type FieldCategory = 'core' | 'shared' | 'systemMetadata';

// Field and Layout Types
export interface FieldLayout {
  fieldId: string;
  row: number;
  col: number;
  colSpan: number;
  rowSpan?: number;
  typeOverride?: string;
  labelOverride?: string;
}

export interface SectionLayout {
  order: number;
  fields: FieldLayout[];
}

export interface VoucherLayoutConfig {
  sections: Record<SectionType, SectionLayout>;
}

// Actions
export type VoucherActionType = 'print' | 'email' | 'download_pdf' | 'download_excel' | 'import_csv' | 'export_json';

export interface VoucherAction {
  type: VoucherActionType;
  label: string;
  enabled: boolean;
}

// Rules (UI toggles only - no actual validation logic)
export interface VoucherRule {
  id: string;
  label: string;
  enabled: boolean;
  description?: string;
}

// Available Fields (with category metadata from DB)
export interface AvailableField {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'table' | 'textarea' | 'system' | 'account-selector';
  sectionHint?: SectionType;
  category?: FieldCategory;  // core = mandatory, shared = optional, systemMetadata = auto-managed
  mandatory?: boolean;        // true for core fields
  autoManaged?: boolean;      // true for systemMetadata fields
  supportedTypes?: string[];  // Only show for these base types
  excludedTypes?: string[];   // Hide for these base types
}

// Table Column Configuration
export interface TableColumnConfig {
  id: string;
  labelOverride?: string;
  order?: number;
  width?: string; // e.g., '100px', '20%', 'auto'
}

/**
 * Complete voucher form configuration from wizard
 * 
 * THIS IS THE OUTPUT OF THE WIZARD.
 * It contains ONLY UI choices, NO accounting logic.
 */
export interface VoucherFormConfig {
  id: string;
  name: string;
  code?: string; // Short code (e.g., "JOURNAL", "PAYMENT")
  prefix: string; // e.g., "JV-"
  module?: string; // Module (e.g., "ACCOUNTING")
  startNumber: number;
  
  // Step 2: Rules (UI toggles only)
  rules: VoucherRule[];

  // Step 1: Basic behavior
  isMultiLine: boolean;
  defaultCurrency?: string;
  
  // Step 3: Table columns selection
  tableColumns?: string[] | TableColumnConfig[]; // ['account', 'debit', 'credit', 'notes', etc.] or objects
  tableStyle?: 'web' | 'classic'; // Default to 'web'

  // Step 4: Actions
  actions: VoucherAction[];

  // Step 5: Visual layouts (auto-generated from user's drag-and-drop)
  uiModeOverrides: {
    classic: VoucherLayoutConfig;
    windows: VoucherLayoutConfig;
  };
  
  // Metadata for DB integration
  enabled?: boolean;        // Can be disabled without deletion
  isSystemDefault?: boolean; // Read-only system voucher
  isSystemGenerated?: boolean; // Was this auto-created during init?
  isDefault?: boolean;      // Is this a default form?
  isLocked?: boolean;        // Prevent editing core fields
  inUse?: boolean;          // Has transactions, can't delete
  baseType?: string;         // Metadata for backend compatibility
  headerFields?: any[]; // For persistence mapping
  
  // Metadata for arbitrary storage
  metadata?: Record<string, any>;
}

/**
 * Wizard completion callback type
 */
export type OnWizardFinish = (result: VoucherFormConfig) => void;
// End of types
