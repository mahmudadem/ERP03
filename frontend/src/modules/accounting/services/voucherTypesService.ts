/**
 * Load system voucher types from Firestore
 *
 * Data model note: each document in system_metadata/voucher_types/items is a
 * voucher *template* that conflates two concepts:
 *  - the canonical Voucher Type (carried by `voucherType` field, e.g. "purchase_invoice")
 *  - one default Form variant of that type (carried by `code` + `persona` fields,
 *    e.g. code="purchase_invoice_direct", persona="direct")
 *
 * `loadSystemVoucherTypes` returns the flat template list.
 * `loadSystemVoucherTypeGroups` groups templates by canonical type so the
 * init wizards can present types (with their form variants as metadata)
 * instead of forms-pretending-to-be-types.
 */
import { db } from '../../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

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

const normalizeModule = (module?: string) =>
  String(module || '').trim().toUpperCase();

const inferVoucherModule = (data: Record<string, any>, id: string): string => {
  const explicitModule = normalizeModule(data.module);
  if (explicitModule) return explicitModule;

  const token = [id, data.id, data.code, data.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(sales[_\s-]*(order|invoice|return)|delivery[_\s-]*note)/.test(token)) {
    return 'SALES';
  }

  if (/(purchase[_\s-]*(order|invoice|return)|goods[_\s-]*receipt)/.test(token)) {
    return 'PURCHASE';
  }

  if (/(journal[_\s-]*entry|payment|receipt|opening[_\s-]*balance|fx[_\s-]*revaluation)/.test(token)) {
    return 'ACCOUNTING';
  }

  return '';
};

export async function loadSystemVoucherTypes(moduleFilter?: string): Promise<SystemVoucherType[]> {
  try {
    const vouchersRef = collection(db, 'system_metadata', 'voucher_types', 'items');
    const snapshot = await getDocs(vouchersRef);
    const normalizedModuleFilter = moduleFilter ? normalizeModule(moduleFilter) : null;
    
    let vouchers: SystemVoucherType[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const module = inferVoucherModule(data, doc.id);

      vouchers.push({
        id: doc.id,
        name: data.name || doc.id,
        code: data.code || doc.id.toUpperCase(),
        prefix: data.prefix || '',
        module,
        voucherType: data.voucherType || data.code || doc.id,
        persona: data.persona || undefined,
        description: data.description,
        schemaVersion: data.schemaVersion || 2,
        isRecommended: data.isRecommended || false,
      });
    });

    if (normalizedModuleFilter) {
      vouchers = vouchers.filter(v => v.module === normalizedModuleFilter);
    }

    return vouchers;
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
