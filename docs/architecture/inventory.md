# Architecture: Inventory Module

**Last updated:** 2026-05-17
**Status:** V1 implemented. FIFO/Weighted-Average costing and Cost Settlement Wizard deferred to V2.
**Module-level docs:** [`docs/modules/inventory/MASTER_PLAN.md`](../modules/inventory/MASTER_PLAN.md), [`docs/modules/inventory/ALGORITHMS.md`](../modules/inventory/ALGORITHMS.md), [`docs/modules/inventory/SCHEMAS.md`](../modules/inventory/SCHEMAS.md)

---

## Purpose

The Inventory module tracks physical stock and its cost. Every movement (receipt, issue, transfer, adjustment, opening balance) creates an immutable ledger entry, and the running stock level + average cost are maintained atomically.

Inventory is the **cost engine** for the system. Sales asks Inventory "what does this item cost to deliver?" and Inventory answers with the current weighted average. Purchases asks Inventory "record that we received X units at price Y" and Inventory updates the running average.

## Core Concepts

- **Item** — what's tracked. Types: `PRODUCT` (physical), `RAW_MATERIAL`, `SERVICE` (non-stock). Costs are tracked per item, in the item's `costCurrency` (immutable once movements exist).
- **Warehouse** — where stock lives. Hierarchical (parent/child). One default warehouse per company.
- **StockLevel** — materialized per (item, warehouse): `onHandQty`, `reservedQty`, `avgCostBase`, `lastCostBase`, `version`, `postingSeq`. Updated atomically with each movement.
- **StockMovement** — append-only ledger entry. One per physical event (receipt, issue, transfer leg, adjustment).
- **Item Category** — hierarchical classification; can inherit GL accounts to items.
- **UOM (Unit of Measure)** — base UOM per item; conversion rules for alternative UOMs.

## Movement Types

| Type | Direction | Triggered by |
|---|---|---|
| `OPENING_STOCK` | IN | Opening Stock Document (initial setup) |
| `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` | IN / OUT | Stock Adjustment (damage, found, correction) |
| `TRANSFER_OUT` / `TRANSFER_IN` | OUT / IN | Stock Transfer (paired, linked by `transferPairId`) |
| `PURCHASE_RECEIPT` | IN | Purchases GRN or PI posting |
| `SALES_DELIVERY` | OUT | Sales DN or SI posting |
| `RETURN_IN` | IN | Sales Return |
| `RETURN_OUT` | OUT | Purchase Return |

All movements are stored in `baseUom`. UOM conversions happen at input time.

## Costing — Phase 1 (Implemented)

**Moving Average** is the only method in V1.

### Dual-track cost storage

Each movement stores cost in **two currencies**:
- `unitCostBase` / `totalCostBase` — in the company base currency (used for GL).
- `unitCostCCY` / `totalCostCCY` — in the item's management currency (`item.costCurrency`).

