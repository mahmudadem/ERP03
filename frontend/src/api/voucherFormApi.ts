/**
 * voucherFormApi.ts
 * 
 * API client for VoucherForms (UI layouts)
 */
import client from './client';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';

export interface VoucherFormResponse {
  id: string;
  companyId: string;
  typeId: string;
  name: string;
  code: string;
  description?: string;
  prefix?: string;
  isDefault: boolean;
  isSystemGenerated: boolean;
  isLocked: boolean;
  enabled: boolean;
  headerFields: any[];
  tableColumns: any[];
  layout?: any;
  uiModeOverrides?: any; // Layout data for different UI modes
  rules?: any[]; // Validation rules
  actions?: any[]; // Action buttons configuration
  isMultiLine?: boolean;
  tableStyle?: 'web' | 'classic';
  defaultCurrency?: string;
  baseType?: string; // Base voucher type for backend
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export const voucherFormApi = {
  /**
   * List all voucher forms for the current company
   */
  list: async (): Promise<VoucherFormResponse[]> => {
    const response = await client.get('/tenant/accounting/voucher-forms');
    return response.data || response;
  },

  /**
   * Get a form by ID
   */
  getById: async (id: string): Promise<VoucherFormResponse> => {
    const response = await client.get(`/tenant/accounting/voucher-forms/${id}`);
    return response.data || response;
  },

  /**
   * Get forms by type ID
   */
  getByType: async (typeId: string): Promise<VoucherFormResponse[]> => {
    const response = await client.get(`/tenant/accounting/voucher-forms/by-type/${typeId}`);
    return response.data || response;
  },

  /**
   * Create a new form
   */
  create: async (form: Partial<VoucherFormResponse>): Promise<VoucherFormResponse> => {
    const response = await client.post('/tenant/accounting/voucher-forms', form);
    return response.data || response;
  },

  /**
   * Update a form
   */
  update: async (id: string, updates: Partial<VoucherFormResponse>): Promise<VoucherFormResponse> => {
    const response = await client.put(`/tenant/accounting/voucher-forms/${id}`, updates);
    return response.data || response;
  },

  /**
   * Delete a form
   */
  delete: async (id: string): Promise<void> => {
    await client.delete(`/tenant/accounting/voucher-forms/${id}`);
  },

  /**
   * Clone a form
   */
  clone: async (id: string, newName?: string, newCode?: string): Promise<VoucherFormResponse> => {
    const response = await client.post(`/tenant/accounting/voucher-forms/${id}/clone`, {
      newName,
      newCode
    });
    return response.data || response;
  }
};
