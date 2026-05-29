/**
 * voucherTypeManagementApi.ts
 *
 * Client for the per-module "Manage Voucher Types" settings page.
 *
 * Backed by VoucherTypeInstallController on the backend. Used to list the
 * system catalog of voucher types for a module (flagged with installed
 * status per company) and to install additional types post-init.
 */
import client from './client';

export type VoucherTypeModule = 'ACCOUNTING' | 'SALES' | 'PURCHASE';

/**
 * Maps the module enum to the per-module URL prefix on the backend.
 * Backend module IDs are singular ('sales', 'purchase', 'accounting');
 * mounting at /tenant/purchases (plural) lands on the 404 catch-all.
 */
const moduleUrlPrefix: Record<VoucherTypeModule, string> = {
  ACCOUNTING: '/tenant/accounting',
  SALES: '/tenant/sales',
  PURCHASE: '/tenant/purchase',
};

export interface CatalogTemplate {
  id: string;
  name: string;
  code: string;
  module: string;
  voucherType: string;
  persona?: string | null;
  sidebarGroup?: string | null;
  isInstalled: boolean;
}

export interface VoucherTypeCatalogResponse {
  module: string;
  available: CatalogTemplate[];
}

export interface InstallResult {
  templatesUpserted: number;
  formsCreated: number;
  formsUpdated: number;
}

const unwrap = <T,>(payload: any): T => (payload?.data?.data ?? payload?.data ?? payload) as T;

export const voucherTypeManagementApi = {
  /**
   * List available system templates for a module plus an `isInstalled` flag
   * indicating which the company already has. The frontend groups these by
   * canonical `voucherType` to present type-level cards.
   */
  async catalog(module: VoucherTypeModule): Promise<VoucherTypeCatalogResponse> {
    const res = await client.get(`${moduleUrlPrefix[module]}/voucher-types/catalog`);
    return unwrap<VoucherTypeCatalogResponse>(res);
  },

  /**
   * Install (copy) one or more system templates into the company catalog.
   * Pass template IDs (not type keys) so the wizard's existing payload
   * shape works unchanged. Idempotent — already-installed templates are
   * left alone. Newly copied forms install as locked + inactive.
   */
  async install(module: VoucherTypeModule, templateIds: string[]): Promise<InstallResult> {
    const res = await client.post(
      `${moduleUrlPrefix[module]}/voucher-types/install`,
      { selectedVoucherTypes: templateIds },
    );
    return unwrap<InstallResult>(res);
  },
};
