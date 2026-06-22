export type PrintDocumentType =
  | 'POS_RECEIPT'
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'ACCOUNTING_VOUCHER'
  | (string & {});

export type PrintPaperUnit = 'mm' | 'px';

export interface PrintPaperProfile {
  type: 'A4' | 'A5' | 'RECEIPT_80' | 'RECEIPT_58' | 'CUSTOM';
  width: number;
  height: number;
  unit: PrintPaperUnit;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  orientation?: 'portrait' | 'landscape';
}

export interface PrintLayoutStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface PrintLayoutTableOptions {
  headerBackgroundColor?: string;
  headerTextColor?: string;
  rowHeight?: number;
  overflowMode?: 'continue' | 'clip' | 'shrink';
  repeatHeaderOnPageBreak?: boolean;
  maxPreviewRows?: number;
}

export interface PrintLayoutComponent {
  id: string;
  type: 'text' | 'field' | 'table' | 'image' | 'line' | 'box' | 'barcode' | 'qr';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  value?: string;
  fieldPath?: string;
  tablePath?: string;
  tableOptions?: PrintLayoutTableOptions;
  columns?: Array<{
    id: string;
    label: string;
    fieldPath: string;
    width: number;
    style?: PrintLayoutStyle;
  }>;
  style?: PrintLayoutStyle;
}

export interface PrintLayoutSchema {
  version: 1;
  paper: PrintPaperProfile;
  components: PrintLayoutComponent[];
}

export interface PrintDataFieldSchema {
  path: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'money' | 'boolean';
  required?: boolean;
}

export interface PrintDataTableSchema {
  path: string;
  label: string;
  columns: PrintDataFieldSchema[];
}

export interface PrintDataSchema {
  documentType: PrintDocumentType;
  fields: PrintDataFieldSchema[];
  tables: PrintDataTableSchema[];
  requiredFields: string[];
}

export interface IPrintLayoutCore {
  validateLayout(layout: PrintLayoutSchema, dataSchema?: PrintDataSchema): void;
  getDataSchema(documentType: PrintDocumentType): PrintDataSchema;
  createDefaultLayout(documentType: PrintDocumentType): PrintLayoutSchema;
}
