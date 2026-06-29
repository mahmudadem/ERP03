# 278v — Sales Customer Statement report translation

## Technical Developer View

Telegram QA requested a wider report translation audit because report pages still showed English in Arabic sessions.

This slice localized the Sales Customer Statement report:

- `frontend/src/modules/sales/pages/CustomerStatementPage.tsx`
  - Added `useTranslation('common')`.
  - Localized title/subtitle, filters, selector placeholder, commitment help, ledger table headers, opening/closing balance rows, empty transaction state, line-type badges, source/voucher actions and tooltips, report chips, totals summary, loading/empty states, open-invoice table headers, and open-commitment table headers.
  - Preserved all customer statement API calls, AR ledger display, source/voucher navigation, open-invoice listing, and open-commitment exclusion behavior.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added `sales.customerStatement.*` keys.
- `docs/architecture/i18n.md`
  - Documented the Customer Statement key namespace.
- `docs/user-guide/sales/customer-statement.md`
  - Documented that Customer Statement report labels follow the selected language.

## End-User View

When users open `Sales → Reports → Customer Statement`, the report now follows the selected language. In Arabic, the filters, statement/ledger labels, balance rows, action buttons, open invoices, and open commitments no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No AR ledger source, opening balance, activity lines, closing balance, debit/credit sign display, open-invoice selection, open-commitment exclusion, tenant, permission, voucher, ledger, or report calculation logic changed.

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
