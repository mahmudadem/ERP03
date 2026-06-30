# 278p — Inventory Stock Levels report translation

## Technical Developer View

Telegram QA requested a wider audit because report pages still showed English in Arabic sessions.

This slice localized the Inventory Stock Levels report:

- `frontend/src/modules/inventory/pages/StockLevelsPage.tsx`
  - Added `useTranslation('common')`.
  - Localized title/subtitle, filters, selector placeholders, view options, include-zero/include-negative toggles, generate button, chips, summaries, loading text, empty state, both table layouts, cost-basis labels, and warning/status labels.
  - Kept the existing item/warehouse selector components; no new picker was created.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added `inventory.stockLevels.*` keys.
- `docs/architecture/i18n.md`
  - Documented the key namespace.
- `docs/user-guide/inventory/README.md`
  - Documented that Stock Levels report UI follows the selected language.

## End-User View

When users open `Inventory → Reports → Stock Levels`, the report now follows the selected language. In Arabic, the filters, view selector, table headings, warnings, and summary labels no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No stock quantity, stock value, average-cost, last-known-cost, negative-stock exposure, tenant, permission, voucher, ledger, or report calculation logic changed.

## Verification

- Common locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/` including report route guard, no-confirm guard, and SoD approve guard.
- Build emitted only existing browser-data / dynamic-import / chunk-size warnings.
- `git diff --check` passed.
- `graphify update .` could not run because the `graphify` CLI is unavailable in this shell.

## Time

- Estimate: 0.5h.
- Actual: ~0.5h.
