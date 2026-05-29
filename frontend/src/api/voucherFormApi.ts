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
  numberFormat?: string;
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
  formType?: string; // Form type (new field, replaces baseType)
  voucherType?: string; // Canonical business document type (e.g., sales_invoice)
  persona?: string; // Document persona (direct, linked, service)
  baseType?: string; // Base voucher type for backend (legacy, kept for backward compat)
  module?: string; // Module this form belongs to (ACCOUNTING, SALES, PURCHASE)
  sidebarGroup?: string; // Sidebar submenu group (Vouchers, Documents, etc.)
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type VoucherFormModule = 'ACCOUNTING' | 'SALES' | 'PURCHASE';

/**
 * Map the module enum to the URL prefix for its voucher-form routes.
 * Write endpoints (create / update / delete / clone) are registered on each
 * module's route file so the request is scoped to the module the user is
 * working in and is authorized by that module's middleware chain.
 *
 * Read endpoints (list / getById / getByType) currently only exist under
 * accounting, but they're module-agnostic at the controller level (the
 * repository searches across modules), so we keep them on the accounting
 * URL until we need module scoping on reads.
 */
const writePrefix = (module: VoucherFormModule): string => {
  switch (module) {
    case 'SALES':
      return '/tenant/sales';
    case 'PURCHASE':
      return '/tenant/purchases';
    case 'ACCOUNTING':
    default:
      return '/tenant/accounting';
  }
};

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
   * Create a new form. Pass the module so the request is scoped to the
   * correct per-module route (sales / purchases / accounting).
   */
  create: async (form: Partial<VoucherFormResponse>, module: VoucherFormModule = 'ACCOUNTING'): Promise<VoucherFormResponse> => {
    const response = await client.post(`${writePrefix(module)}/voucher-forms`, form);
    return response.data || response;
  },

  /**
   * Update a form. Pass the module so the request is scoped to the correct
   * per-module route. The repository searches across modules to locate the
   * form by id, so passing the wrong module still works but bypasses the
   * intended permission scope.
   */
  update: async (id: string, updates: Partial<VoucherFormResponse>, module: VoucherFormModule = 'ACCOUNTING'): Promise<VoucherFormResponse> => {
    const response = await client.put(`${writePrefix(module)}/voucher-forms/${id}`, updates);
    return response.data || response;
  },

  /**
   * Delete a form. Module determines which module's route handles it.
   */
  delete: async (id: string, module: VoucherFormModule = 'ACCOUNTING'): Promise<void> => {
    await client.delete(`${writePrefix(module)}/voucher-forms/${id}`);
  },

  /**
   * Clone a form. Module determines which module's route handles it.
   */
  clone: async (id: string, newName?: string, newCode?: string, module: VoucherFormModule = 'ACCOUNTING'): Promise<VoucherFormResponse> => {
    const response = await client.post(`${writePrefix(module)}/voucher-forms/${id}/clone`, {
      newName,
      newCode,
    });
    return response.data || response;
  },
};
