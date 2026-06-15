# 231 — Journaled Stock Transfer Costing Fix

**Date:** 2026-06-15  
**Status:** Complete  
**Decision source:** `planning/briefs/20260615-journaled-stock-transfer-costing.md`  
**Actual time spent:** ~2.4h

## Technical Developer View

Implemented the approved stock-transfer costing decision. The old automatic `uplift = IN value - OUT value` rule is removed from transfer GL posting. A transfer can now create value beyond source cost only from an explicit line input:

- `addedCostBaseAtTransfer` / `addedCostCCYAtTransfer` posts inventory delta against `defaultInventoryTransferClearingAccountId`.
- `revaluationUnitCostBaseAtTransfer` / `revaluationUnitCostCCYAtTransfer` posts inventory delta against the new dedicated `defaultInventoryRevaluationAccountId`.
- Plain/journaled transfers move at the source carrying cost and do not post a value delta in the current single inventory-control-account model.
- Zero-cost source transfers move at zero unless explicitly revalued.

Key files changed for this fix:

- `backend/src/application/inventory/use-cases/StockTransferUseCases.ts`
- `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts`
- `backend/src/domain/inventory/entities/StockTransfer.ts`
- `backend/src/domain/inventory/entities/InventorySettings.ts`
- `backend/src/api/dtos/InventoryDTOs.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/api/validators/inventory.validators.ts`
- `backend/src/infrastructure/prisma/repositories/inventory/PrismaStockTransferRepository.ts`
- `frontend/src/api/inventoryApi.ts`
- `frontend/src/modules/inventory/pages/InventorySettingsPage.tsx`
- `frontend/src/modules/inventory/pages/StockTransfersPage.tsx`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/README.md`
- Inventory regression tests under `backend/src/tests/application/inventory/` and `backend/src/tests/domain/inventory/`

Accounting and control notes:

- Source average is not changed by the transfer OUT leg.
- GLOBAL pure transfers leave the global average unchanged; the old empty-position override fallback is neutralized.
- Negative-stock enforcement remains on the source OUT leg in both WAREHOUSE and GLOBAL costing.
- Inventory Gain/Loss accounts are not reused for transfer revaluation.
- Sales, Purchases, and Stock Adjustment posting were not intentionally changed.

## End-User View

Stock transfers are now safer and clearer:

- A normal warehouse transfer simply moves stock at the current cost.
- Freight/customs/handling can be added only as an explicit added transfer cost.
- If the item cost itself must change, the transfer must explicitly revalue it.
- The system no longer guesses extra value from the difference between outgoing and incoming transfer cost.
- Zero-cost stock transfers at zero unless the user deliberately revalues it.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/inventory/StockTransferValuedVoucher.test.ts backend/src/tests/application/inventory/RecordStockMovementUseCase.test.ts backend/src/tests/application/inventory/GlobalCostingEngine.test.ts backend/src/tests/application/inventory/NegativeStockEnforcement.test.ts backend/src/tests/domain/inventory/InventorySettings.test.ts` — passed, 45 tests.
- `npm --prefix backend test -- --runInBand backend/src/tests/application/inventory backend/src/tests/domain/inventory` — passed, 13 suites / 76 tests.
- `npm --prefix backend run build` — passed; compiled `lib/` updated.
- `npm --prefix frontend run typecheck` — passed.
- Compiled-`lib` Firestore emulator round-trip — passed. Isolated company `cmp_cost_smoke_mqeik949`, transfer `745a7cbd-fafc-41cd-87d4-e2dd714ccaca`: OUT unit cost 10, IN unit cost 15, source average 10, destination average 15.

## Acceptance Criteria

- Stock transfer value beyond source cost no longer posts from inferred `IN - OUT`.
- Added cost posts only from explicit added-cost input to Transfer Clearing.
- Revaluation posts only from explicit revaluation input to the dedicated Inventory Revaluation account.
- Pure transfers do not change WAREHOUSE source average or GLOBAL average.
- Negative-stock transfer guard is covered in both costing bases.
- Zero-cost source transfer at zero creates no phantom value.

## Known Follow-Ups

- The current UI labels the valued line input as a landed/revaluation cost. A fuller post-pilot UX should split the form into explicit Plain, Added Cost, and Revaluation modes so users cannot confuse freight with value correction.
- The emulator smoke intentionally used accounting disabled for the transfer, then relied on focused voucher unit tests for GL line verification. A future full GP02 fresh-tenant run should include the accounting-enabled UI path once Financial Approval settings are set for QA.
