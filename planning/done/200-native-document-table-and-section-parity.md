# Task 200 - Native Document Table and Section Parity

**Date:** 2026-06-09
**Status:** Completed
**Actual time:** ~4.5h

## Summary

Upgraded the shared native document table and scaffold contract so Sales Invoice remains the template for all native Sales/Purchases document pages. The line-items table now owns context menus, local table preferences, saved column widths, blank-cell behavior, and edit/view row handling. The scaffold now owns the named **Document action tray** for the top icon cluster.

## Files Changed

- `frontend/src/components/shared/ClassicLineItemsTable.tsx`
- `frontend/src/components/shared/DocumentDetailScaffold.tsx`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/document-scaffold.md`
- `docs/user-guide/sales/README.md`
- `docs/user-guide/purchases/README.md`
- `planning/tasks/200-native-document-table-and-section-parity.md`

## Technical Developer View

`ClassicLineItemsTable` now supports the shared GVR-style line-grid behavior:

- row context menu for copy, paste, delete, insert row, and highlight
- table context menu from the empty `#` header cell for copy, paste, clean, export, import, and UI selector
- column resize handles saved in `localStorage` per `tableId`
- per-table UI preferences saved in `localStorage`: classic/web skin, alternating row color, text size, and number font
- blank visual cells until data exists by suppressing table input placeholders
- optional 25-row edit working grid when a page supplies `createEmptyRow` and `onRowsChange`
- optional read-only/view filtering of empty rows when a page supplies `isRowFilled`

Native document pages now pass stable `tableId` values and row callbacks/predicates into the shared table. Linked-source documents keep structural row edits disabled where their source-line contract should not be changed from the table context menu.

`DocumentDetailScaffold` now exports and owns `DocumentActionTray`. Any `headerTools` passed by document pages render in that standardized compact action tray.

## End-User View

Document line tables now behave consistently across Sales and Purchases. Users can right-click editable rows to copy, paste, insert, delete, or highlight lines. Clicking or right-clicking the `#` header opens table actions for copy, paste, clean, export, import, and table display preferences.

Users can resize columns, pick classic or web table layout, choose row coloring, change text size, and change number font. These preferences are saved locally for the current user and table.

The top document icon cluster is now standardized as the Document action tray, so document-level actions appear in the same place and style across native document pages.

## Accounting Boundary

This was UI/data-entry parity only. No ledger posting, tax calculation, AP/AR settlement, inventory valuation, COGS, approval, period-lock, voucher creation, audit write, backend DTO, or repository behavior changed.

The allocation grid remains display-only/placeholder behavior. This task does not allow users to override GL or tax posting accounts from the grid.

## Verification

- `npm --prefix frontend run typecheck` passed after the shared table changes.
- `npm --prefix frontend run typecheck` passed after page wiring.
- `npm --prefix frontend run typecheck` passed after column resizing/i18n/scaffold action tray updates.
- `npm --prefix frontend run build` passed, including `check:reports`, `check:no-confirm`, and `check:sod-approve`. Existing bundle-size, Browserslist, baseline-browser-mapping, and dynamic-import warnings remain.
- `graphify update .` was attempted but `graphify` is not available on this PowerShell PATH.

## Manual QA Needed

- Open each native document page in Classic and Windows mode: SI, PI, SO, DN, SR, Quotation, PO, GRN, PR.
- Right-click editable rows and confirm actions appear/disable correctly.
- Click or right-click the `#` header cell and confirm table actions appear.
- Resize columns, reload, and confirm widths persist per document table.
- Open UI selector, change layout/row coloring/text size/number font, reload, and confirm preferences persist.
- Confirm linked-source rows cannot be structurally corrupted by insert/delete where those callbacks are intentionally absent.
