# 185 — Sales Invoice source/header cleanup

**Status:** Done  
**Date:** 2026-06-07  
**Actual time:** ~1.0h  
**Scope:** Frontend-only Sales Invoice detail page cleanup.

## Technical Developer View

Updated `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` so the Sales Invoice top area is organized by source mechanism instead of mixing controls and header fields.

What changed:

- The top Control card now focuses on source choice: Direct, From SO, and the future From DN option.
- The document header is always visible; the collapse/expand behavior was removed.
- Invoice Template was removed from the visible UI.
- Due Date was removed from the visible UI and from this page's create/update payloads.
- Salesperson moved out of the Control card and into the source-aware header.
- Direct invoices now show a header-level Main Warehouse selector.
- Direct line payloads fall back to the header Main Warehouse when a line does not carry its own warehouse.
- From SO mode now shows the Sales Order selector in the header and filters normal choices to confirmed / partially delivered Sales Orders.
- From SO mode hides Main Warehouse because source lines carry warehouse data.
- Selecting a Sales Order loads invoiceable linked lines and also copies the SO salesperson when available.

No backend posting, tax, discount, approval, settlement, period-lock, or ledger code was changed.

Files touched:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`
- `planning/done/185-sales-invoice-source-header-cleanup.md`
- `planning/JOURNAL.md`

## End-User View

The Sales Invoice page is now easier to read:

- First choose whether the invoice is Direct or From Sales Order.
- Direct invoices ask for the main warehouse in the header.
- Sales Order invoices ask for the Sales Order in the header and fill source information automatically.
- The invoice template and due-date fields are no longer shown on the invoice screen.
- Salesperson and customer reference stay in the header where users expect invoice header details.

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed, including report, confirm, and SoD checks.

Known build warnings remain baseline warnings about bundle size, Browserslist/baseline-browser-mapping age, and existing dynamic/static import overlap.

## Follow-Ups

- Run manual visual QA on `/#/sales/invoices/new` in Direct and From SO modes.
- Build Task 184 separately for real editable allocation-grid posting overrides.
