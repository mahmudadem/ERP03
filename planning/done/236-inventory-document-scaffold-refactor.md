# Inventory Document Scaffold Refactor

**Date:** 2026-06-17  
**Actual time spent:** ~2.6h  
**Scope:** Stock Adjustments, Opening Stock Documents, Inventory Settings default opening balance account

## Technical Developer View

### What changed

- Rebuilt **Stock Adjustments** as `LIST → FORM/DETAIL`:
  - `/inventory/adjustments`
  - `/inventory/adjustments/new`
  - `/inventory/adjustments/:id`
- Rebuilt **Opening Stock Documents** as `LIST → FORM/DETAIL`:
  - `/inventory/opening-stock`
  - `/inventory/opening-stock/new`
  - `/inventory/opening-stock/:id`
- Both list pages now use `OperationalListLayout` with status tabs, search, pagination, sorting, and row actions.
- Both form/detail pages now use `DocumentDetailScaffold`, matching the Sales Invoice document shell with:
  - control section
  - compact header section
  - shared `ClassicLineItemsTable`
  - side rail info/readiness/totals
  - sticky footer actions
  - Windows-mode rail drawer awareness
- Moved Opening Stock **Create Accounting Effect** into the scaffold `control` section as requested.
- Added `InventorySettings.defaultOpeningBalanceAccountId` so Opening Stock Documents can prefill the Opening Balance / Clearing Account from Inventory Settings while still allowing per-document override.
- Backend posting validation is unchanged: Opening Stock accounting-effect documents still require an active posting EQUITY account.

### Files changed

- `frontend/src/modules/inventory/pages/StockAdjustmentPage.tsx`
- `frontend/src/modules/inventory/pages/OpeningStockPage.tsx`
- `frontend/src/modules/inventory/pages/InventorySettingsPage.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/api/inventoryApi.ts`
- `backend/src/domain/inventory/entities/InventorySettings.ts`
- `backend/src/api/dtos/InventoryDTOs.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/api/validators/inventory.validators.ts`
- `backend/src/application/inventory/use-cases/InitializeInventoryUseCase.ts`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/stock-adjustments-and-transfers.md`
- `docs/user-guide/inventory/README.md`

### Accounting and control impact

- No stock costing math, movement posting, voucher posting, or ledger validation was changed.
- The new settings field is a safer default source for Opening Stock offset accounts. It prevents the UI from inventing a default from unrelated COGS/gain/loss/clearing accounts.
- Users can override the default per document, but the backend still blocks non-EQUITY offsets.
- Stock Adjustments remain list/new/detail/post only because the current API does not support draft update/delete for adjustments.

### Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix backend run build` passed.
- `npm --prefix frontend run build` passed, including report/no-confirm/SoD checks. Existing browser-data, Firebase auth chunking, SalesInvoice dynamic/static import, and large chunk warnings remain.

### Not verified

- Browser visual QA is still needed for:
  - `/inventory/adjustments`
  - `/inventory/adjustments/new`
  - `/inventory/opening-stock`
  - `/inventory/opening-stock/new`
  - opening-stock accounting-effect default/override behavior
- Browser visual QA was not run in this pass.

## End-User View

Inventory document pages now behave like other ERP document pages:

- Open a list first.
- Click **New** to open the document form.
- Review status, readiness, and totals in the side rail.
- Save drafts and post only when reviewed.

For Opening Stock, the accounting choice is clearer. The **Create Accounting Effect** control is at the top of the form. If Accounting is enabled and the user chooses **Yes**, the account is filled from Inventory Settings. The user can override it, but the system only accepts an equity-style opening balance account.

## Follow-ups

- Browser-check list/form layout in web and Windows modes.
- Decide later whether Stock Adjustments should gain DRAFT update/delete parity like Opening Stock and Stock Transfers.
