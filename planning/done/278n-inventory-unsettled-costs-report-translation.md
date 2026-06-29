# 278n — Inventory Unsettled Costs report translation

## Technical Developer View

Telegram QA screenshot 23 showed the Inventory **Unsettled Costs** report leaking English in an Arabic session.

Changed:

- `frontend/src/modules/inventory/pages/UnsettledCostsPage.tsx`
  - Added `useTranslation('common')`.
  - Localized report title, subtitle, filters, cost-basis options, filter chips, summary totals, loading text, table columns, totals row, and empty state.
- `frontend/src/locales/{en,ar,tr}/common.json`
  - Added `inventory.unsettledCosts.*` keys.
- `docs/architecture/i18n.md`
  - Documented the key location.
- `docs/user-guide/inventory/unsettled-costs.md`
  - Added user-facing report note.

## End-User View

Arabic and Turkish users should now see the Unsettled Costs report in their selected language instead of English.
The report behavior and numbers are unchanged.

## Accounting and control impact

- Translation/presentation only.
- No inventory movement, costing, voucher, ledger, tenant, permission, or report calculation logic changed.

## Verification

- Common locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/`.
- `git diff --check` passed.
- `graphify update .` could not run because the `graphify` CLI is unavailable in this shell.
- Build warnings are existing bundle/browser-data warnings.

## Time spent

~0.5h.
