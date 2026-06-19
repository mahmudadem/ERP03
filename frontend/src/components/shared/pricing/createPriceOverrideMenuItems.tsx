/**
 * createPriceOverrideMenuItems
 *
 * Shared helper that builds the per-document (column header) and per-line
 * (cell) context menu items for the Price column on sales and purchase
 * document pages.
 *
 * Two views of the same idea:
 *
 *   - **Per-document override** — the user right-clicks the "Unit Price"
 *     column header and chooses a pricing policy that affects every priced
 *     line on the document. The document already has a `linePriceSource`
 *     field on its form; this menu mutates that field. The "Reset to
 *     company default" option appears only when the current source differs
 *     from the document's baseline (`baseSource`).
 *
 *   - **Per-line override** — the user right-clicks a single price cell
 *     and overrides the source for that one line. The line gets a
 *     transient `priceSourceOverride` (or `priceLocked = true` for the
 *     "Lock (manual)" choice) that survives cell re-renders but is
 *     stripped from `buildLinePayload` before posting.
 *
 * Both views use the SAME underlying enum (`LinePriceSource`) so the
 * shared `salesLinePriceResolver` / `purchaseLinePriceResolver` services
 * can resolve a price for either scope without branching by origin.
 *
 * The native sales/purchase pages and the Form-Designer renderer
 * (`GenericVoucherRenderer`) both consume this factory, so per-document
 * and per-line behavior is identical on both surfaces.
 *
 * NOTE: The labels are English-only in this initial version. A future
 * change may accept a `t` function (from `useTranslation`) as a parameter
 * so the menu is translated per the active locale.
 */
import React from 'react';
import { Lock, Tag, X } from 'lucide-react';
import type { ColumnContextMenuItem } from '../ClassicLineItemsTable';
import { LINE_PRICE_SOURCE_OPTIONS, linePriceSourceLabel, type LinePriceSource } from './LinePriceSourceSelector';

export interface CreatePriceOverrideMenuArgs {
  /**
   * Currently-active document-level source. Used to:
   *  - show a checkmark next to the matching item;
   *  - decide whether to render the "Reset to company default" option.
   */
  currentDocumentSource: LinePriceSource;
  /**
   * Document baseline (i.e. the company/party default). The "Reset to
   * company default" item is only shown when `currentDocumentSource !==
   * baseSource`.
   */
  baseSource: LinePriceSource;
  /** Called when the user picks a new document-level source. */
  onSelectDocumentSource: (source: LinePriceSource) => void;
  /** Called when the user picks "Reset to company default". */
  onResetDocumentSource: () => void;
}

/**
 * Build the per-document (column-header) menu items for the Price column.
 * Pass the result as `columnContextMenus={{ price: items }}` to
 * `ClassicLineItemsTable`, or render it inline in the Form-Designer
 * renderer.
 */
export function createDocumentPriceOverrideMenuItems(
  args: CreatePriceOverrideMenuArgs,
): ColumnContextMenuItem[] {
  const { currentDocumentSource, baseSource, onSelectDocumentSource, onResetDocumentSource } = args;
  const items: ColumnContextMenuItem[] = [];

  for (const source of LINE_PRICE_SOURCE_OPTIONS) {
    const isCurrent = source === currentDocumentSource;
    items.push({
      key: `doc-${source}`,
      label: `${linePriceSourceLabelEN(source)}${isCurrent ? '  ✓' : ''}`,
      icon: isCurrent ? <Tag className="h-3.5 w-3.5" /> : undefined,
      onSelect: () => onSelectDocumentSource(source),
    });
  }
  if (currentDocumentSource !== baseSource) {
    items.push({
      key: 'doc-reset',
      label: '↺ Reset to company default',
      icon: <X className="h-3.5 w-3.5" />,
      onSelect: () => onResetDocumentSource(),
      dividerBefore: true,
    });
  }
  return items;
}

export interface CreateLinePriceOverrideMenuArgs {
  /** Per-line source currently active (null = use document source). */
  currentLineSource: LinePriceSource | null;
  /** Per-line manual lock currently active. */
  currentLineLocked: boolean;
  /** Called when the user picks a per-line source (or clears it). */
  onSelectLineSource: (source: LinePriceSource | null) => void;
  /** Called when the user toggles the manual lock. */
  onToggleLineLocked: (locked: boolean) => void;
}

/**
 * Build the per-line (cell) menu items for the Price column. Each item
 * receives the row index at click time (set by the table).
 */
export function createLinePriceOverrideMenuItems(
  args: CreateLinePriceOverrideMenuArgs,
): ColumnContextMenuItem[] {
  const { currentLineSource, currentLineLocked, onSelectLineSource, onToggleLineLocked } = args;
  const items: ColumnContextMenuItem[] = [];

  const isDefaultActive = currentLineSource == null && !currentLineLocked;
  items.push({
    key: 'line-none',
    label: `${linePriceSourceLabelEN(null)}${isDefaultActive ? '  ✓' : ''}`,
    icon: isDefaultActive ? <Tag className="h-3.5 w-3.5" /> : undefined,
    onSelect: () => {
      onSelectLineSource(null);
      onToggleLineLocked(false);
    },
  });

  for (const source of LINE_PRICE_SOURCE_OPTIONS) {
    const isCurrent = source === currentLineSource && !currentLineLocked;
    items.push({
      key: `line-${source}`,
      label: `${linePriceSourceLabelEN(source)}${isCurrent ? '  ✓' : ''}`,
      icon: isCurrent ? <Tag className="h-3.5 w-3.5" /> : undefined,
      onSelect: () => {
        onSelectLineSource(source);
        onToggleLineLocked(false);
      },
    });
  }
  items.push({
    key: 'line-manual',
    label: `🔒 Lock (manual, no auto-resolve)${currentLineLocked ? '  ✓' : ''}`,
    icon: <Lock className="h-3.5 w-3.5" />,
    onSelect: () => {
      onSelectLineSource(null);
      onToggleLineLocked(true);
    },
    dividerBefore: true,
  });
  return items;
}

/**
 * English-only label resolver. Used by both helpers; future i18n
 * extension can swap this for a `t`-aware version.
 */
export function linePriceSourceLabelEN(source: LinePriceSource | null): string {
  if (source == null) return 'Use document source';
  // Stub t() that resolves to the same English defaults the selector uses
  // for the `lastPartyPrice` / `priceList` / `lastEvent` / `itemDefault`
  // keys. The real translation lives in `useTranslation('common')` for
  // components; this helper is for non-hook contexts (e.g. menu factory
  // invoked at render time but outside React).
  const t = ((_key: string, fallback: string) => fallback) as unknown as Parameters<typeof linePriceSourceLabel>[0];
  return linePriceSourceLabel(t, source);
}
