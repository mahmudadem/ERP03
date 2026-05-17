# Phase 2 — Enhanced Inventory — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phase 1 is complete and audited. The following already exist and should NOT be reimplemented:
- `RecordStockMovementUseCase.processIN/processOUT/processTRANSFER` — fully working
- `StockTransfer` entity — `backend/src/domain/inventory/entities/StockTransfer.ts`
- `IStockTransferRepository` + `FirestoreStockTransferRepository` — already registered in DI
- All Phase 1 entities, repos, mappers, controller, routes, frontend pages

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\inventory\MASTER_PLAN.md`
2. `d:\DEV2026\ERP03\docs\inventory\SCHEMAS.md` — StockTransfer schema in §9
3. `d:\DEV2026\ERP03\docs\inventory\ALGORITHMS.md` — processTRANSFER in §4
4. `d:\DEV2026\ERP03\docs\inventory\PHASES.md` — Phase 2 section

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`. All DB access goes through repository interfaces + `ITransactionManager`.

---

## TASK 2A: Stock Transfer Use Cases + API + UI

### What to implement
The `processTRANSFER` algorithm already exists in `RecordStockMovementUseCase`. You need the orchestration layer.

**Use Cases** — NEW file `backend/src/application/inventory/use-cases/StockTransferUseCases.ts`:

```
CreateStockTransferUseCase:
  - Validate source/dest warehouses exist and are different
  - Validate all line items exist and have trackInventory=true
  - Create StockTransfer document with status='DRAFT'
  - Save to IStockTransferRepository

CompleteStockTransferUseCase:
  - Load StockTransfer document (must be DRAFT)
  - For each line:
    - Call RecordStockMovementUseCase.processTRANSFER(...)
    - The shared transferPairId comes from StockTransfer.transferPairId
  - Update StockTransfer.status = 'COMPLETED', completedAt = now
  - Save updated document
  - All movements in a single transaction if possible (use transactionManager)

ListStockTransfersUseCase:
  - Query by companyId, optionally filter by status, paginated
```

**API Endpoints** — Add to `backend/src/api/routes/inventory.routes.ts`:
```
POST   /api/inventory/transfers              → createTransfer
POST   /api/inventory/transfers/:id/complete  → completeTransfer
GET    /api/inventory/transfers              → listTransfers
```

Add corresponding handlers to `InventoryController.ts`.

**Frontend** — NEW file `frontend/src/modules/inventory/pages/StockTransfersPage.tsx`:
- List of transfers with status filter (DRAFT / COMPLETED)
- Create transfer form: select source/dest warehouse, add line items (item + qty)
- Complete button on DRAFT transfers
- Show transfer details (paired movements after completion)

Add to `frontend/src/api/inventoryApi.ts`:
```typescript
createTransfer(payload): Promise<StockTransferDTO>
completeTransfer(id: string): Promise<StockTransferDTO>
listTransfers(status?: string): Promise<StockTransferDTO[]>
```

Add route `/inventory/transfers` to `routes.config.ts`.

---

## TASK 2B: Returns Processing

### What to implement

**Use Case** — NEW file `backend/src/application/inventory/use-cases/ReturnUseCases.ts`:

```
ProcessReturnUseCase:
  Input: {
    companyId, itemId, warehouseId, qty, date,
    returnType: 'SALES_RETURN' | 'PURCHASE_RETURN',
    originalMovementId: string,  // the movement being reversed
    moveCurrency, fxRateMovToBase, fxRateCCYToBase,
    currentUser
  }

  Logic:
    1. Load the original movement by originalMovementId
    2. Validate: original must exist, same item, same warehouse
    3. Determine return cost:
       - Use original movement's unitCostBase/unitCostCCY
       - Fallback: if no original movement found, use current avgCost
    4. For SALES_RETURN (customer returns goods to us):
       - Call processIN with movementType='RETURN_IN', reversesMovementId=originalMovementId
       - costSource='RETURN'
    5. For PURCHASE_RETURN (we return goods to supplier):
       - Call processOUT with movementType='RETURN_OUT', reversesMovementId=originalMovementId
       - costSource='RETURN'
    6. Return the created movement
```

**API Endpoint** — Add to routes:
```
POST   /api/inventory/movements/return    → processReturn
```

**No separate frontend page needed** — returns will be triggered from Sales/Purchase modules later. But add the API client function to `inventoryApi.ts`.

---

## TASK 2C: Period Snapshots + As-Of Valuation

### What to implement

**Entity** — NEW `backend/src/domain/inventory/entities/InventoryPeriodSnapshot.ts`:
```typescript
interface InventoryPeriodSnapshotProps {
  id: string;                    // e.g., '{companyId}_{yearMonth}'
  companyId: string;
  periodKey: string;             // e.g., '2026-03'
  periodEndDate: string;         // e.g., '2026-03-31'
  snapshotData: Array<{
    itemId: string;
    warehouseId: string;
    qtyOnHand: number;
    avgCostBase: number;
    avgCostCCY: number;
    lastCostBase: number;
    lastCostCCY: number;
    valueBase: number;           // qtyOnHand × avgCostBase
  }>;
  totalValueBase: number;
  totalItems: number;
  createdAt: Date;
}
```

**Repository** — `IInventoryPeriodSnapshotRepository` (interface) + Firestore implementation.
Firestore path: `companies/{companyId}/inventory/Data/period_snapshots/{id}`.

