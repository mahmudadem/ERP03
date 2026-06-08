# 191 - Sales/Purchases Document UI Parity

**Date:** 2026-06-08  
**Agent:** Codex  
**Time spent:** ~6.6h  
**Status:** Complete for this slice

## Technical Developer View

### What changed

- Refactored `frontend/src/modules/sales/pages/SalesReturnsListPage.tsx` from a custom card/table page to the shared `OperationalListLayout` + `DataTable` pattern.
- Added Sales Returns quick status pills, search, customer/context/status/date filters, centered scan-friendly cells, company-aware date/time display, row actions, default newest-first sorting, and 25-row pagination.
- Replaced raw Purchase Invoice PO ID entry in `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` with a real Purchase Order dropdown loaded from `purchasesApi.listPOs()`.
- Added and then corrected shared SI-style document shell primitives in `frontend/src/components/shared/DocumentDetailScaffold.tsx`.
- `DocumentDetailScaffold` now owns the reusable Sales Invoice-style page skeleton:
  - compact top header bar
  - status/source pill area
  - full-height `h-full min-h-0` document workspace
  - optional responsive right rail with inline wide-screen mode and edge-triggered drawer mode
  - shared footer totals/action slot
  - reusable document primitives: `DocumentPill`, `DocumentCompactCard`, `DocumentControlPanel`, segmented controls, line/secondary regions, rail cards, rail stats, and footer totals strip
- Converted SO, DN, SR, PI, and PO detail pages to render through that shared scaffold instead of each page owning its own topbar/footer layout:
  - `SalesOrderDetailPage.tsx`
  - `DeliveryNoteDetailPage.tsx`
  - `SalesReturnDetailPage.tsx`
  - `PurchaseInvoiceDetailPage.tsx`
  - `PurchaseOrderDetailPage.tsx`
- Each page now supplies business-specific slots:
  - SO uses customer/order/totals/fulfillment content.
  - DN uses delivery, warehouse, stock quantity, cost-base, GL impact, and audit content.
  - SR uses return context, credit-note/refund settlement, restocking-fee, source lines, GL impact, and audit content.
  - PI uses vendor, PO/direct source, bill attachments, AP totals/payment status, SoD approval messaging, payment/return/unpost actions.
  - PO uses vendor/order/totals/procurement workflow content.
- Corrected Purchase Invoice internals after the initial scaffold pass: PI create/edit and saved view now use the Sales Invoice-style source controls, compact source-aware header card, shared line-items region, allocation-grid placeholder, attachments/audit shortcut tiles, and side rail ordered as Info, Posting Readiness/Document Status, Settlement, and Totals.
- Purchase Invoice no longer shows the old standalone header/totals/attachments card stack in create/edit or saved view, and its vendor selector is role-filtered to `VENDOR`.
- Updated architecture and user documentation:
  - `docs/architecture/operational-lists.md`
  - `docs/architecture/sales.md`
  - `docs/architecture/purchases.md`
  - `docs/user-guide/lists/invoice-lists.md`
  - `docs/user-guide/sales/sales-returns.md`
  - `docs/user-guide/purchases/README.md`

### Accounting / ERP boundary

This was a frontend UX/data-entry parity slice. No document totals, tax calculations, AP/AR settlement, stock movement, COGS, approval, period-lock, posting, or ledger-write behavior was changed.

The Purchase Invoice PO source field fix reduces data-integrity risk because users no longer type arbitrary `purchaseOrderId` strings into the form.

## End-User View

Sales Returns now look and behave like the standardized invoice/order lists: users can search, filter, use status pills, open rows, and work with paginated results in the same style as Sales Invoices.

Sales Order, Delivery Note, Sales Return, Purchase Invoice, and Purchase Order pages now use the same shared Sales Invoice-style page skeleton: compact header, scroll workspace, right-side summary rail, and persistent footer actions/summaries. The fields still match each document type: Sales pages use customers, Purchase pages use vendors, Delivery Notes focus on delivery/warehouse quantities, and Purchase Invoices focus on vendor bills/AP.

Purchase Invoice now also follows the same inside-page flow as Sales Invoice: source controls, compact header, line table, allocation grid placeholder, attachments/audit shortcuts, and a right rail for info, posting readiness/document status, settlement, and totals.

Purchase Invoice users now select a real Purchase Order from the system instead of typing a PO ID manually.

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed, including `check:reports`, `check:no-confirm`, and `check:sod-approve`.
- Static scan confirmed the old PI visual markers (`Bill Totals`, `Payables Control`, raw `PO Reference`, old titled `Line Items`, old full-width `Totals`, and generic customer/vendor selector text) are gone from `PurchaseInvoiceDetailPage.tsx`.
- `git diff --check -- <touched files>` passed with CRLF line-ending normalization warnings only.
- `graphify update .` could not run because `graphify` is not available in this PowerShell environment.
- Browser visual smoke QA could not run because the in-app Browser navigation/screenshot tool was not exposed in this session.

## Manual QA Needed

Open the following pages in Classic and Windows mode and verify the sticky footers do not cover required fields or actions:

- `Sales -> Returns`
- `Sales -> Orders -> detail`
- `Sales -> Delivery Notes -> detail`
- `Sales -> Returns -> detail`
- `Purchases -> Invoices -> new/detail`
- `Purchases -> Orders -> detail`
