# 278i — POS report date/time sort

## Status

Complete for POS time-based reports. Telegram text at 18:19 requested report defaults by date and time because time is important.

## Technical developer view

Added `frontend/src/components/reports/reportSorting.ts` with a typed `sortReportRowsByDateTimeDesc()` helper. Applied it to POS reports that list dated rows:

- `PosDailySummaryReportPage.tsx` — `date`
- `PosReceiptHistoryReportPage.tsx` — `createdAt`
- `PosCancelledReceiptsReportPage.tsx` — `createdAt`
- `PosCashOverShortReportPage.tsx` — `closedAt`
- `PosOverrideAuditReportPage.tsx` — `createdAt`
- `PosReprintAuditReportPage.tsx` — `reprintedAt`

Grouped/ranked POS summaries were intentionally left unchanged: Payment Methods, Cashier Sales, and Top Selling Items should keep their semantic grouping/ranking rather than being forced into date order.

Code commit: `e52683c0`.

Documentation files changed in this docs slice:

- `docs/architecture/reports.md`
- `docs/architecture/pos.md`
- `docs/user-guide/pos/reports.md`
- `planning/done/278i-pos-report-datetime-sort.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

## End-user view

POS reports that show dated activity now open with the newest entries first. This makes recent receipts, cancellations, shift variances, overrides, and reprints easier to review during production QA and daily operations.

## Accounting impact

Display order only. No receipts, returns, payments, shift reconciliation, vouchers, stock movement, revenue, tax, COGS, cash movement, ledger entry, tenant scope, or audit record changed.

## Verification

- Frontend TypeScript check passed.
- Frontend production build passed, including report route checks, no raw confirm/alert check, and SOD approve check.
- `graphify update .` could not run because the CLI is unavailable in this shell.

## Time

- Estimate: 30–45 minutes
- Actual: approximately 35 minutes

## Deployment

Deferred until all Telegram production QA fixes are complete.
