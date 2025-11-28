/**
 * FieldDefinition.ts
 * Defines the structure of a single input field.
 */

export type FieldType = 
  | 'TEXT' 
  | 'NUMBER' 
  | 'DATE' 
  | 'SELECT' 
  | 'CHECKBOX' 
  | 'TEXTAREA' 
  | 'RELATION'; // For picking a Customer, Item, etc.

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface FieldDefinition {
  id: string;
  name: string; // Key in the data object
  label: string;
  type: FieldType;
  
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
  defaultValue?: any;
}
