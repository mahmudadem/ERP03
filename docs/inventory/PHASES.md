# Inventory Module — Phased Delivery Plan

> **Status:** LOCKED  
> **Prerequisites:** Read [MASTER_PLAN.md](./MASTER_PLAN.md), [SCHEMAS.md](./SCHEMAS.md), [ALGORITHMS.md](./ALGORITHMS.md)

---

## Phase 0 — Bug Fixes & Design Lock Confirmation (≈ 2 days)

### Scope
Apply the 5 confirmed bug fixes (B1–B5) to the algorithms and entity definitions. These are not code fixes on existing implementations yet (the stubs have no cost logic) — they are **schema and algorithm lock confirmations** that must be verified in the entity constructors and use-case pseudocode before any implementation begins.

### Deliverables

| ID | Fix | Files Affected | Acceptance Criteria |
|----|-----|---------------|---------------------|
| B1 | Backdating flag ordering | `StockMovement` entity, `RecordMovementUseCase` | `isBackdated` is computed from `oldMaxBusinessDate` before `maxBusinessDate` is updated. Unit test: post movement with `date < maxBusinessDate` → `isBackdated = true`. |
| B2 | OUT FX rate division by zero | `RecordMovementUseCase` (processOUT) | Guard `unitCostCCY > 0` before dividing. `fxRateKind = 'EFFECTIVE'` on OUT. Unit test: OUT when `avgCostCCY = 0` → `fxRateCCYToBase = 1.0`, no crash. |
| B3 | Transfer uses OUT cost rules at source | `RecordMovementUseCase` (processTRANSFER) | Transfer from source with `qtyBefore <= 0` uses `lastCost` (or MISSING). Unit test: transfer from empty warehouse → uses `lastCostBase`. |
| B4 | Sell before any IN → flagged | `RecordMovementUseCase` (processOUT) | When `qtyBefore <= 0` and `lastCostBase = 0`: `costBasis = 'MISSING'`, `costSettled = false`. Unit test: first-ever OUT → `unsettledCostBasis = 'MISSING'`. |
| B5 | Partial settlement persisted | `StockMovement` entity, `RecordMovementUseCase` | OUT: `settledQty`, `unsettledQty`, `costSettled` stored correctly. IN: `settlesNegativeQty`, `newPositiveQty` stored. Unit tests: OUT crossing zero (qtyBefore=2, qty=5 → settled=2, unsettled=3). |

### Tests Required
- Unit tests for `StockMovement` entity constructor (validates field presence based on direction)
- Unit tests for `StockLevel` entity (validates `postingSeq` increment, `maxBusinessDate` monotonic update)
- Unit tests for cost calculation functions (all 3 conversion paths)

---

## Phase 1 — Inventory MVP (≈ 3 weeks)

### Scope
Full implementation of Item master data, warehouses, categories, UoM conversions, stock movements (IN/OUT/ADJUST), stock levels, and basic reports. This is the core operational inventory.

### 1.1  Domain Entities

| Entity | File | Status |
|--------|------|--------|
| `Item` | `domain/inventory/entities/Item.ts` | REWRITE from stub |
| `Warehouse` | `domain/inventory/entities/Warehouse.ts` | EXPAND from stub |
| `StockMovement` | `domain/inventory/entities/StockMovement.ts` | REWRITE from stub |
| `StockLevel` | `domain/inventory/entities/StockLevel.ts` | NEW |
| `ItemCategory` | `domain/inventory/entities/ItemCategory.ts` | NEW |
| `UomConversion` | `domain/inventory/entities/UomConversion.ts` | NEW |
| `InventorySettings` | `domain/inventory/entities/InventorySettings.ts` | NEW |
| `StockAdjustment` | `domain/inventory/entities/StockAdjustment.ts` | NEW |

### 1.2  Repository Interfaces

| Repository | File | Status |
|-----------|------|--------|
| `IItemRepository` | `repository/interfaces/inventory/IItemRepository.ts` | EXPAND |
| `IWarehouseRepository` | `repository/interfaces/inventory/IWarehouseRepository.ts` | EXPAND |
| `IStockMovementRepository` | `repository/interfaces/inventory/IStockMovementRepository.ts` | REWRITE |
| `IStockLevelRepository` | `repository/interfaces/inventory/IStockLevelRepository.ts` | NEW |
| `IItemCategoryRepository` | `repository/interfaces/inventory/IItemCategoryRepository.ts` | NEW |
| `IUomConversionRepository` | `repository/interfaces/inventory/IUomConversionRepository.ts` | NEW |
| `IInventorySettingsRepository` | `repository/interfaces/inventory/IInventorySettingsRepository.ts` | NEW |
| `IStockAdjustmentRepository` | `repository/interfaces/inventory/IStockAdjustmentRepository.ts` | NEW |

