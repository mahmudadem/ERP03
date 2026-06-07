/**
 * Super-admin Field Library API client.
 *
 * Phase B of task 135 — authoring endpoints for the Layer 1 field
 * catalog. Calls land under `/super-admin/field-library`, which is
 * gated by `assertSuperAdmin` on the backend.
 */
import { client } from '../client';

export type FieldClass =
  | 'system_core'
  | 'system_optional'
  | 'computed'
  | 'custom_metadata';

export type FieldSectionHint = 'HEADER' | 'BODY' | 'EXTRA' | 'FOOTER' | 'ACTIONS';

export interface SelectorBinding {
  collection: string;
  displayField: string;
  valueField?: string;
  filters?: Record<string, any>;
}

export interface FieldLibraryEntry {
  id: string;
  label: string;
  type: string;
  fieldClass: FieldClass;
  sectionHint?: FieldSectionHint;
  alwaysMandatory?: boolean;
  alwaysShared?: boolean;
  supportedTypes?: string[];
  excludedTypes?: string[];
  selectorBinding?: SelectorBinding;
  version: number;
  deprecated?: boolean;
  scope?: 'system' | 'company';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

const BASE = '/super-admin/field-library';

/**
 * The shared `client.get`/`client.post` helpers return the parsed JSON
 * payload directly. The backend wraps every response in
 * `{ success, data }`, so we unwrap `.data` here to keep the rest of
 * the codebase ergonomic.
 */
const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

export const superAdminFieldLibraryApi = {
  list: async (): Promise<FieldLibraryEntry[]> => {
    const res = await client.get(BASE);
    const data = unwrap<{ entries: FieldLibraryEntry[] }>(res);
    return data.entries || [];
  },

  getOne: async (id: string): Promise<FieldLibraryEntry> => {
    const res = await client.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap<FieldLibraryEntry>(res);
  },

  create: async (input: Partial<FieldLibraryEntry>): Promise<FieldLibraryEntry> => {
    const res = await client.post(BASE, input);
    return unwrap<FieldLibraryEntry>(res);
  },

  update: async (id: string, patch: Partial<FieldLibraryEntry>): Promise<FieldLibraryEntry> => {
    const res = await client.put(`${BASE}/${encodeURIComponent(id)}`, patch);
    return unwrap<FieldLibraryEntry>(res);
  },

  setDeprecated: async (id: string, deprecated: boolean): Promise<FieldLibraryEntry> => {
    const res = await client.patch(`${BASE}/${encodeURIComponent(id)}/deprecated`, { deprecated });
    return unwrap<FieldLibraryEntry>(res);
  },

  /**
   * Hard delete. Returns void on success.
   * On 409 (referenced by a voucher type), the backend includes
   * `error.response.data.usedBy` — the caller should surface that
   * list in the UI instead of suggesting the admin deprecate.
   */
  delete: async (id: string): Promise<void> => {
    await client.delete(`${BASE}/${encodeURIComponent(id)}`);
  },
};
