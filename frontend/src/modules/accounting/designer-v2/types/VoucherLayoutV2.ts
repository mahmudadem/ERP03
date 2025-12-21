/**
 * VoucherLayoutV2.ts
 * 
 * @deprecated for persistence - VIEW MODEL ONLY
 * 
 * ⚠️ CRITICAL WARNING ⚠️
 * VoucherLayoutV2 is an EPHEMERAL UI VIEW MODEL.
 * 
 * DO NOT:
 * - Save to database
 * - Send to API endpoints
 * - Store in localStorage
 * - Cache beyond component lifecycle
 * - Pass to any repository methods
 * 
 * This type is for RENDERING ONLY.
 * 
 * Correct Flow:
 * 1. Load VoucherTypeDefinition (canonical, Schema V2)
 * 2. Generate VoucherLayoutV2 for UI rendering
 * 3. User edits layout in UI
 * 4. On save: Apply changes to canonical VoucherTypeDefinition
 * 5. Save ONLY canonical VoucherTypeDefinition
 * 6. Discard VoucherLayoutV2
 * 
 * Voucher layout with 4-area structure:
 * 1. Header Area - Read-only metadata (status, voucher no, etc.)
 * 2. Body Area - Input fields (varies by voucher type)
 * 3. Lines Area - Transaction lines table or preview
 * 4. Actions Area - Buttons (Submit, Draft, Print, etc.)
 */

import { FieldDefinitionV2 } from './FieldDefinitionV2';

/**
 * Voucher Type
 */
export type VoucherTypeCode = 'PAYMENT' | 'RECEIPT' | 'JOURNAL_ENTRY' | 'OPENING_BALANCE';

/**
 * Display Mode
 */
export type DisplayMode = 'classic' | 'windows';

/**
 * Lines Area Type
 */
export type LinesAreaType = 
  | 'table'        // Multi-line table (Journal Entry, Opening Balance)
  | 'single-line'  // Auto-calculated single line (Payment, Receipt)
  | 'preview';     // Read-only posting preview

/**
 * Action Button Definition
 */
export interface ActionButton {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  icon?: string;
  action: 'submit' | 'saveDraft' | 'print' | 'export' | 'email' | 'custom';
  visible?: boolean;
  order?: number;
}

/**
 * Header Area Configuration
 * 
 * Contains read-only metadata fields that appear at the top.
 * Examples: Voucher Number, Status, Created Date, etc.
 */
export interface HeaderAreaConfig {
  /**
   * Fields to display in header
   */
  fields: FieldDefinitionV2[];
  
  /**
   * Is header locked from modifications?
   */
  locked: boolean;
  
  /**
   * Layout style for header
   */
  layout?: 'inline' | 'stacked';
}

/**
 * Body Area Configuration
 * 
 * Contains input fields for voucher data entry.
 * This is the main customizable area.
 */
export interface BodyAreaConfig {
  /**
   * Fields to display in body
   */
  fields: FieldDefinitionV2[];
  
  /**
   * Grid layout (how many columns)
   */
  columns: number;  // Typically 4
  
  /**
   * Gap between fields
   */
  gap?: number;  // In pixels or tailwind units
}

/**
 * Lines Area Configuration
 * 
 * Transaction lines table or preview.
 * Varies by voucher type.
 */
export interface LinesAreaConfig {
  /**
   * Type of lines area
   */
  type: LinesAreaType;
  
  /**
   * Columns for table mode
   */
  columns?: FieldDefinitionV2[];
  
  /**
   * Minimum number of lines (for validation)
   */
  minLines?: number;
  
  /**
   * Maximum number of lines
   */
  maxLines?: number;
  
  /**
   * Show running totals?
   */
  showTotals?: boolean;
  
  /**
   * Show add line button?
   */
  showAddButton?: boolean;
  
  /**
   * Preview template (for preview mode)
   * Example: "DR: {{expenseAccount}} {{amount}} | CR: {{cashAccount}} {{amount}}"
   */
  previewTemplate?: string;
}

/**
 * Actions Area Configuration
 * 
 * Bottom action buttons.
 */
export interface ActionsAreaConfig {
  /**
   * Buttons to display
   */
  buttons: ActionButton[];
  
  /**
   * Alignment
   */
  alignment?: 'left' | 'right' | 'center' | 'space-between';
}

/**
 * Complete Voucher Layout (4 Areas)
 * 
 * @deprecated for persistence
 * This is a VIEW MODEL ONLY. Never persist to database.
 */
export interface VoucherLayoutV2 {
  /**
   * PERSISTENCE MARKER - DO NOT REMOVE
   * This property prevents accidental persistence
   */
  readonly __DO_NOT_PERSIST__?: never;
  
  /**
   * Unique layout ID
   */
  id?: string;
  
  /**
   * Voucher type this layout is for
   */
  voucherType: VoucherTypeCode;
  
  /**
   * Display mode
   */
  mode: DisplayMode;
  
  /**
   * Is this a system default layout?
   */
  isDefault?: boolean;
  
  /**
   * Owner (for user-specific layouts)
   */
  userId?: string;
  
  /**
   * Company (for company-specific layouts)
   */
  companyId?: string;
  
  /**
   * Created/Updated timestamps
   */
  createdAt?: Date;
  updatedAt?: Date;
  
  // ═══════════════════════════════════════════════════════════
  // 4 AREAS
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Area 1: Header (Read-only metadata)
   */
  header: HeaderAreaConfig;
  
  /**
   * Area 2: Body (Input fields)
   */
  body: BodyAreaConfig;
  
  /**
   * Area 3: Lines (Transaction lines)
   */
  lines: LinesAreaConfig;
  
  /**
   * Area 4: Actions (Buttons)
   */
  actions: ActionsAreaConfig;
}

/**
 * Default header fields (same for all voucher types)
 */
export const DEFAULT_HEADER_FIELDS: FieldDefinitionV2[] = [
  // These are read-only display fields
  // Not part of CORE/SHARED/PERSONAL system (they're UI metadata)
];

/**
 * Default action buttons
 */
export const DEFAULT_ACTION_BUTTONS: ActionButton[] = [
  {
    id: 'cancel',
    label: 'Cancel',
    variant: 'secondary',
    action: 'custom',
    order: 1
  },
  {
    id: 'saveDraft',
    label: 'Save as Draft',
    variant: 'secondary',
    action: 'saveDraft',
    order: 2
  },
  {
    id: 'submit',
    label: 'Submit for Approval',
    variant: 'primary',
    action: 'submit',
    order: 3
  }
];

/**
 * Helper to create default layout structure
 */
export function createDefaultLayout(voucherType: VoucherTypeCode): VoucherLayoutV2 {
  return {
    voucherType,
    mode: 'windows',
    isDefault: true,
    
    header: {
      fields: [],
      locked: true,
      layout: 'inline'
    },
    
    body: {
      fields: [],
      columns: 4,
      gap: 6
    },
    
    lines: {
      type: voucherType === 'PAYMENT' || voucherType === 'RECEIPT' ? 'preview' : 'table',
      columns: [],
      minLines: 2,
      maxLines: 50,
      showTotals: true,
      showAddButton: true
    },
    
    actions: {
      buttons: DEFAULT_ACTION_BUTTONS,
      alignment: 'space-between'
    }
  };
}