### 1.3  Firestore Implementations

| File | Status |
|------|--------|
| `infrastructure/firestore/repositories/inventory/FirestoreItemRepository.ts` | REWRITE |
| `infrastructure/firestore/repositories/inventory/FirestoreWarehouseRepository.ts` | REWRITE |
| `infrastructure/firestore/repositories/inventory/FirestoreStockMovementRepository.ts` | NEW (split from combined file) |
| `infrastructure/firestore/repositories/inventory/FirestoreStockLevelRepository.ts` | NEW |
| `infrastructure/firestore/repositories/inventory/FirestoreItemCategoryRepository.ts` | NEW |
| `infrastructure/firestore/repositories/inventory/FirestoreUomConversionRepository.ts` | NEW |
| `infrastructure/firestore/repositories/inventory/FirestoreInventorySettingsRepository.ts` | NEW |
| `infrastructure/firestore/repositories/inventory/FirestoreStockAdjustmentRepository.ts` | NEW |
| `infrastructure/firestore/mappers/InventoryMappers.ts` | REWRITE |

### 1.4  Use Cases

| Use Case | File | Description |
|----------|------|-------------|
| `CreateItemUseCase` | `application/inventory/use-cases/ItemUseCases.ts` | REWRITE: validate code uniqueness, costCurrency validation, category defaults |
| `UpdateItemUseCase` | Same file | EXPAND: block costCurrency change if movements exist |
| `ListItemsUseCase` | Same file | EXPAND: add filters (type, category, active) |
| `GetItemUseCase` | Same file | Add single-item fetch |
| `CreateWarehouseUseCase` | `application/inventory/use-cases/WarehouseUseCases.ts` | EXPAND |
| `ManageCategoriesUseCase` | `application/inventory/use-cases/CategoryUseCases.ts` | NEW |
| `ManageUomConversionsUseCase` | `application/inventory/use-cases/UomConversionUseCases.ts` | NEW |
| **`RecordStockMovementUseCase`** | `application/inventory/use-cases/RecordStockMovementUseCase.ts` | **NEW — THE CORE**: implements processIN/processOUT from ALGORITHMS.md |
| `CreateStockAdjustmentUseCase` | `application/inventory/use-cases/StockAdjustmentUseCases.ts` | NEW: creates adjustment + movements + GL voucher |
| `GetStockLevelsUseCase` | `application/inventory/use-cases/StockLevelUseCases.ts` | NEW |
| `GetMovementHistoryUseCase` | `application/inventory/use-cases/MovementHistoryUseCases.ts` | NEW: paginated, filtered |
| `InitializeInventoryUseCase` | `application/inventory/use-cases/InitializeInventoryUseCase.ts` | NEW: set up InventorySettings, default warehouse |
| `ReconcileStockUseCase` | `application/inventory/use-cases/ReconcileStockUseCase.ts` | NEW: verify StockLevel vs SUM(movements) |

### 1.5  API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/inventory/initialize` | Initialize module settings |
| GET | `/api/inventory/settings` | Get settings |
| PUT | `/api/inventory/settings` | Update settings |
| POST | `/api/inventory/items` | Create item |
| GET | `/api/inventory/items` | List items (filtered/paginated) |
| GET | `/api/inventory/items/:id` | Get item |
| PUT | `/api/inventory/items/:id` | Update item |
| DELETE | `/api/inventory/items/:id` | Deactivate item |
| GET | `/api/inventory/items/search` | Search items |
| POST | `/api/inventory/categories` | Create category |
| GET | `/api/inventory/categories` | List categories (tree) |
| PUT | `/api/inventory/categories/:id` | Update category |
| DELETE | `/api/inventory/categories/:id` | Deactivate category |
| POST | `/api/inventory/warehouses` | Create warehouse |
| GET | `/api/inventory/warehouses` | List warehouses |
| PUT | `/api/inventory/warehouses/:id` | Update warehouse |
| POST | `/api/inventory/uom-conversions` | Create UoM conversion |
| GET | `/api/inventory/uom-conversions/:itemId` | List conversions for item |
| GET | `/api/inventory/stock-levels` | All stock levels (filtered) |
| GET | `/api/inventory/stock-levels/:itemId` | Stock by item (all warehouses) |
| GET | `/api/inventory/movements` | Movement history (paginated) |
| GET | `/api/inventory/movements/:itemId` | Movements for item |
| POST | `/api/inventory/movements/opening` | Record opening stock |
| POST | `/api/inventory/adjustments` | Create stock adjustment |
| GET | `/api/inventory/adjustments` | List adjustments |
| POST | `/api/inventory/adjustments/:id/post` | Post adjustment (creates movements + GL voucher) |
| GET | `/api/inventory/valuation` | Current inventory valuation report |
| POST | `/api/inventory/reconcile` | Run reconciliation check |