**Use Cases** — NEW `backend/src/application/inventory/use-cases/PeriodSnapshotUseCases.ts`:
```
CreatePeriodSnapshotUseCase:
  - Accept: companyId, periodKey (e.g., '2026-03')
  - Load ALL StockLevels for companyId
  - Build snapshot array from current levels
  - Save as InventoryPeriodSnapshot
  - Idempotent: if snapshot for this period exists, overwrite it

GetAsOfValuationUseCase:
  - Accept: companyId, asOfDate (e.g., '2026-03-15')
  - Find nearest snapshot with periodEndDate <= asOfDate
  - If no snapshot found, replay ALL movements (slow but correct)
  - If snapshot found, load it + query all movements with postingSeq > snapshot's last postingSeq
  - Replay deltas to compute as-of valuation
  - Return: per-item valuation at that date
```

**API Endpoints:**
```
POST   /api/inventory/snapshots           → createSnapshot (admin action)
GET    /api/inventory/valuation/as-of     → getAsOfValuation (query: ?date=2026-03-15)
```

---

## TASK 2D: Dashboard KPIs + Reports

### What to implement

**Use Case** — NEW `backend/src/application/inventory/use-cases/DashboardUseCases.ts`:
```
GetInventoryDashboardUseCase:
  Returns:
    - totalInventoryValueBase: SUM(qtyOnHand × avgCostBase) across all StockLevels
    - totalTrackedItems: COUNT of items with trackInventory=true
    - totalStockLevels: COUNT of StockLevel records
    - lowStockAlerts: COUNT where qtyOnHand < item.minStockLevel (join Item + StockLevel)
    - negativeStockCount: COUNT where qtyOnHand < 0
    - unsettledMovementsCount: COUNT of StockMovements where costSettled=false
    - recentMovements: last 10 movements (sorted by postingSeq DESC)

GetLowStockAlertsUseCase:
  - Load all StockLevels
  - For each, check if qtyOnHand < item.minStockLevel (requires loading items)
  - Also include items with qtyOnHand < 0
  - Return list with: itemId, itemName, warehouseId, qtyOnHand, minStockLevel, deficit

GetUnsettledCostReportUseCase:
  - Query StockMovements where costSettled=false
  - Return: list with movement details, unsettledQty, unsettledCostBasis
  - Paginated
```

**API Endpoints:**
```
GET    /api/inventory/dashboard              → getDashboard
GET    /api/inventory/alerts/low-stock       → getLowStockAlerts
GET    /api/inventory/reports/unsettled-costs → getUnsettledCosts
```

**Frontend** — UPDATE `InventoryHomePage.tsx`:
- Replace any placeholder KPIs with real data from `/dashboard` endpoint
- Show KPI cards: Total Value, Items, Low Stock Alerts, Negative Stock, Unsettled
- Click low-stock alerts → navigate to low stock page
- Show recent movements table

**Frontend** — NEW `frontend/src/modules/inventory/pages/LowStockAlertsPage.tsx`:
- Table: item, warehouse, current qty, min level, deficit
- Color-coded rows (red for negative, yellow for low)

**Frontend** — NEW `frontend/src/modules/inventory/pages/UnsettledCostsPage.tsx`:
- Table: movement date, item, warehouse, qty, unsettled qty, cost basis
- Filter by item

Add routes to `routes.config.ts`:
- `/inventory/alerts/low-stock`
- `/inventory/reports/unsettled-costs`

---

## Verification

After ALL tasks are done:

```bash
# Backend compile
cd d:\DEV2026\ERP03\backend && npx tsc --noEmit

# Unit tests (existing + new)
npx vitest run backend/src/tests/application/inventory/

# Frontend compile + build
cd d:\DEV2026\ERP03\frontend && npx tsc --noEmit && npm run build
```

ALL must pass.

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\inventory\AUDIT_PHASE_2.md`:

```markdown
# Phase 2 Audit Report — Enhanced Inventory

## Date: [YYYY-MM-DD HH:MM]

## Task 2A: Stock Transfers
- Use cases created: [list]
- API endpoints added: [3 endpoints — list]
- Frontend page created: [YES/NO]
- Transfer create → complete lifecycle tested: [result]
- Paired movements verified: [transferPairId match, costs match]

## Task 2B: Returns
- ProcessReturnUseCase created: [YES/NO]
- SALES_RETURN test: [original cost used, direction=IN, reversesMovementId set]
- PURCHASE_RETURN test: [original cost used, direction=OUT, reversesMovementId set]
- Fallback when original movement missing: [behavior]

## Task 2C: Period Snapshots
- InventoryPeriodSnapshot entity created: [YES/NO]
- Repository + Firestore impl created: [YES/NO]
- CreatePeriodSnapshotUseCase: [creates snapshot from current levels]
- GetAsOfValuationUseCase: [snapshot + delta replay works]
- As-of accuracy: [compared against full scan — match/mismatch]

## Task 2D: Dashboard + Reports
- Dashboard KPIs: [list what's returned]
- Low stock alerts: [tested with item below minStockLevel]
- Unsettled costs report: [tested with costSettled=false movement]
- InventoryHomePage updated: [YES/NO]
- New pages created: [list]

## Compile & Test
- Backend tsc: [PASS/FAIL]
- vitest: [N passed / N total]
- Frontend tsc: [PASS/FAIL]
- Frontend build: [PASS/FAIL]

## New Test Cases Added
[List any new tests written]

## Deviations from Spec
[List any]
```
