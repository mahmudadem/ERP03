# GP02 Inventory Stabilization Slice

**Date:** 2026-06-13  
**Actual time:** ~1.1h  
**Scope:** Golden Path GP02 stabilization only. This is not a new feature pass.

## Technical Developer View

### What changed

- `backend/src/application/inventory/use-cases/ItemUseCases.ts`
  - Preserves item `metadata` on create.
  - Forces `trackInventory = false` when an item is created or updated as `SERVICE`.
- `backend/src/api/dtos/InventoryDTOs.ts`
  - Returns item `metadata` in `ItemDTO`, so Price Groups reload after save.
- `backend/src/api/validators/inventory.validators.ts`
  - Allows item `metadata` only as a plain object on create/update.
- `backend/src/application/inventory/use-cases/StockAdjustmentUseCases.ts`
  - Stops silently skipping GL voucher creation when accounting is enabled but item mappings are incomplete.
  - Posting now fails with a readable message telling the user to set Inventory Asset and COGS accounts on the item.
- `frontend/src/modules/inventory/components/ItemMasterCard.tsx`
  - SERVICE selection turns stock tracking off and disables the tracking toggle.
- `frontend/src/modules/inventory/pages/StockAdjustmentPage.tsx`
  - Adds visible labels to adjustment inputs.
  - Adds toast feedback for create/post success, no-op adjustments, and API errors.

### Accounting / ERP impact

- Price Groups now persist as item metadata instead of disappearing after save/reopen.
- Service items cannot accidentally become stock-controlled items, which prevents invalid inventory movements for services.
- Stock adjustments no longer produce a dangerous accounting gap where stock posts but the GL voucher is skipped silently.
- The current adjustment voucher still uses the existing item Inventory Asset and COGS mappings. A dedicated inventory gain/loss account model remains a follow-up if the owner wants market-standard adjustment accounts.

### Verification

- `npm --prefix backend run build` passed.
- `npm --prefix backend test` passed: 146 suites passed, 2 skipped; 1,365 tests passed, 18 skipped.
- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed with existing bundle-size/Browserslist warnings.

## End-User View

### What users should see

- In Item Master, Price Groups should stay saved after creating or editing an item.
- When an item is set to `SERVICE`, Stock Control is automatically OFF and cannot be turned ON from the item card.
- Stock Adjustment fields now have clear labels.
- Creating or posting a stock adjustment now shows visible success or error messages.
- If posting an adjustment needs accounting but the item has missing GL mappings, the user receives a clear error instead of thinking the adjustment posted correctly with no ledger effect.

## Remaining GP02 Follow-Ups

- Rerun GP02 manually on a fresh or clean tenant.
- Audit and document the costing model for stock levels by warehouse:
  - Current implementation keeps moving average cost per item + warehouse.
  - Transfers can change destination warehouse average cost because the destination warehouse receives stock at the source warehouse cost.
  - Before changing this behavior, decide whether ERP03 wants global item WAC or warehouse-level WAC and add tests around transfers/opening stock.
- Decide whether to add dedicated Inventory Adjustment Gain/Loss accounts in Inventory Settings.
