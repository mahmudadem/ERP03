# Sales Invoice Responsive Window Layout

**Date:** 2026-06-07  
**Agent:** Codex  
**Time spent:** ~1.1h  
**Scope:** Sales Invoice detail page layout only

## Summary

Fixed the Sales Invoice detail page so resized Windows-mode invoice windows and smaller view areas keep invoice sections reachable instead of clipping content behind nested fixed-height scroll regions or letting the right rail push over other invoice components.

## Technical Developer View

### Files changed

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`
- `planning/QA-QUEUE.md`

### What changed

- Changed the Sales Invoice workspace to use one reliable vertical scroll surface in normal laptop and resized-window sizes.
- Kept the dense wide-screen rail pinned by default, with a hide button and a small edge button to restore it.
- Converted the rail to an edge-triggered drawer in Windows mode and narrow viewports, even when the wide-screen rail is normally pinned.
- Kept line-item and allocation tables horizontally scrollable inside their own table containers.
- Prevented the right rail from using fixed row clipping or consuming workspace width at the default `1100x750` Windows-mode invoice size.

### Accounting and ERP impact

No accounting behavior changed. This does not affect invoice totals, discounts, taxes, payment handling, approval, period locks, posting, AR, inventory valuation, audit logs, or ledger entries.

## End-User View

Sales Invoice screens now adapt better when the available window is smaller. In Windows mode, the side rail hides automatically and can be opened from the edge button as a drawer. On wide screens, the rail stays pinned by default, can be hidden, and can be restored from the visible edge button.

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed.
- `npm --prefix frontend run check:no-confirm` passed.
- `git diff --check -- frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` passed.

## Manual QA Needed

- Open `/#/sales/invoices/new` in normal web mode and confirm all sections are reachable.
- Switch to Windows mode, open a Sales Invoice window, then resize it smaller than the default `1100x750`.
- Confirm header, line items, allocation grid, charges, totals, and footer actions remain reachable through scroll.
- Confirm the side rail opens from the edge button as a drawer in Windows mode or smaller viewports.
- On a wide screen, confirm the side rail is pinned by default, can be hidden, and can be restored from the edge button.
- Confirm wide tables scroll horizontally inside the table, not by hiding page actions.

## Known Limitations

Automated visual QA was not completed because the in-app Browser tool was not exposed in this thread and Playwright is not installed in the repo.