### 1.6  Frontend Pages

| Page | File | Description |
|------|------|-------------|
| Inventory Home | `modules/inventory/pages/InventoryHomePage.tsx` | Module landing with dashboard KPIs |
| Items List | `modules/inventory/pages/ItemsListPage.tsx` | EXPAND: add filters, cost columns |
| Item Detail | `modules/inventory/pages/ItemDetailPage.tsx` | NEW: tabbed form (General, Cost, Accounting, Stock) |
| Categories | `modules/inventory/pages/CategoriesPage.tsx` | NEW: tree view |
| Warehouses | `modules/inventory/pages/WarehousesPage.tsx` | NEW |
| Stock Levels | `modules/inventory/pages/StockLevelsPage.tsx` | NEW: grid with color-coded alerts |
| Movement History | `modules/inventory/pages/StockMovementsPage.tsx` | NEW: filtered table |
| Stock Adjustment | `modules/inventory/pages/StockAdjustmentPage.tsx` | NEW: adjustment form |
| Opening Stock | `modules/inventory/pages/OpeningStockPage.tsx` | NEW: bulk entry form |

### 1.7  Tests Required

#### Unit Tests
- `Item.spec.ts` — constructor validation, costCurrency immutability guard
- `StockMovement.spec.ts` — field validation per direction (OUT-specific, IN-specific)
- `StockLevel.spec.ts` — postingSeq increment, version increment, maxBusinessDate monotonic
- `RecordStockMovementUseCase.spec.ts`:
  - IN: normal positive stock → weighted average
  - IN: zero stock → cost reset
  - IN: negative stock → settlesNegativeQty computed, avg reset
  - OUT: positive stock → uses avgCost, settled=true
  - OUT: partial zero-cross → settledQty/unsettledQty split correct
  - OUT: zero stock → uses lastCost, costSettled=false
  - OUT: no cost at all → costBasis='MISSING'
  - Backdating: movement.date < maxBusinessDate → isBackdated=true
  - Multi-currency conversion: all 3 paths (same as base, same as CCY, cross-rate)

#### Integration Tests
- Create item → opening stock → verify StockLevel created
- Opening stock → adjustment out → verify level decreases
- OUT that goes negative → IN that covers → verify settlement metadata
- Transfer between warehouses → verify paired movements, cost carry, levels balanced
- Reconciliation check → verify StockLevel matches movement sums

### 1.8  Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Firestore transaction size for bulk operations (many items) | 🟡 | Batch into ≤500-write transactions; warn in UI for large operations |
| Entity rewrite breaks existing routes | 🟡 | Existing routes are minimal (3 endpoints); update controller simultaneously |
| Round-trip rounding errors in cross-currency | 🟡 | Use `roundByCurrency()` from accounting module; unit test all 3 paths |
| Missing `costCurrency` on items created before migration | 🟡 | Default to company `baseCurrency` in migration script |

---

## Phase 2 — Enhanced Inventory (≈ 2 weeks)

### Scope
Transfers, returns, as-of valuation via period snapshots, dashboard KPIs, low stock alerts.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Stock Transfers** | StockTransfer entity, CreateTransferUseCase, CompleteTransferUseCase, `processTRANSFER` from ALGORITHMS.md |
| **Returns** | RETURN_IN / RETURN_OUT movement types, `reversesMovementId` linking, cost from original |
| **Period Snapshots** | `InventoryPeriodSnapshot` entity, monthly close job, as-of query (snapshot + delta replay) |
| **As-of Valuation Report** | API + frontend: select date → computed valuation at that date |
| **Dashboard KPIs** | Total inventory value, item count, low-stock alerts, unsettled movements count |
| **Low Stock Alerts** | Query `qtyOnHand < minStockLevel`; surface in dashboard |
| **Unsettled Cost Report** | Query `costSettled = false` movements; list for review |

