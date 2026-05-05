# 61 — Inventory Transaction Safety (Final Two Use Cases)

**Date:** 2026-05-02  
**Owner:** Codex (CTO Mode)  
**Status:** ✅ Complete

## Technical Developer View

### What was implemented

Completed Firestore-safe transaction structure for the remaining Inventory posting paths:

1. `PostStockAdjustmentUseCase`
- Added prefetch of stock levels before transaction execution.
- Added prefetch of item context and base currency before transaction execution.
- Created missing stock-level domain objects before transaction execution.
- Passed `preFetchedItem`, `baseCurrency`, and `preFetchedLevel` into movement processing to avoid transactional reads.
- Enabled IN flow warehouse validation bypass in movement use case for prevalidated context.
- Passed `baseCurrencyOverride` and `skipAccountValidation` to GL posting so stock adjustment accounting does not read inside the transaction.

2. `CompleteStockTransferUseCase`
- Added prefetch of item + source/destination stock levels before transaction execution.
- Created missing source/destination stock-level domain objects before transaction execution.
- Passed pre-fetched transfer context into movement processing to avoid transactional reads.
- Moved transfer status update (`COMPLETED`, `completedAt`, line transfer costs) into the same transaction that writes stock movements/levels.

3. Movement and repository contracts
- `RecordStockMovementUseCase`:
  - Added `skipWarehouseValidation` to `ProcessINInput`.
  - Added `preFetchedItem` and `baseCurrency` to `ProcessINInput`.
  - Added `preFetchItemContext()` helper.
  - Added `preFetchedItem`, `preFetchedSourceLevel`, `preFetchedDestinationLevel`, `skipWarehouseValidation` to `ProcessTRANSFERInput`.
- `IStockTransferRepository.updateTransfer` now accepts optional `transaction`.
- Updated Firestore and Prisma stock transfer repositories to apply transactional update when transaction context is provided.

### Files changed

- `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts`
- `backend/src/application/inventory/use-cases/StockAdjustmentUseCases.ts`
- `backend/src/application/inventory/use-cases/StockTransferUseCases.ts`
- `backend/src/repository/interfaces/inventory/IStockTransferRepository.ts`
- `backend/src/infrastructure/firestore/repositories/inventory/FirestoreStockTransferRepository.ts`
- `backend/src/infrastructure/prisma/repositories/inventory/PrismaStockTransferRepository.ts`
- `backend/src/api/controllers/inventory/InventoryController.ts`
- `backend/src/tests/application/inventory/StockAdjustmentAtomicity.test.ts`

### What was tested

- `npm test -- --runTestsByPath src/tests/application/inventory/StockAdjustmentAtomicity.test.ts` (backend)
- `npm test -- --runTestsByPath src/tests/application/inventory/StockAdjustmentAtomicity.test.ts src/tests/application/sales/SalesPaymentSyncUseCases.test.ts src/tests/application/purchases/PurchasePaymentSyncUseCases.test.ts` (backend)
- `npm run build` (backend)
- `npm run build` (frontend)

### Acceptance criteria met

- Inventory stock adjustment posting no longer depends on transactional stock-level reads when prefetch data exists.
- Inventory stock adjustment posting no longer reads item/company/base-currency/account data inside the transaction callback.
- Inventory stock transfer completion updates stock movements, stock levels, and transfer document completion state atomically.
- Backend compiles successfully after contract changes.

### Known issues / follow-ups

- `RecordStockMovementUseCase.test.ts` still has pre-existing interface mismatch (`hasAnyMovements`) unrelated to this task.

## End-User View

Inventory posting operations are now more reliable and less likely to fail due to transaction ordering rules. Stock adjustments and stock transfers now complete as a single consistent action, which reduces the risk of partial updates where stock moves but the transfer document status does not.
