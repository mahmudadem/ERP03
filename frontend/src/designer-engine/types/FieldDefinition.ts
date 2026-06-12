/**
 * FieldDefinition.ts
 * Defines the structure of a single input field.
 * Schema Version 2: Includes explicit posting classification.
 */

import { PostingRole } from './PostingRole';
export type FieldClass = 'system_core' | 'system_optional' | 'computed' | 'custom_metadata';
export type FieldBindingTarget = 'payload' | 'metadata.customFields';

export type FieldType = 
  | 'TEXT' 
  | 'NUMBER' 
  | 'DATE' 
  | 'SELECT' 
  | 'CHECKBOX' 
  | 'TEXTAREA' 
  | 'RELATION' // For picking a Customer, Item, etc.
  | 'account-selector' // Custom business component
  | 'customer-account-selector' // Composite selector (party + account)
  | 'vendor-account-selector' // Composite selector (party + account)
  | 'party-selector' // New premium party selector
  | 'item-selector' // New item selector
  | 'warehouse-selector' // New warehouse selector
  | 'cost-center-selector' // Custom business component
  | 'currency-exchange' // Custom business component
  | 'settlement'; // Composite settlement control (Task 186) — host-fed reactive widget

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface FieldDefinition {
  id: string;
  name: string; // Key in the data object
  label: string;
  type: FieldType;
  fieldClass?: FieldClass;
  bindingTarget?: FieldBindingTarget;
  nameLocked?: boolean;
  computed?: boolean;
  
  // Posting Classification (Schema V2)
  isPosting: boolean;
  postingRole: PostingRole | null;
  schemaVersion?: number; // Default: 2
  
  // Layout & UI
  placeholder?: string;
  width?: 'full' | '1/2' | '1/3' | '1/4'; // Tailwind grid span
  readOnly?: boolean;
  hidden?: boolean;

  // Validation
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string; // Regex

  // Type specific
  options?: SelectOption[]; // For SELECT
  relationTarget?: string; // For RELATION (e.g., 'customers')
  // Visual Styles
  style?: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: 'normal' | 'bold' | '500';
    fontSize?: 'sm' | 'base' | 'lg' | 'xl';
    fontStyle?: 'normal' | 'italic';
    textAlign?: 'left' | 'center' | 'right';
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    padding?: string;
    borderWidth?: string;
    borderColor?: string;
    borderRadius?: string;
  };
    
  defaultValue?: any;
  validationRules?: any;
  visibilityRules?: any;

  /**
   * Host-supplied context for the composite `settlement` field type (Task 186).
   * The settlement control is a controlled widget that never reaches around the
   * page for the party / outstanding / payment configs — the host form resolves
   * them and feeds them in here. See the shared SettlementBlock contract
   * (planning/tasks/186-shared-settlement-panel-and-overpayment.md, Part C).
   */
  settlementContext?: {
    module?: 'sales' | 'purchases';
    partyAccountId?: string;
    partyAccountLabel?: string;
    outstandingBase?: number;
    paymentMethodConfigs?: { method: string; settlementAccountId: string; label?: string; isEnabled?: boolean }[];
    allowOverpayment?: boolean;
    currencyCode?: string;
  };
}
