# 278r — Inventory GL Reconciliation report translation

## Technical Developer View

Telegram QA requested a wider report translation audit because report pages still showed English in Arabic sessions.

This slice localized the Inventory GL Reconciliation report:

- `frontend/src/modules/inventory/pages/InventoryGLReconciliationPage.tsx`
  - Added `useTranslation('common')`.
  - Localized report title/subtitle, as-of date filter, explanatory help text, generate button, loading state, reconciled/drift banner text, summary labels, table columns, matched/drift badges, and empty state.
  - Preserved all reconciliation math and API behavior.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added `inventory.glReconciliation.*` keys.
- `docs/architecture/i18n.md`
  - Documented the key namespace.
- `docs/user-guide/inventory/README.md`
  - Documented that the report follows the selected language.

## End-User View

When users open `Inventory → Reports → Inventory GL Reconciliation`, the report now follows the selected language. In Arabic, the explanation, status banner, summary labels, table headings, status badges, and empty/loading messages no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No inventory sub-ledger valuation, GL balance lookup, drift calculation, account mapping, tenant, permission, voucher, ledger, or report calculation logic changed.

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
