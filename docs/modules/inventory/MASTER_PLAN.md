# Inventory Module — Master Plan

> **Status:** LOCKED  
> **Module ID:** `inventory`  
> **Dependencies:** `accounting` (shared currencies, COA accounts, ExchangeRate service)  
> **Priority:** Phase 1 — prerequisite for Sales & Purchases

---

## 1  System Overview

The Inventory module tracks items, warehouses, stock quantities, and costing. It is the operational foundation for Sales and Purchases — those modules will call Inventory to create stock movements.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Inventory Module                           │
│                                                                 │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Item    │  │ Warehouse │  │ ItemCategory│  │UomConversion│ │
│  │  Master   │  │  Master   │  │   (tree)    │  │            │ │
│  └──────────┘  └───────────┘  └─────────────┘  └────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Stock Movement Ledger (append-only)             │  │
│  │  IN | OUT | TRANSFER_IN | TRANSFER_OUT | ADJUST | RETURN │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │ atomic update                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        StockLevel (materialized aggregate)               │  │
│  │        per (companyId, itemId, warehouseId)               │  │
│  │        qtyOnHand + avgCostBase + avgCostCCY               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ InventorySettings  │  │ PeriodSnapshot     │                │
│  │ (company-level)    │  │ (Phase 2)          │                │
│  └────────────────────┘  └────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2  Data Model Summary

See [SCHEMAS.md](./SCHEMAS.md) for full field-level definitions.

| Entity | Scope | Mutability | Purpose |
|--------|-------|------------|---------|
| `Item` | Company | Mutable (except `costCurrency` after first movement) | Product/service master data |
| `Warehouse` | Company | Mutable | Storage location |
| `ItemCategory` | Company | Mutable | Hierarchical item classification |
| `UomConversion` | Item | Mutable | Unit of measure conversion rules |
| `StockMovement` | Company × Item × Warehouse | **Immutable** (append-only) | Every IN/OUT/TRANSFER/ADJUST event |
| `StockLevel` | Item × Warehouse | Mutable (atomically with movements) | Current qty + running averages |
| `InventorySettings` | Company | Mutable | Module-level defaults |

---

## 3  Key Invariants & Ordering Rules

### 3.1  postingSeq vs date

| Field | Purpose | Scope |
|-------|---------|-------|
| `date` | Business/posting date — for reports, GL period assignment, filtering | Per movement |
| `postingSeq` | Monotonic integer — the **ONLY** correct ordering for cost replay | Per StockLevel (itemId × warehouseId) |

**Rules:**
- Cost calculation replay MUST iterate by `postingSeq ASC`.
- `postingSeq` is incremented atomically on `StockLevel` inside the Firestore transaction.
- Backdated movements get a newer `postingSeq` than prior movements — their date is older but their cost effect is applied to the current running average.

### 3.2  Backdating Detection

```
oldMax = level.maxBusinessDate
isBackdated = (movement.date < oldMax)
level.maxBusinessDate = max(oldMax, movement.date)
```

- `maxBusinessDate` only moves forward (monotonic max of all business dates seen).
- `isBackdated` is evaluated using the **old** value before updating.

### 3.3  Immutability

- `StockMovement` records are **never modified or deleted** once created.
- Corrections are handled via new compensating movements (returns, adjustments).
- `StockLevel` is **the only mutable aggregate** — it is updated atomically inside the same transaction that creates the movement.

---

## 4  Negative Stock Rules

**Policy: Negative stock is ALLOWED.**

### On OUT movements:
- `qtyOnHand` may go negative.
- Partial settlement tracking:
  - `settledQty = min(qty, max(qtyBefore, 0))` — units covered by real stock
  - `unsettledQty = qty - settledQty` — units issued into negative territory
  - `costSettled = (unsettledQty === 0)`
- Cost for unsettled portion:
  - If `qtyBefore > 0`: use `avgCost` (rate = `AVG`)
  - If `qtyBefore <= 0` and `lastCost > 0`: use `lastCost` (rate = `LAST_KNOWN`)
  - If `qtyBefore <= 0` and `lastCost = 0`: flag `unsettledCostBasis = 'MISSING'`

### On IN movements covering negative stock:
- `settlesNegativeQty = min(qty, max(-qtyBefore, 0))` — how many units fill the prior deficit
- `newPositiveQty = qty - settlesNegativeQty` — how many add new positive stock
- Running average resets to the incoming cost when crossing from negative/zero to positive.

### Settlement Lifecycle:
```
1. OUT → qty goes negative → costSettled=false, unsettledQty=N
2. IN arrives → qty goes positive → settlesNegativeQty=N
3. Future "Cost Settlement Wizard" finds costSettled=false movements
   → Produces corrective entries (never mutates originals)
```

---

## 5  Multi-Currency Conversion Rules

### Setup
- Company has ONE `baseCurrency` (e.g., TRY).
- Each Item has a `costCurrency` (e.g., USD, EUR, SYP). Defaults to baseCurrency.
- Exchange rates are stored in the accounting module's bulletin table.

### Triangulation Through Base Currency
When the movement currency differs from the item's `costCurrency`:
```
unitCostBase = unitCostInMoveCurrency × fxRateMovToBase
unitCostCCY  = unitCostInMoveCurrency × (fxRateMovToBase / fxRateCCYToBase)
```

### Three Conversion Paths
| Scenario | `unitCostBase` | `unitCostCCY` |
|----------|---------------|---------------|
| moveCurrency = baseCurrency | = input | = input / fxRateCCYToBase |
| moveCurrency = costCurrency | = input × fxRateCCYToBase | = input |
| moveCurrency ≠ either | = input × fxRateMovToBase | = input × (fxRateMovToBase / fxRateCCYToBase) |

