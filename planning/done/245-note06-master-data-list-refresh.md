# Task 245 NOTE-06 - Master Data List Refresh After Create

**Date:** 2026-06-19  
**Branch:** `codex/245-note06-master-data-list-refresh`  
**Status:** Complete, PR pending review  
**Actual time spent:** ~1.2h

## Technical Developer View

Task 245 NOTE-06 reported that master-data lists did not refresh after creating records. The fix keeps scope to the affected master-data pages and the shared card-window wrappers:

- Customers and vendors now reload when returning from a saved route card through `masterDataRefreshToken`.
- Customers and vendors in Windows mode now pass the list reload callback into `PartyCardWindow`, which invokes it after save before closing.
- Inventory Items now reload after route-card saves and after Windows-mode item-card saves.
- Warehouses already refreshed in page mode; Windows mode now passes the reload callback into `WarehouseCardWindow`.
- `ItemCardWindow` now accepts the existing `id` fallback and the corrected `itemId` field, preventing item windows opened from the list from losing the selected item id.

No backend APIs, posting paths, tenant scoping, accounting behavior, inventory valuation, tax behavior, or permissions changed.

## End-User View

When a user adds a new customer, vendor, inventory item, or warehouse, the list now updates automatically after saving. Users should not need to press Refresh or leave and re-enter the module just to see the newly created master record.

## Files Changed

- `frontend/src/modules/sales/pages/CustomersListPage.tsx`
- `frontend/src/modules/purchases/pages/VendorsListPage.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
- `frontend/src/modules/inventory/pages/WarehousesPage.tsx`
- `frontend/src/modules/sales/pages/CustomerDetailPage.tsx`
- `frontend/src/modules/purchases/pages/VendorDetailPage.tsx`
- `frontend/src/modules/inventory/pages/ItemDetailPage.tsx`
- `frontend/src/modules/accounting/components/PartyCardWindow.tsx`
- `frontend/src/modules/accounting/components/WarehouseCardWindow.tsx`
- `frontend/src/modules/inventory/components/ItemCardWindow.tsx`
- `docs/architecture/operational-lists.md`
- `docs/user-guide/lists/master-data-list-refresh.md`
- `planning/done/245-note06-master-data-list-refresh.md`

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed.

## Known Issues / Follow-ups

- This task intentionally did not implement the other Task 245 notes.
- Inventory Items still respects active search/type filters after refresh. If the new item does not match the active filter, the user must clear filters to see it.
