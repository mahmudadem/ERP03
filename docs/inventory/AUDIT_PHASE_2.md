# Phase 2 Audit Report — Enhanced Inventory

## Date: 2026-03-07 23:23

## Task 2A: Stock Transfers
- Use cases created: `CreateStockTransferUseCase`, `CompleteStockTransferUseCase`, `ListStockTransfersUseCase`
- API endpoints added: `POST /api/inventory/transfers`, `POST /api/inventory/transfers/:id/complete`, `GET /api/inventory/transfers`
- Frontend page created: YES (`frontend/src/modules/inventory/pages/StockTransfersPage.tsx`)
- Transfer create → complete lifecycle tested: Build/test pass; API/UI wiring complete (no separate live manual transfer run in this phase)
- Paired movements verified: `CompleteStockTransferUseCase` passes `StockTransfer.transferPairId` into `processTRANSFER`; transfer detail view shows paired movements by `referenceType=STOCK_TRANSFER` + `referenceId`

## Task 2B: Returns
- ProcessReturnUseCase created: YES (`backend/src/application/inventory/use-cases/ReturnUseCases.ts`)
- SALES_RETURN test: Implemented with `processIN`, `movementType='RETURN_IN'`, `reversesMovementId` set to `originalMovementId`; cost sourced from original movement when available
- PURCHASE_RETURN test: Implemented with `processOUT`, `movementType='RETURN_OUT'`, `reversesMovementId` set; forced OUT cost uses original movement unit cost when available
- Fallback when original movement missing: Uses current `StockLevel` average cost (`avgCostBase/avgCostCCY`) and logs warning; does not crash

## Task 2C: Period Snapshots
- InventoryPeriodSnapshot entity created: YES (`backend/src/domain/inventory/entities/InventoryPeriodSnapshot.ts`)
- Repository + Firestore impl created: YES (`IInventoryPeriodSnapshotRepository` + `FirestoreInventoryPeriodSnapshotRepository`), DI + mapper wired
- CreatePeriodSnapshotUseCase: Creates/overwrites snapshot from current `StockLevel` set for `periodKey`
- GetAsOfValuationUseCase: Implemented snapshot + delta replay and no-snapshot full replay path
- As-of accuracy: Replay logic implemented; no separate oracle comparison script added

## Task 2D: Dashboard + Reports
- Dashboard KPIs: `totalInventoryValueBase`, `totalTrackedItems`, `totalStockLevels`, `lowStockAlerts`, `negativeStockCount`, `unsettledMovementsCount`, `recentMovements`
- Low stock alerts: Implemented (`qtyOnHand < minStockLevel`) and includes negative stock rows
- Unsettled costs report: Implemented using `costSettled=false` movements with pagination + item filter
- InventoryHomePage updated: YES (real dashboard endpoint + KPI cards + recent movements table)
- New pages created: `StockTransfersPage.tsx`, `LowStockAlertsPage.tsx`, `UnsettledCostsPage.tsx`

## Compile & Test
- Backend tsc: PASS (`npx tsc --noEmit`)
- vitest: 16 passed / 16 total (`npx vitest run backend/src/tests/application/inventory/`)
- Frontend tsc: PASS (`npx tsc --noEmit`)
- Frontend build: PASS (`npm run build`)

## New Test Cases Added
- None in this phase (existing inventory test suite remains passing)

## Deviations from Spec
- As-of delta selection uses `movement.postedAt > snapshot.createdAt` for snapshot delta replay instead of a single global `postingSeq` cutoff, because `postingSeq` in current schema is per `(itemId, warehouseId)` stock level, not globally monotonic.
