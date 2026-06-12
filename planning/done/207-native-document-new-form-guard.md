# 207 — Native Document New Form Guard

**Date:** 2026-06-12  
**Actual time spent:** ~1.2h  
**Scope:** Shared native Sales/Purchases document scaffold UX

## Technical Developer View

Added a template-owned New document action to `frontend/src/components/shared/DocumentDetailScaffold.tsx`.

The scaffold now accepts `newAction`, renders a standard icon button in the document action tray, and shows the shared `ConfirmDialog` when the page reports actual unsaved changes. The scaffold owns the modal behavior and copy; document pages only provide:

- the document-specific reset/navigation callback
- a `hasUnsavedChanges` boolean based on meaningful document data

Wired the scaffold-backed native documents:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx` saved/edit scaffold

Dirty checks intentionally ignore automatic defaults such as today dates, base currency, and placeholder blank rows where possible. They count actual entered document data such as party/source selection, line item content, notes, references, settlement rows, queued attachments, and edit-field differences.

Known scaffold coverage boundary:

- Quotation remains the documented page-local exclusion from `DocumentDetailScaffold`.
- Purchase Return create is still page-local; its saved/edit view uses the scaffold and is covered.
- Those outliers should be handled by a scaffold adoption slice before adding any one-off New-button behavior.

## End-User View

Users can now open a new clear document directly from the top action tray on scaffold-backed Sales and Purchases document pages.

If the current form contains unsaved entered data, the system warns that opening a new clear form will lose that data and asks for confirmation. If there is no entered data, the new form opens immediately.

## Accounting / Financial Systems Impact

UI workflow only. No changes to posting, vouchers, ledger entries, tax calculation, AR/AP balances, inventory valuation, settlement posting, approval, period-lock behavior, audit records, DTO contracts, repositories, or backend use cases.

## Verification

- `npm --prefix frontend run typecheck` passed.

## Docs Updated

- `docs/architecture/document-scaffold.md`
- `docs/user-guide/sales/README.md`
- `docs/user-guide/purchases/README.md`

## Follow-Up

Run manual QA in Classic and Windows mode:

- New form from blank create page should reset without warning.
- New form from dirty create/edit page should show the warning modal.
- Confirm opens a clear form.
- Cancel keeps the current form and entered data.
- Posted/read-only views should open a new form without warning.
