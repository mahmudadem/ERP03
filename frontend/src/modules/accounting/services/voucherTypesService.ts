/**
 * Load system voucher types from the backend API (DB-agnostic).
 *
 * Previously this read `system_metadata/voucher_types/items` directly from
 * Firestore, which meant it returned nothing in SQL mode (empty init wizards →
 * companies created with 0 voucher types). It now goes through
 * `voucherTypeManagementApi.catalog(module)` → `/tenant/<module>/voucher-types/catalog`,
 * which resolves the system templates through the DI container and therefore
 * works on BOTH Postgres and Firestore.
 *
 * Data model note: each catalog template conflates two concepts:
 *  - the canonical Voucher Type (carried by `voucherType`, e.g. "purchase_invoice")
 *  - one default Form variant of that type (carried by `code` + `persona`).
 *
 * `loadSystemVoucherTypes` returns the flat template list.
 * `loadSystemVoucherTypeGroups` groups templates by canonical type so the
 * init wizards can present types (with their form variants as metadata)
 * instead of forms-pretending-to-be-types.
 */
import i18n from '../../../i18n/config';
import { resolveVoucherDisplayName } from '../../../utils/voucherDisplayName';
import { voucherTypeManagementApi, VoucherTypeModule } from '../../../api/voucherTypeManagementApi';

export interface SystemVoucherType {
  id: string;
  name: string;
  code: string;
  prefix: string;
  module: string;
  voucherType: string;       // canonical type id (e.g., "purchase_invoice")
  persona?: string;          // form variant label (e.g., "direct", "linked", "service")
  description?: string;
  schemaVersion: number;
  isRecommended?: boolean;
}

export interface SystemVoucherTypeGroup {
  /** Canonical type key (the `voucherType` field shared by every form variant). */
  typeKey: string;
  /** Display name with persona suffix stripped (e.g. "Purchase Invoice"). */
  name: string;
  module: string;
  /** All template documents (form variants) that belong to this type. */
  forms: SystemVoucherType[];
  /** True when any form variant is flagged isRecommended. */
  isRecommended: boolean;
}

const normalizeModule = (module?: string) => {
  const normalized = String(module || '').trim().toUpperCase();
  if (normalized === 'PURCHASES') return 'PURCHASE';
  if (normalized === 'SALES_MODULE') return 'SALES';
  return normalized;
};

const CATALOG_MODULES: VoucherTypeModule[] = ['ACCOUNTING', 'SALES', 'PURCHASE'];

const isCatalogModule = (m: string): m is VoucherTypeModule =>
  (CATALOG_MODULES as string[]).includes(m);

export async function loadSystemVoucherTypes(moduleFilter?: string): Promise<SystemVoucherType[]> {
  const normalizedModuleFilter = moduleFilter ? normalizeModule(moduleFilter) : null;

  // The catalog endpoint is per-module. When no module is given, merge all three
  // (mirrors the old "load everything then filter" behaviour).
  if (!normalizedModuleFilter) {
    const perModule = await Promise.all(CATALOG_MODULES.map((m) => loadSystemVoucherTypes(m)));
    return perModule.flat();
  }

  if (!isCatalogModule(normalizedModuleFilter)) {
    console.warn(`[voucherTypesService] Unknown module "${moduleFilter}" — no system catalog to load.`);
    return [];
  }

  try {
    const { available } = await voucherTypeManagementApi.catalog(normalizedModuleFilter);
    return (available || []).map((t) => {
      const code = t.code || t.id.toUpperCase();
      return {
        id: t.id,
        name: resolveVoucherDisplayName(i18n.t.bind(i18n), {
          name: t.name || t.id,
          code,
          voucherType: t.voucherType,
          isSystemGenerated: true,
        }),
        code,
        prefix: '',
        module: normalizeModule(t.module) || normalizedModuleFilter,
        voucherType: t.voucherType || code,
        persona: t.persona || undefined,
        description: undefined,
        schemaVersion: 2,
        isRecommended: false,
      } as SystemVoucherType;
    });
  } catch (error) {
    console.error('Failed to load system voucher types:', error);
    return [];
  }
}

/**
 * Strip a trailing parenthetical from a form name so the canonical type name
 * remains. Examples:
 *   "Purchase Invoice (Direct)" -> "Purchase Invoice"
 *   "Delivery Note"             -> "Delivery Note"
 * If stripping would leave an empty string, the original is preserved.
 */
const stripPersonaSuffix = (formName: string): string => {
  const stripped = formName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || formName;
};

/**
 * Load system voucher TYPES grouped by canonical `voucherType` key.
 *
 * Each returned group represents one abstract voucher type and carries the
 * set of default form variants bundled with it. The init wizards render
 * one card per group so the user picks types (not forms); selecting a
 * type installs all its variants as locked, inactive default templates.
 */
export async function loadSystemVoucherTypeGroups(
  moduleFilter?: string,
): Promise<SystemVoucherTypeGroup[]> {
  const flat = await loadSystemVoucherTypes(moduleFilter);

  const byType = new Map<string, SystemVoucherType[]>();
  for (const tpl of flat) {
    const key = tpl.voucherType || tpl.code;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(tpl);
  }

  const groups: SystemVoucherTypeGroup[] = [];
  byType.forEach((forms, typeKey) => {
    // Display name: when the type has a single form, the form name IS the
    // type name. When it has multiple variants (Direct/Linked/Service),
    // strip the parenthetical suffix to recover the canonical label.
    const baseName = forms.length === 1
      ? forms[0].name
      : stripPersonaSuffix(forms[0].name);

    groups.push({
      typeKey,
      name: baseName,
      module: forms[0].module,
      forms,
      isRecommended: forms.some(f => f.isRecommended),
    });
  });

  // Sort by name for stable display ordering across renders.
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}