### APIs Added
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/inventory/transfers` | Create transfer |
| POST | `/api/inventory/transfers/:id/complete` | Complete transfer |
| GET | `/api/inventory/transfers` | List transfers |
| GET | `/api/inventory/valuation/as-of` | As-of-date valuation |
| GET | `/api/inventory/dashboard` | Dashboard KPIs |
| GET | `/api/inventory/alerts/low-stock` | Low stock items |
| GET | `/api/inventory/reports/unsettled-costs` | Unsettled cost movements |

### Tests
- Transfer: paired movements created, cost carried, both levels updated
- Returns: cost from original movement used, avg adjusted
- As-of valuation: snapshot + delta matches full scan
- Reconciliation after transfers + returns

---

## Phase 3 — Sales/Purchases Integration Hooks (≈ 1 week)

### Scope
Prepare Inventory for consumption by Sales and Purchases modules. No new Inventory features — just ensure the integration contract is solid.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| **Integration contract documentation** | TypeScript interfaces for how Sales/Purchases call `RecordStockMovementUseCase` |
| **Reserved quantity on StockLevel** | Enable `reservedQty` field for Sales Order reservation (future) |
| **Cost query service** | `GetCurrentCostUseCase(itemId, warehouseId)` → returns `{ avgCostBase, avgCostCCY, lastCostBase, costSettled }` |
| **Movement query for profit snapshots** | `GetMovementForReference(referenceType, referenceId, referenceLineId)` → returns the movement with its cost data |
| **Comprehensive reconciliation** | Extend `ReconcileStockUseCase` to verify avg cost (replay all movements) not just qty |

### Tests
- Integration contract: mock Sales/Purchase calls → verify movements created correctly
- Cost query: verify returns current avg cost + settlement status
- Full reconciliation: verify qty AND cost match between StockLevel and movement replay

### Acceptance Criteria
- Sales module can call `RecordStockMovementUseCase.processOUT(...)` and receive a `StockMovement` with all cost and settlement fields populated.
- Sales module can read `avgCostCCYAfter` from the resulting movement for profit snapshots.
- Purchases module can call `RecordStockMovementUseCase.processIN(...)` with FX rates and receive dual-track costing.
- All `costSettled = false` movements are queryable for the cost-settlement wizard.

---

## Phase 4 — Advanced Features (≈ 3 weeks, future)

### Scope
Features deferred to after Sales/Purchases are operational.

- [ ] Lot/batch tracking (`lotId` on movements, Lot entity, expiry dates)
- [ ] Serial number tracking (per-unit identity)
- [ ] Cost recalculation wizard (retroactive avg cost replay from a date)
- [ ] Cost currency change wizard (re-base running averages)
- [ ] FIFO costing (layer-based cost tracking)
- [ ] Landed cost allocation (post-receipt cost adjustments)
- [ ] Consignment inventory
- [ ] Assembly / BOM

---

## Test Plan Summary

### Unit Tests (all phases)
| Area | Count Est. | Priority |
|------|-----------|----------|
| Entity constructors & validation | ~15 | P0 |
| Cost calculation (IN/OUT/conversion) | ~20 | P0 |
| Settlement logic (partial, missing) | ~10 | P0 |
| Backdating detection | ~5 | P0 |
| StockLevel concurrency | ~5 | P1 |

### Integration Tests
| Scenario | Phase | Priority |
|----------|-------|----------|
| Full lifecycle: create item → opening → sell → purchase → reconcile | 1 | P0 |
| Negative stock: OUT below zero → IN covers → settlement metadata correct | 1 | P0 |
| Multi-currency: USD item, EUR invoice, TRY base → dual-track correct | 1 | P0 |
| Transfer: source → dest, cost carried, paired movements | 2 | P0 |
| Returns: RETURN_IN with reversesMovementId, cost from original | 2 | P0 |
| As-of valuation: snapshot + delta = full scan | 2 | P1 |
| Concurrent movements: optimistic lock handles conflict | 1 | P1 |
