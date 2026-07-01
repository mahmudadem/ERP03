# 278t — Purchases Vendor Statement report translation

## Technical Developer View

Telegram QA requested a wider report translation audit because report pages still showed English in Arabic sessions.

This slice localized the remaining hardcoded Vendor Statement report text:

- `frontend/src/modules/purchases/pages/VendorStatementPage.tsx`
  - Localized ledger table headers and transaction-type badges.
  - Localized the mode chip, date-range chip, report section title, open-bill table headers, open-commitment table headers, and fallback load-error text.
  - Preserved all vendor statement API calls, AP ledger display, source/voucher navigation, and open-commitment exclusion behavior.
- `frontend/src/locales/en/purchases.json`
- `frontend/src/locales/ar/purchases.json`
- `frontend/src/locales/tr/purchases.json`
  - Added the missing `auto.VendorStatementPage.*` keys.
- `docs/architecture/i18n.md`
  - Documented the Vendor Statement key namespace.
- `docs/user-guide/purchases/README.md`
  - Documented that Vendor Statement report labels follow the selected language.

## End-User View

When users open `Purchases → Reports → Vendor Statement`, the report now follows the selected language more completely. In Arabic, the ledger table, open-bills table, open-commitments table, report mode, date range, and transaction-type labels no longer remain in English.

## Accounting / ERP Impact

- Presentation/i18n only.
- No AP ledger source, opening balance, activity lines, closing balance, debit/credit sign display, open-bill selection, open-commitment exclusion, tenant, permission, voucher, ledger, or report calculation logic changed.

## Verification

- Purchases locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/` including report route guard, no-confirm guard, and SoD approve guard.
- Build emitted only existing browser-data / dynamic-import / chunk-size warnings.
- `git diff --check` passed.
- `graphify update .` could not run because the `graphify` CLI is unavailable in this shell.

## Time

- Estimate: 0.5h.
- Actual: ~0.5h.
