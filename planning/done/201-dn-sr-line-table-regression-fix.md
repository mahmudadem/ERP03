# 201 - Shared Line Table Auto-Append Regression Fix

**Date:** 2026-06-10  
**Agent:** Codex  
**Actual time:** ~0.9h

## Technical Developer View

Fixed a frontend regression introduced by the shared native document line table rollout. `ClassicLineItemsTable` auto-appends a new blank working row when the final row is filled. Several native document pages had empty rows with default numeric placeholders such as quantity `1`, price `0`, or cost `0`, and their `isRowFilled` predicates counted those defaults as real content. That made the table append rows continuously.

Changed files:
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`
- `frontend/src/components/shared/ClassicLineItemsTable.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/document-scaffold.md`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/README.md`
- `docs/user-guide/purchases/README.md`
- `planning/QA-QUEUE.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

Implementation notes:
- DN, SR Direct, SO, Quote, PO, GRN, PI, and PR `isRowFilled` now ignore default numeric placeholders and only treat real line identity/content as filled.
- The shared table row context menu now supports explicit local-only row color swatches and a clear-color action.
- The context menu shadow was reduced from a heavy shadow to a subtler `shadow-md`.

## End-User View

Native document line tables should no longer keep adding rows automatically. The Sales Return direct form should open normally instead of entering an error/render loop.

Users can also right-click a line and choose a line color. This is a local visual preference for easier scanning; it does not affect saved document values, inventory, accounting, tax, posting, or approvals.

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed with existing bundle/browser-data warnings.
- `git diff --check -- ...` passed for the touched frontend files.

## Still Needs Review

- Manual QA in Classic and Windows mode for DN, SR, SO, Quote, PO, GRN, PI, and PR line tables.
- Confirm row color persistence and clear-color behavior after reload.
