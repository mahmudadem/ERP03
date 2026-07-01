# 278u — Sales AR Aging report translation

## Technical Developer View

Telegram QA requested a wider report translation audit because report pages still showed English in Arabic sessions.

This slice localized the Sales AR Aging report:

- `frontend/src/modules/sales/pages/ArAgingReportPage.tsx`
  - Added `useTranslation('common')`.
  - Localized title/subtitle, as-of/customer filters, customer selector placeholder, generate button, expanded invoice-detail headers, unallocated credit/JV labels, fallback load-error text, as-of chip, customer-count/total-AR summary, loading/empty states, aging table headers, and totals label.
  - Preserved all AR aging API calls, customer filtering, aging buckets, outstanding receivables totals, and row expansion behavior.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added `sales.arAging.*` keys.
- `docs/architecture/i18n.md`
  - Documented the AR Aging key namespace.
- `docs/user-guide/sales/ar-aging.md`
  - Documented that AR Aging report labels follow the selected language.

## End-User View

When users open `Sales → Reports → AR Aging`, the report now follows the selected language. In Arabic, the filters, aging bucket columns, totals, loading/empty messages, and expanded invoice-detail rows no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No AR aging bucket calculation, customer filter behavior, outstanding balance logic, credit/JV adjustment display, tenant, permission, voucher, ledger, or report calculation logic changed.

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
