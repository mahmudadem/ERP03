/**
 * FieldDefinitionV2.ts
 * 
 * Extended field definition with CORE/SHARED/PERSONAL category system.
 * Enforces ADR-005 auditable accounting rules.
 * 
 * RULES:
 * - CORE fields: Required by backend, cannot remove/hide
 * - SHARED fields: Optional, system-defined, can show/hide
 * - PERSONAL fields: UI-only, per-user, fully isolated
 */

import { FieldType, FieldDefinition } from '../../../../designer-engine/types/FieldDefinition';

/**
 * Field Category Classification
 */
export type FieldCategory = 'CORE' | 'SHARED' | 'PERSONAL';

/**
 * Storage Location
 */
export type StorageLocation = 'voucher' | 'userPreferences';

/**
 * Extended Field Definition with Category System
 * 
 * Extends the base FieldDefinition with enforcement rules.
 */
export interface FieldDefinitionV2 extends FieldDefinition {
  // ═══════════════════════════════════════════════════════════
  // CATEGORY CLASSIFICATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Field category determines enforcement rules
   */
  category: FieldCategory;
  
  // ═══════════════════════════════════════════════════════════
  // BACKEND BINDING (Immutable for CORE/SHARED)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Key in voucher data object (e.g., 'amount', 'date')
   * IMMUTABLE for CORE/SHARED fields
   */
  dataKey: string;
  
  /**
   * Semantic meaning of the field
   * Documents what this field represents in accounting
   */
  semanticMeaning: string;
  
  // ═══════════════════════════════════════════════════════════
  // ENFORCEMENT RULES (Derived from category)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Can this field be removed from the voucher?
   * - CORE: false (required by backend)
   * - SHARED: false (system-defined)
   * - PERSONAL: true (user can add/remove)
   */
  canRemove: boolean;
  
  /**
   * Can this field be hidden from the UI?
   * - CORE: false (always visible)
   * - SHARED: true (can hide from user's view)
   * - PERSONAL: true (can hide)
   */
  canHide: boolean;
  
  /**
   * Can the display label be renamed?
   * - ALL: true (label is UI-only)
   */
  canRenameLabel: boolean;
  
  /**
   * Can the data key be changed?
   * - CORE: false (backend contract)
   * - SHARED: false (backend contract)
   * - PERSONAL: true (UI-only)
   */
  canChangeDataKey: boolean;
  
  /**
   * Can the field type be changed?
   * - CORE: false (backend expects specific type)
   * - SHARED: false (backend expects specific type)
   * - PERSONAL: true (UI-only)
   */
  canChangeType: boolean;
  
  // ═══════════════════════════════════════════════════════════
  // STORAGE LOCATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Where is this field's data stored?
   * - voucher: In voucher document (CORE/SHARED)
   * - userPreferences: In user's preferences (PERSONAL)
   */
  storedIn: StorageLocation;
  
  // ═══════════════════════════════════════════════════════════
  // VISIBILITY & EXPORT
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Show in General Journal view?
   * - CORE/SHARED: true
   * - PERSONAL: false
   */
  showInJournal: boolean;
  
  /**
   * Show in accounting reports?
   * - CORE/SHARED: true
   * - PERSONAL: false
   */
  showInReports: boolean;
  
  /**
   * Include in search/filters?
   * - CORE/SHARED: true
   * - PERSONAL: false
   */
  showInSearch: boolean;
  
  /**
   * Allow export (Excel, PDF)?
   * - CORE/SHARED: true
   * - PERSONAL: false
   */
  allowExport: boolean;
  
  /**
   * Visible to management/other users?
   * - CORE/SHARED: true
   * - PERSONAL: false
   */
  visibleToManagement: boolean;
  
  // ═══════════════════════════════════════════════════════════
  // USER CUSTOMIZATION (What user CAN change)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * User's custom visibility override
   * Only applies to SHARED/PERSONAL fields
   */
  visible?: boolean;
  
  /**
   * User's custom order in layout
   */
  order?: number;
}

/**
 * Helper function to create a CORE field definition
 */
export function createCoreField(config: {
  id: string;
  dataKey: string;
  label: string;
  type: FieldType;
  semanticMeaning: string;
  required?: boolean;
  width?: FieldDefinition['width'];
}): FieldDefinitionV2 {
  return {
    id: config.id,
    name: config.dataKey,
    dataKey: config.dataKey,
    label: config.label,
    type: config.type,
    semanticMeaning: config.semanticMeaning,
    
    // Category
    category: 'CORE',
    
    // Enforcement
    canRemove: false,
    canHide: false,
    canRenameLabel: true,      // Can rename label (UI only)
    canChangeDataKey: false,
    canChangeType: false,
    
    // Storage
    storedIn: 'voucher',
    
    // Visibility
    showInJournal: true,
    showInReports: true,
    showInSearch: true,
    allowExport: true,
    visibleToManagement: true,
    
    // Layout
    required: config.required ?? true,
    width: config.width ?? '1/2',
    readOnly: false,
    hidden: false
  };
}

/**
 * Helper function to create a SHARED field definition
 */
export function createSharedField(config: {
  id: string;
  dataKey: string;
  label: string;
  type: FieldType;
  semanticMeaning: string;
  required?: boolean;
  width?: FieldDefinition['width'];
}): FieldDefinitionV2 {
  return {
    id: config.id,
    name: config.dataKey,
    dataKey: config.dataKey,
    label: config.label,
    type: config.type,
    semanticMeaning: config.semanticMeaning,
    
    // Category
    category: 'SHARED',
    
    // Enforcement
    canRemove: false,          // Cannot remove from schema
    canHide: true,             // Can hide from user's view
    canRenameLabel: true,
    canChangeDataKey: false,
    canChangeType: false,
    
    // Storage
    storedIn: 'voucher',
    
    // Visibility
    showInJournal: true,
    showInReports: true,
    showInSearch: true,
    allowExport: true,
    visibleToManagement: true,
    
    // Layout
    required: config.required ?? false,
    width: config.width ?? '1/2',
    readOnly: false,
    hidden: false
  };
}

/**
 * Helper function to create a PERSONAL field definition
 */
export function createPersonalField(config: {
  id: string;
  label: string;
  type: FieldType;
  width?: FieldDefinition['width'];
}): FieldDefinitionV2 {
  return {
    id: config.id,
    name: config.id,           // Personal fields use ID as name
    dataKey: config.id,
    label: config.label,
    type: config.type,
    semanticMeaning: 'Personal user annotation',
    
    // Category
    category: 'PERSONAL',
    
    // Enforcement
    canRemove: true,           // Can add/remove freely
    canHide: true,
    canRenameLabel: true,
    canChangeDataKey: true,    // UI-only field
    canChangeType: true,
    
    // Storage
    storedIn: 'userPreferences',
    
    // Visibility (ISOLATED from all shared views)
    showInJournal: false,
    showInReports: false,
    showInSearch: false,
    allowExport: false,
    visibleToManagement: false,
    
    // Layout
    required: false,
    width: config.width ?? 'full',
    readOnly: false,
    hidden: false
  };
}
