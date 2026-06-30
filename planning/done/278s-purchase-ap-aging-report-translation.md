# 278s — Purchases AP Aging report translation

## Technical Developer View

Telegram QA requested a wider report translation audit because report pages still showed English in Arabic sessions.

This slice localized the remaining hardcoded AP Aging report text:

- `frontend/src/modules/purchases/pages/ApAgingReportPage.tsx`
  - Localized main aging table headers.
  - Localized expanded invoice-detail table headers.
  - Localized as-of-date chip, vendor-count summary, empty state, debit-note/JV adjustment label, and unallocated-balance label.
  - Preserved AP aging calculations, invoice matching, unallocated balance display, and API behavior.
- `frontend/src/locales/en/purchases.json`
- `frontend/src/locales/ar/purchases.json`
- `frontend/src/locales/tr/purchases.json`
  - Added `auto.ApAgingReportPage.*` keys for the remaining labels.
- `docs/architecture/i18n.md`
  - Documented the AP Aging key namespace.
- `docs/user-guide/purchases/README.md`
  - Documented that AP Aging follows the selected language.

## End-User View

When users open `Purchases → Reports → AP Aging`, the report now follows the selected language more completely. In Arabic, the aging columns, expanded invoice details, vendor count, empty state, and unallocated balance labels no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No AP aging bucket calculation, vendor payable sign convention, unallocated debit/credit handling, invoice matching, tenant, permission, voucher, ledger, or report calculation logic changed.

## Verification

- Purchases locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/` including report route guard, no-confirm guard, and SoD approve guard.
- Build emitted only existing browser-data / dynamic-import / chunk-size warnings.
- `git diff --check` passed.
- `graphify update .` could not run because the `graphify` CLI is unavailable in this shell.

## Time

- Estimate: 0.4h.
- Actual: ~0.4h.
