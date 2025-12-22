/**
 * IVoucherFormRepository.ts
 * 
 * Repository interface for VoucherForms (UI layouts)
 * 
 * VoucherForms define HOW a voucher is rendered (layout, fields, colors)
 * They are linked to VoucherTypes via typeId
 * 
 * Storage: companies/{companyId}/voucherForms/{formId}
 */

export interface VoucherFormDefinition {
  id: string;                    // Unique form ID
  companyId: string;             // Company that owns this form
  typeId: string;                // Links to VoucherType (backend type)
  
  // Metadata
  name: string;                  // Display name (e.g., "Vendor Payment Form")
  code: string;                  // Short code (e.g., "VENDOR_PAY")
  description?: string;
  prefix?: string;               // Voucher number prefix (e.g., "VP")
  
  // Flags
  isDefault: boolean;            // Is this the default form for the type?
  isSystemGenerated: boolean;    // Was this auto-created during init?
  isLocked: boolean;             // Cannot be edited (system defaults)
  enabled: boolean;              // Is form available for use?
  
  // UI Layout
  headerFields: FormField[];     // Header section fields
  tableColumns: TableColumn[];   // Line items columns
  layout?: {
    theme?: string;
    primaryColor?: string;
    showTotals?: boolean;
    [key: string]: any;
  };
  
  // Advanced Layout (from Designer)
  uiModeOverrides?: any;         // Layout data for different UI modes (windows, classic)
  rules?: any[];                 // Validation rules
  actions?: any[];               // Action buttons configuration
  isMultiLine?: boolean;         // Does this voucher support line items?
  defaultCurrency?: string;      // Default currency
  baseType?: string;             // Base voucher type for backend compatibility
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency' | 'textarea' | 'checkbox';
  required?: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  width?: string;
  order: number;
}

export interface TableColumn {
  id: string;
  label: string;
  type: 'account' | 'text' | 'number' | 'currency' | 'select';
  required?: boolean;
  width?: string;
  order: number;
}

export interface IVoucherFormRepository {
  // Create
  create(form: VoucherFormDefinition): Promise<VoucherFormDefinition>;
  
  // Read
  getById(companyId: string, formId: string): Promise<VoucherFormDefinition | null>;
  getByTypeId(companyId: string, typeId: string): Promise<VoucherFormDefinition[]>;
  getDefaultForType(companyId: string, typeId: string): Promise<VoucherFormDefinition | null>;
  getAllByCompany(companyId: string): Promise<VoucherFormDefinition[]>;
  
  // Update
  update(companyId: string, formId: string, updates: Partial<VoucherFormDefinition>): Promise<void>;
  
  // Delete
  delete(companyId: string, formId: string): Promise<void>;
}
