/**
 * Purchase-line price resolver
 *
 * Shared service used by every purchase document entry surface (native pages and
 * Forms Designer–rendered forms) so a vendor + item combination yields the
 * same auto-filled unit price everywhere.
 *
 * Sourcing rule mirrors `GetEffectivePurchasePriceUseCase` on the backend.
 *
 * Returns null on any error/miss; pricing lookup failures are non-fatal —
 * callers should leave the existing unit price as-is.
 */

import { purchasesApi, EffectivePurchasePriceDTO } from '../../../api/purchasesApi';

const PURCHASE_DOC_TOKENS = [
  'purchase_invoice',
  'purchase_order',
  'purchase_return',
  'goods_receipt',
  'po',
  'pi',
  'grn',
];

const normalize = (value: any): string =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/**
 * True when the form definition describes any purchase document that has
 * vendor-priced line items.
 */
export function isPurchaseDocumentDefinition(definition: any): boolean {
  if (!definition) return false;
  const candidates = [
    definition.voucherType,
    definition.baseType,
    definition.formType,
    definition.code,
    definition.module,
    definition.persona,
  ].map(normalize);

  return PURCHASE_DOC_TOKENS.some((token) =>
    candidates.some((c) => c && c.includes(token))
  );
}

export interface ResolvePurchaseLinePriceArgs {
  vendorId: string;
  itemId: string;
  qty?: number;
  asOfDate?: string;
  currency?: string;
  exchangeRate?: number;
  uomId?: string;
  uom?: string;
}

/**
 * Fetch the effective unit price for one purchase line. Returns null when no
 * price could be resolved or the lookup fails — never throws.
 */
export async function resolvePurchaseLinePrice(
  args: ResolvePurchaseLinePriceArgs
): Promise<EffectivePurchasePriceDTO | null> {
  if (!args.vendorId || !args.itemId) return null;
  const qty = args.qty && args.qty > 0 ? args.qty : 1;
  try {
    const result = await purchasesApi.getEffectivePurchasePrice({
      vendorId: args.vendorId,
      itemId: args.itemId,
      qty,
      asOfDate: args.asOfDate,
      currency: args.currency,
      exchangeRate: args.exchangeRate,
      uomId: args.uomId,
      uom: args.uom,
    });
    if (!result || result.unitPrice == null) return null;
    return result;
  } catch {
    return null;
  }
}
