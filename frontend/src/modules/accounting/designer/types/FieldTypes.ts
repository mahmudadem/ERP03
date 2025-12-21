/**
 * Field Categories for Voucher Designer
 */

export type FieldCategory = 'CORE' | 'SHARED' | 'SYSTEM';

export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'TEXTAREA' | 'RELATION';
  category: FieldCategory;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  width?: 'full' | '1/2' | '1/4';
  gridRow?: number;
  gridColumn?: number;  // 1-12
  gridColumnSpan?: number;  // 1-12
  style?: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
    fontStyle?: string;
    fontSize?: string;
    textAlign?: string;
    textTransform?: string;
    padding?: string;
    borderWidth?: string;
    borderColor?: string;
    borderRadius?: string;
  };
}

export interface VoucherLayoutDefinition {
  voucherTypeCode: string;
  systemFields: string[];    // Selected SYSTEM field IDs
  headerFields: FieldDefinition[];  // CORE + selected SHARED fields
  lineColumns: LineColumn[];
  extraFields: string[];     // Additional SHARED fields for extra section
}

export interface LineColumn {
  id: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'ACCOUNT' | 'TEXTAREA';
  width?: string;
  required?: boolean;
}
