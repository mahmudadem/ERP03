# 278q — Inventory Item Movement report translation

## Technical Developer View

Telegram QA requested a wider report translation audit because report pages still showed English in Arabic sessions.

This slice localized the Inventory Item Movement report:

- `frontend/src/modules/inventory/pages/ItemMovementReportPage.tsx`
  - Added `useTranslation('common')`.
  - Localized report title/subtitle, item/warehouse/date/direction/movement/source filters, selector placeholders, option labels, generate button, chips, movement count, loading text, empty state, table columns, and displayed movement/source type labels.
  - Preserved the existing shared `ItemSelector`, `WarehouseSelector`, and `DatePicker`.
  - Preserved source-document navigation behavior.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added `inventory.itemMovement.*` keys.
- `docs/architecture/i18n.md`
  - Documented the key namespace.
- `docs/user-guide/inventory/README.md`
  - Documented that Item Movement follows the selected language.

## End-User View

When users open `Inventory → Reports → Item Movement`, the report now follows the selected language. In Arabic, filters, movement/source options, table headings, source labels, and loading/empty messages no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No stock movement retrieval, movement filtering rules, running quantity, running value, stock cost, source routing, tenant, permission, voucher, ledger, or report calculation logic changed.

## Verification

- Common locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/` including report route guard, no-confirm guard, and SoD approve guard.
- Build emitted only existing browser-data / dynamic-import / chunk-size warnings.
- `git diff --check` passed.
- `graphify update .` could not run because the `graphify` CLI is unavailable in this shell.

## Time

- Estimate: 0.6h.
- Actual: ~0.6h.
