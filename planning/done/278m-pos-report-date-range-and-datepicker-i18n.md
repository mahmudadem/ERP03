# 278m — POS report date range order and DatePicker quick-select i18n

## Technical Developer View

Telegram QA screenshots 21–22 showed POS report date filters in Arabic where the default last-30-days range looked
reversed, and the DatePicker quick-select menu still showed English labels.

Changed:

- `frontend/src/modules/pos/pages/PosDateRangeInitiator.tsx`
  - Forces the POS report date-filter row to render left-to-right so **Date from** appears before **Date to** even in RTL sessions.
  - Keeps each field label localized with `dir="auto"`.
- `frontend/src/modules/accounting/components/shared/DatePicker.tsx`
  - Replaced hardcoded quick-select labels with `common:datePicker.*` translations.
- `frontend/src/locales/{en,ar,tr}/common.json`
  - Added `datePicker.*` translations.
- `docs/architecture/pos.md`, `docs/architecture/i18n.md`, and `docs/user-guide/pos/reports.md`
  - Documented the date-range and DatePicker translation behavior.

## End-User View

POS reports still default to the last 30 days. In Arabic, the date fields now appear in the same logical order:
**Date from** first, **Date to** second. The DatePicker quick-select menu now appears in Arabic/Turkish instead
of English.

## Accounting and control impact

- UI/report-filter presentation only.
- No POS receipt, return, shift, voucher, ledger, tenant, permission, or report calculation logic changed.

## Verification

- Common locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/`.
- Build warnings are existing bundle/browser-data warnings.
- `git diff --check` passed.
- `graphify update .` could not run because `graphify` is not installed/available in this shell.

## Time spent

~0.4h.