### FX Rate Tracking
| Field | `IN` movements | `OUT` movements |
|-------|---------------|----------------|
| `fxRateMovToBase` | Document rate (frozen) | Not applicable (set to 1.0 if costCurrency=baseCurrency, else derived) |
| `fxRateCCYToBase` | Bulletin/document rate (frozen) | Derived: `unitCostBase / unitCostCCY` if unitCostCCY > 0, else `null` |
| `fxRateKind` | `'DOCUMENT'` | `'EFFECTIVE'` |

### Rounding
- Use `roundMoney()` from accounting module.
- FX rates stored at 6+ decimal places.
- Final monetary amounts rounded per currency precision via `roundByCurrency()`.

---

## 6  Auditability Approach

| Concern | Solution |
|---------|----------|
| When was cost applied? | `postedAt` timestamp (set inside transaction) |
| When was movement created? | `createdAt` timestamp |
| Who did it? | `createdBy` user ID |
| What order were costs computed? | `postingSeq` (monotonic) |
| Was this backdated? | `isBackdated` boolean |
| Which document caused this? | `referenceType` + `referenceId` + `referenceLineId` |
| Return → original movement? | `reversesMovementId` |
| Transfer OUT → paired IN? | `transferPairId` (shared UUID) |
| Was cost reliable? | `costSettled` + `unsettledCostBasis` |
| Running state after? | `avgCostBaseAfter`, `avgCostCCYAfter`, `qtyBefore`, `qtyAfter` |

---

## 7  Report Strategy

### Current State Reports (use StockLevel directly)
- On-hand quantities by warehouse
- Current inventory valuation (qty × avgCost)
- Low stock alerts (qtyOnHand < minStockLevel)

### Historical Reports (movement ledger)
- Movement history by item/warehouse/date range (paginated, filtered)
- Unsettled cost report (`costSettled = false` movements)

### As-Of Valuation (Phase 2 — Period Snapshots)
- Monthly `InventoryPeriodSnapshot` created at period close.
- As-of query: find nearest snapshot ≤ date, replay only subsequent movements.
- Avoids full movement scans.

---

## 8  Firestore Collection Map

```
companies/{companyId}/inventory/
├── Settings                          → InventorySettings
└── Data/
    ├── items/{itemId}                → Item master data
    ├── categories/{categoryId}       → ItemCategory (tree)
    ├── warehouses/{warehouseId}      → Warehouse master
    ├── uom_conversions/{id}          → UomConversion rules
    ├── stock_levels/{itemId_whId}    → StockLevel materialized aggregates
    ├── stock_movements/{id}          → StockMovement immutable ledger
    ├── stock_adjustments/{id}        → StockAdjustment documents
    ├── stock_transfers/{id}          → StockTransfer documents
    └── period_snapshots/{id}         → InventoryPeriodSnapshot (Phase 2)
```

---

## 9  Existing Code Location Map

| Layer | Path | Current State |
|-------|------|---------------|
| Domain entities | `backend/src/domain/inventory/entities/` | Stubs: Item (15 lines), Warehouse (10 lines), StockMovement (18 lines). **All need full rewrite.** |
| New entities | `backend/src/domain/inventory/entities/` | StockLevel, ItemCategory, UomConversion, InventorySettings — **to be created** |
| Repo interfaces | `backend/src/repository/interfaces/inventory/` | Basic CRUD only. Need expansion + new repos (StockLevel, Category, UomConversion, Settings). |
| Firestore repos | `backend/src/infrastructure/firestore/repositories/inventory/` | Basic mapping. Need full rewrite for new schemas. |
| Mappers | `backend/src/infrastructure/firestore/mappers/InventoryMappers.ts` | Basic. Must match new schemas. |
| Use cases | `backend/src/application/inventory/use-cases/` | ItemUseCases, WarehouseUseCases, StockMovementUseCases — basic stubs. **RecordStockMovementUseCase** (core cost engine) to be created. |
| Controller | `backend/src/api/controllers/inventory/InventoryController.ts` | 3 methods. Needs expansion for all endpoints. |
| DTOs | `backend/src/api/dtos/InventoryDTOs.ts` | Minimal. Needs full expansion. |
| Routes | `backend/src/api/routes/inventory.routes.ts` | 3 routes. Needs expansion. |
| Module | `backend/src/modules/inventory/InventoryModule.ts` | Registered and working. Needs permission expansion. |
| Validators | `backend/src/api/validators/inventory.validators.ts` | Basic. Needs expansion. |

---

## 10  Integration Hooks for Future Sales/Purchases

These fields exist on Inventory entities NOW so that Sales/Purchases can integrate without Inventory schema changes:

| Hook | Where | Purpose |
|------|-------|---------|
| `referenceType` + `referenceId` + `referenceLineId` | StockMovement | Link to sale/purchase invoice line |
| `costSettled` + `unsettledQty` | StockMovement | Sales detects unsettled COGS |
| `avgCostCCYAfter` + `avgCostBaseAfter` | StockMovement | Profit snapshot reads cost at time of sale |
| `costCurrency` | Item | Determines which bulletin rate Sales fetches for management profit |
| `revenueAccountId`, `cogsAccountId`, `inventoryAssetAccountId` | Item | Automatic GL posting for sale/purchase |
| `reservedQty` | StockLevel | Sales order stock reservation (future) |
| `reversesMovementId` | StockMovement | Returns link to original movement |
