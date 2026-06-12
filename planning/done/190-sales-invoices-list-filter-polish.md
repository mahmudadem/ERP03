# Sales Invoices List Filter Polish

**Date:** 2026-06-08
**Agent:** Codex
**Actual time spent:** ~0.7h

## Technical Developer View

Updated `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx` so the Sales Invoices operational list:

- Defaults the filter date range to the active/open fiscal-year beginning through company-today, with a company-profile fallback when fiscal years are unavailable.
- Keeps reset/clear behavior aligned to the same fiscal-year default range.
- Uses inline placeholder-style neutral options for Type, Status, and Payment filters.
- Formats invoice date, due date, posted date, and times through company date/time utilities.
- Centers list cell content and prevents payment/status chips from wrapping.

No backend API, invoice calculation, tax, posting, AR, settlement, approval, period-lock, inventory, or ledger behavior changed.

## End-User View

On Sales -> Invoices, the filter bar is easier to scan:

- Type, Status, and Payment show simple placeholder text until a value is selected.
- Date filters open from the fiscal-year beginning through today by default.
- Dates follow the company date format.
- Table values are centered.
- Long statuses such as Pending Approval stay on one line.

## Verification

- `npm --prefix frontend run typecheck` passed.

## Follow-Ups

- Manual visual QA: open Sales -> Invoices in Classic and Windows mode, confirm the date range defaults, status/payment dropdown placeholders, centered cells, and one-line Pending Approval chip.
