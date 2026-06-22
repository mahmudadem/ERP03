import client from './client';

export type PrintDocumentType = 'POS_RECEIPT' | 'SALES_INVOICE' | 'SALES_RETURN' | 'PURCHASE_INVOICE' | 'PURCHASE_RETURN' | 'ACCOUNTING_VOUCHER' | string;

export interface PrintPaperProfile {
  type: 'A4' | 'A5' | 'RECEIPT_80' | 'RECEIPT_58' | 'CUSTOM';
  width: number;
  height: number;
  unit: 'mm' | 'px';
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
  columns?: Array<{ id: string; label: string; fieldPath: string; width: number; style?: PrintLayoutStyle }>;
  style?: PrintLayoutStyle;
}

export interface PrintLayoutSchema {
  version: 1;
  paper: PrintPaperProfile;
  components: PrintLayoutComponent[];
}

export interface PrintDataSchema {
  documentType: PrintDocumentType;
  fields: Array<{ path: string; label: string; type: string; required?: boolean }>;
  tables: Array<{ path: string; label: string; columns: Array<{ path: string; label: string; type: string; required?: boolean }> }>;
  requiredFields: string[];
}

export interface PrintLayoutTemplateDTO {
  id: string;
  companyId: string;
  name: string;
  documentType: PrintDocumentType;
  layout: PrintLayoutSchema;
  isDefault: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

const unwrap = <T>(response: any): T => response?.data?.data ?? response?.data ?? response;

export const printLayoutApi = {
  schema: async (documentType: PrintDocumentType): Promise<PrintDataSchema> =>
    unwrap(await client.get(`/tenant/print-layouts/schemas/${documentType}`)),

  list: async (documentType?: PrintDocumentType): Promise<PrintLayoutTemplateDTO[]> =>
    unwrap(await client.get('/tenant/print-layouts/templates', { params: { documentType } })),

  createDefault: async (documentType: PrintDocumentType): Promise<PrintLayoutTemplateDTO> =>
    unwrap(await client.post('/tenant/print-layouts/templates/default', { documentType })),

  save: async (payload: {
    id?: string;
    name: string;
    documentType: PrintDocumentType;
    layout: PrintLayoutSchema;
    isDefault?: boolean;
  }): Promise<PrintLayoutTemplateDTO> => {
    if (payload.id) return unwrap(await client.put(`/tenant/print-layouts/templates/${payload.id}`, payload));
    return unwrap(await client.post('/tenant/print-layouts/templates', payload));
  },

  remove: async (id: string): Promise<void> => {
    await client.delete(`/tenant/print-layouts/templates/${id}`);
  },
};
