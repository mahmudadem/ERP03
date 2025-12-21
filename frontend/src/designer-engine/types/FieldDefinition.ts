/**
 * FieldDefinition.ts
 * Defines the structure of a single input field.
 * Schema Version 2: Includes explicit posting classification.
 */

import { PostingRole } from './PostingRole';

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
}
