# Task 203 — Shared Line Table UOM and Settings Polish

**Date:** 2026-06-10  
**Agent:** Codex  
**Time spent:** ~1.8h  

## Technical Developer View

### What changed

- Updated `frontend/src/components/shared/ClassicLineItemsTable.tsx`:
  - empty working-row numeric zero placeholders now render blank until the row has real business content
  - table settings now include table font selection
  - table settings now include Line Color 1 and Line Color 2 selectors for alternating row colors
  - Apex/app font (`Inter` through the app font variable) is the default table font; system and mono remain available
- Added shared selector `frontend/src/components/shared/selectors/UomSelector.tsx` and exported it from the selectors index.
- Replaced page-local UOM dropdown/free-text cells with `UomSelector` in:
  - Sales Invoice
  - Sales Order
  - Delivery Note
  - Quotation
  - Purchase Invoice
  - Purchase Order
  - Goods Receipt
  - Purchase Return
- Restored missing Sales Invoice rail compatibility symbols that were blocking frontend typecheck in the touched file.

### Architecture / workflow effect

The UOM selector is item-scoped. It loads the selected item's base, sales, purchase, and active conversion UOMs through existing inventory APIs. It does not create UOMs from document lines. The modal includes a refresh button and an item-card link for maintaining the item's UOM setup.

### Files changed

- `frontend/src/components/shared/ClassicLineItemsTable.tsx`
- `frontend/src/components/shared/selectors/UomSelector.tsx`
- `frontend/src/components/shared/selectors/index.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx`
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx`
- `frontend/src/modules/sales/pages/QuotationDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx`
- `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`
- `docs/architecture/document-scaffold.md`
- `docs/user-guide/sales/README.md`
- `docs/user-guide/purchases/README.md`
- `planning/done/203-shared-line-table-uom-and-settings.md`

### Accounting boundary

UI/data-entry only. No posting logic, tax logic, AR/AP settlement, inventory valuation, UOM conversion math, stock movement calculation, approval, period-lock, audit, backend DTO, repository, or ledger behavior changed.

### Verification

- `npm --prefix frontend run typecheck` — passed

## End-User View

Native Sales and Purchases document line tables are cleaner and more controlled:

- blank new rows no longer show distracting `0` placeholders in numeric cells
- table settings let users choose table font and the two alternating line colors
- UOM cells default from the selected item
- users can edit a UOM by typing or opening the picker
- if one item UOM matches, it is selected directly
- if more than one UOM matches, a popup lets the user choose from that item's defined UOMs
- the popup has a refresh button and an item-card link for maintaining item UOM setup

Users cannot create new UOMs directly from document lines. This protects item setup and inventory controls.

## Manual QA Needed

- In Classic and Windows mode, test editable line UOM behavior on Sales Invoice, Sales Order, Delivery Note, Quotation, Purchase Invoice, Purchase Order, Goods Receipt, and Purchase Return.
- Confirm blank numeric cells remain blank on untouched empty rows and show zero only after row content exists.
- Open table settings from the `#` header and verify table font plus Line Color 1 / Line Color 2 persist per table.
