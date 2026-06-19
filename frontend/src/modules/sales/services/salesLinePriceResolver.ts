/**
 * Sales-line price resolver
 *
 * Shared service used by every sales document entry surface (native pages and
 * Forms Designer–rendered forms) so a customer + item combination yields the
 * same auto-filled unit price everywhere.
 *
 * Sourcing rule mirrors `GetEffectivePriceUseCase` on the backend:
 *   customer.defaultPriceListId  →  customer.customerGroup.defaultPriceListId
 *   →  the line matching (itemId, qty) on that price list.
 *
 * Returns null on any error/miss; pricing lookup failures are non-fatal —
 * callers should leave the existing unit price as-is.
 */

import { salesMasterDataApi, EffectivePriceDTO } from '../../../api/salesMasterDataApi';

const SALES_DOC_TOKENS = [
  'sales_invoice',
  'sales_order',
  'sales_quote',
  'sales_return',
  'delivery_note',
  'quote',
];

const normalize = (value: any): string =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/**
 * True when the form definition describes any sales document that has
 * customer-priced line items.
 */
export function isSalesDocumentDefinition(definition: any): boolean {
  if (!definition) return false;
  const candidates = [
    definition.voucherType,
    definition.baseType,
    definition.formType,
    definition.code,
    definition.module,
    definition.persona,
  ].map(normalize);

  if (candidates.some((c) => c === 'sales' || c === 'sales_module')) {
    // Module-only signal isn't enough — must look like a doc with line items.
    // Fall through to token check.
  }

  return SALES_DOC_TOKENS.some((token) =>
    candidates.some((c) => c && c.includes(token))
  );
}

export interface ResolveLinePriceArgs {
  customerId: string;
  itemId: string;
  qty?: number;
  asOfDate?: string;
  currency?: string;
  exchangeRate?: number;
  uomId?: string;
  uom?: string;
}

/**
 * Fetch the effective unit price for one sales line. Returns null when no
 * price could be resolved or the lookup fails — never throws.
 */
export async function resolveSalesLinePrice(
  args: ResolveLinePriceArgs
): Promise<EffectivePriceDTO | null> {
  if (!args.customerId || !args.itemId) return null;
  const qty = args.qty && args.qty > 0 ? args.qty : 1;
  try {
    const result = await salesMasterDataApi.getEffectivePrice({
      customerId: args.customerId,
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
