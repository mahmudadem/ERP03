/**
 * Tenant Field Library API client.
 *
 * Reads the resolved Layer 1 field catalog visible to the active company.
 * Authoring stays in the super-admin client; this client is consumption-only.
 */
import client from './client';

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
}

export interface ResolvedFieldLibrary {
  entries: FieldLibraryEntry[];
  headerEligible: FieldLibraryEntry[];
  lineEligible: FieldLibraryEntry[];
}

const unwrap = <T,>(payload: any): T => (payload?.data?.data ?? payload?.data ?? payload) as T;

export const fieldLibraryApi = {
  list: async (options: { includeDeprecated?: boolean } = {}): Promise<ResolvedFieldLibrary> => {
    const res = await client.get('/tenant/designer/field-library', {
      params: options.includeDeprecated ? { includeDeprecated: 1 } : undefined,
    });
    return unwrap<ResolvedFieldLibrary>(res);
  },
};
