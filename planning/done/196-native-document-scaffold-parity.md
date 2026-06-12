# 196 — Native Document Scaffold Parity

**Status:** Complete with visual QA pending
**Date:** 2026-06-09
**Agent:** Codex
**Actual time:** ~4.5h

## Technical Developer View

### What changed

- Extended `frontend/src/components/shared/ClassicLineItemsTable.tsx` with optional shared header/title support, configurable max body height, and configurable min table width.
- Migrated document line tables to the shared table shell:
  - `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
  - `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
  - `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx` (direct-entry lines)
  - `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
  - `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
  - `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`
  - `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`
- Migrated Goods Receipt draft/edit and Purchase Return saved/edit surfaces to `DocumentDetailScaffold` with side rails and sticky footer actions.
- Migrated these legacy list pages to `OperationalListLayout` + `DataTable`:
  - `frontend/src/modules/sales/pages/QuotationsPage.tsx`
  - `frontend/src/modules/purchases/pages/GoodsReceiptsListPage.tsx`
  - `frontend/src/modules/purchases/pages/PurchaseReturnsListPage.tsx`
- Updated docs:
  - `docs/architecture/sales.md`
  - `docs/architecture/purchases.md`
  - `docs/architecture/operational-lists.md`
  - `docs/user-guide/sales/README.md`
  - `docs/user-guide/purchases/README.md`

### Accounting boundary

This was a UI/data-entry consistency pass. No backend use cases, posting services, tax logic, inventory valuation, settlement payloads, approval behavior, period-lock behavior, AP/AR balances, or ledger writes were changed.

### Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed, including:
  - `check:reports`
  - `check:no-confirm`
  - `check:sod-approve`
  - TypeScript compile
  - Vite production build

### Known visual QA follow-ups

- Quotation detail now shares the line table and its list page is standardized, but the outer quote lifecycle header remains page-local because quote-specific send/accept/reject/revise/convert actions need a separate visual placement pass.
- Purchase Return create mode keeps its source-picking card flow, but its return line table is standardized.
- Manual Classic + Windows mode visual QA is still required for SO, DN, SR, Quotes, PO, GRN, PR, SI, and PI after this cross-page change.

## End-User View

Sales and Purchases documents now look and behave more consistently. The line item table is shared across invoices, orders, deliveries/receipts, returns, and quotations, so users see the same row layout while each document still shows the right columns for its workflow.

Goods Receipts, Purchase Returns, and Quotations now use the same list-page style as Sales/Purchase Invoices: quick status filters, inline search/filter controls, centered columns, row actions, and pagination.

Goods Receipt and Purchase Return detail pages now show the same compact document shell pattern with a summary rail and sticky footer actions, making save/post/edit/unpost actions easier to reach while scrolling.
