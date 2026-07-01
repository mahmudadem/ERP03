# 278o — Inventory Valuation report translation

## Technical Developer View

Telegram QA requested a broader report-translation audit after Inventory reports still showed English in an Arabic session.

This slice localized the Inventory Valuation report:

- `frontend/src/modules/inventory/pages/InventoryValuationPage.tsx`
  - Added `useTranslation('common')`.
  - Localized report title/subtitle, filter labels, mode options, pricing-policy options, generate button, filter chips, summary text, loading text, empty state, table columns, and server grand-total label.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added `inventory.valuation.*` keys.
- `docs/architecture/i18n.md`
  - Documented the key namespace.
- `docs/user-guide/inventory/README.md`
  - Documented that Inventory Valuation follows the selected language.

## End-User View

When users open `Inventory → Reports → Inventory Valuation`, the report now respects the selected language. In Arabic, the title, filters, table headings, loading message, empty message, and summary labels no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No inventory movement, stock valuation, average-cost, last-purchase-cost, as-of valuation, voucher, ledger, tenant, permission, or report calculation logic changed.

## Verification

- Common locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/` including report route guard, no-confirm guard, and SoD approve guard.
- Build emitted only existing browser-data / dynamic-import / chunk-size warnings.
- `git diff --check` passed.
- `graphify update .` could not run because the `graphify` CLI is unavailable in this shell.

## Time

- Estimate: 0.4h.
- Actual: ~0.4h.
