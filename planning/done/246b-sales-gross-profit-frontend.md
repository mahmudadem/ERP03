# Task 246B Completion Report: Sales Gross Profit Report UI

**Date:** 2026-06-20  
**Branch:** `codex/246-sales-gross-profit-ui`  
**Estimated time:** 1.5h  
**Actual time:** ~1.8h

## Technical Developer View

Task 246 backend facts and APIs were already merged through PR #29. This
slice made the feature QA-testable from the Sales module by adding two
`ReportContainer` pages:

- `frontend/src/modules/sales/pages/SalesGrossProfitByDocumentPage.tsx`
- `frontend/src/modules/sales/pages/SalesGrossProfitByItemPage.tsx`
- shared implementation: `frontend/src/modules/sales/pages/SalesGrossProfitReportPage.tsx`

The frontend API client now exposes:

- `salesReportingApi.getGrossProfitByDocument(...)`
- `salesReportingApi.getGrossProfitByItem(...)`

The UI maps frontend filter names to the backend query contract
(`fromDate` -> `from`, `toDate` -> `to`) and keeps the normal sales
scope as the default by omitting `documentType`, matching backend
behavior. The item filter uses the shared `ItemSelector`.

Routes and menu entries:

- `/sales/reports/gross-profit/by-document`
- `/sales/reports/gross-profit/by-item`
- Sales -> Reports -> Gross Profit by Document
- Sales -> Reports -> Gross Profit by Item

Docs updated:

- `docs/architecture/reporting.md`
- `docs/user-guide/reporting/sales-gross-profit.md`

## End-User View

Users can now open two new reports under **Sales -> Reports**:

- **Gross Profit by Document** shows gross profit per invoice/return.
- **Gross Profit by Item** shows gross profit grouped by item.

The reports show base-currency revenue, cost, and profit split into IN,
OUT, and Net columns. They also show document-currency profit per row.
If a grouped row contains more than one invoice currency, the page shows
separate subtotals by currency instead of mixing currencies into one
number.

These are management reports for daily profit analysis. They do not
change accounting postings, inventory valuation, COGS, FX revaluation,
tax, AR/AP, or GL reports.

## Verification

- `npm --prefix frontend run check:reports` — passed.
- `npm --prefix frontend run typecheck` — passed.
- `npm --prefix frontend run build` — passed. Existing Vite bundle-size /
  Browserslist / baseline-browser-mapping warnings only.

## QA Notes

Open:

1. Sales -> Reports -> Gross Profit by Document
2. Sales -> Reports -> Gross Profit by Item

Recommended smoke checks:

- Run the report with default filters and confirm posted sales invoices
  and sales returns appear.
- Filter to **Sales invoices only** and confirm returns disappear.
- Filter by item and confirm only that item's facts remain.
- Filter by document currency and confirm only matching document
  currencies remain.
- Confirm mixed-currency grouped rows show per-currency breakdowns.