FX rates are frozen on the movement:
- On IN: `fxRateKind = 'DOCUMENT'` (the document's FX rate at posting).
- On OUT: `fxRateKind = 'EFFECTIVE'` (derived from the running average, which itself is a weighted blend of the IN rates).

### Atomic updates

`RecordStockMovementUseCase` (~750 lines, the heart of the module) wraps the StockLevel update and the StockMovement insertion inside a single Firestore transaction. `postingSeq` and `version` are incremented atomically — the StockLevel always reflects all movements up to the latest `postingSeq`.

### Negative stock

Controlled by `InventorySettings.allowNegativeStock` (default `true`).

- **`allowNegativeStock = true`** — OUT movements that would drive `qtyOnHand` below zero succeed; the movement records `negativeQtyAtPosting = true` and `unsettledCostBasis` reflects how the cost was sourced (see below).
- **`allowNegativeStock = false`** — `RecordStockMovementUseCase.processOUT` throws `NegativeStockError` **before** mutating the StockLevel. No movement is created, no ledger entry posted. Callers (Sales/Purchases posting flows) propagate the error to the API response.

The settings lookup happens only when the projected post-movement qty would be negative; positive-result OUTs are not penalized. Callers may pre-fetch the settings record once per posting transaction and pass it via `preFetchedInventorySettings` to avoid a second read.

When the deficit IS allowed:
On OUT movements when stock is insufficient:
- `settledQty` = quantity covered by real stock (uses `avgCostBase`)
- `unsettledQty` = quantity issued from deficit. Cost rules:
  - If `qty` was positive before: use `avgCostBase` (rate kind `'AVG'`).
  - If `qty` was ≤ 0 before: use `lastCostBase` (rate kind `'LAST_KNOWN'`).
  - If no last cost: flag `unsettledCostBasis = 'MISSING'`, cost = 0. **These movements show in the Unsettled Costs report.**

On IN movements that cover a prior deficit:
- `settlesNegativeQty` = qty applied against deficit (corrects cost retroactively for the affected OUT movements *via reporting*, not by rewriting them).
- `newPositiveQty` = qty above zero.

### Backdating

Allowed. Movement `date` can be earlier than prior movements. Flagged with `isBackdated = true`.

**Cost replay uses `postingSeq`, NOT `date`.** This is a deliberate trade-off — backdated movements apply to the *current* running average, not retroactively rebuild history. This is documented in `MASTER_PLAN.md`.

## Documents (User-facing workflows)

- **Stock Adjustment** — manual IN or OUT for damage/loss/correction/expiry/found. Status: DRAFT → POSTED.
- **Stock Transfer** — paired TRANSFER_OUT/TRANSFER_IN movements. Status: DRAFT → IN_TRANSIT → COMPLETED.
- **Opening Stock Document** — initial inventory entry. Optionally posts an Accounting voucher for inventory valuation. Status: DRAFT → POSTED.

Document posting is immutable; corrections require a separate adjustment.

## Accounting Integration

Inventory has account fields prepared (`item.revenueAccountId`, `item.cogsAccountId`, `item.inventoryAssetAccountId`) but **automatic GL posting from inventory movements is NOT implemented in V1**.

Where the integration *does* exist:
- **Opening Stock Document** can produce an inventory-valuation Accounting voucher when the Accounting module is enabled.
- **Sales** calls into Inventory via `ISalesInventoryService.processOUT()` and posts COGS itself using the returned unit cost.
- **Purchases** calls into Inventory via `IPurchasesInventoryService.processIN()` to record the receipt.

### Sales-mode behavior for missing cost

For stock issues created by Sales documents (DN/SI/SR):

- In **PERPETUAL** mode, Sales enforces positive cost at posting.
- In **INVOICE_DRIVEN** mode (`PERIODIC`), Sales permits zero-cost issues and marks cost settlement metadata (`costSettled=false`, `unsettledCostBasis`) so unresolved cost is visible in reporting.

V2 plans automatic Accounting vouchers from inventory movements (decoupled from Sales/Purchases), gated by the Accounting integration setting.

## Multi-Warehouse

- Stock is tracked per (item, warehouse) pair.
- Transfers maintain cost across warehouses (the IN leg inherits the OUT leg's cost).
- One default warehouse per company; can be marked inactive but not deleted (audit trail).

## What Is NOT Implemented

| Feature | Status | Note |
|---|---|---|
| **FIFO / Weighted Average costing** | V2 | Only MOVING_AVG today. |
| **Cost Settlement Wizard** | Placeholder | Retroactively fix `costSettled = false` OUT movements (`unsettledCostBasis = 'MISSING'`). |
| **Period Snapshots** | Stub | Entity exists; not populated. For as-of valuations. |
| **Automatic COGS posting from inventory** | Deferred | Sales posts COGS itself today; Inventory will own this in V2. |
| **Lot / Serial / Batch tracking** | Not planned V1 | Items are fungible. |
| **Stock Reservation (Sales Order)** | Stub | `reservedQty` field exists but is not populated. |
| **LIFO / FEFO** | Not in roadmap | Even FIFO is V2. |
| **Reversal workflows** | Partial | `reversesMovementId` field exists; no cancellation UI. |
| **As-of valuation** | V2 | Will use Period Snapshots. |

## Key Use Cases

| Use case | Purpose |
|---|---|
| `RecordStockMovementUseCase` | The cost engine. Implements `processIN()`, `processOUT()`, `processTRANSFER()`. |
| `InitializeInventoryUseCase` | Module setup (default warehouse, settings). |
| `StockAdjustmentUseCases`, `StockTransferUseCases`, `OpeningStockDocumentUseCases` | Document lifecycle. |
| `StockLevelUseCases`, `StockMovementUseCases`, `CostQueryUseCases` | Queries. |
| `DashboardUseCases` | KPI aggregation (total value, low stock, negative stock, recent movements). |
| `ReconcileStockUseCase` / `ReturnUseCases` / `StockReservationUseCases` | Partial / planned. |
| `ConfigureInventoryFinancialIntegrationUseCase` | Links inventory accounts to Accounting (V2 hook). |

## File Map

| Concern | Path |
|---|---|
| Domain entities | `backend/src/domain/inventory/entities/` |
| Cost engine | `backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts` |
| Other use cases | `backend/src/application/inventory/use-cases/` |
| Inventory contracts | `backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts` |
| Routes | `backend/src/api/routes/inventory.routes.ts` |
| Frontend module | `frontend/src/modules/inventory/` |
| Master Plan | `docs/modules/inventory/MASTER_PLAN.md` |
| Algorithms | `docs/modules/inventory/ALGORITHMS.md` |
| Schemas | `docs/modules/inventory/SCHEMAS.md` |
| Opening stock rules | `docs/modules/inventory/OPENING_STOCK_DOCUMENTS.md` |
