# Architecture: Inventory Module

**Last updated:** 2026-06-13 (Task 221 — deep stabilization)
**Status:** V1 implemented. Moving-average costing live, on either a **per-warehouse** or **company-wide
(GLOBAL)** basis (see Costing basis). GL posting from inventory documents IS implemented
(see Accounting Integration). FIFO deferred to a follow-up.
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

### Costing basis: Per-Warehouse vs Global

`InventorySettings.costingBasis` selects how the moving average is scoped. Both engines are live; the basis
is resolved per movement from the settings record (default **WAREHOUSE**).

- **`WAREHOUSE`** (default) — one moving average per (item, warehouse). The code path is exactly as it has
  always been; this is the proven engine and the entry point for the GLOBAL branch is the only edit to it.
- **`GLOBAL`** — one company-wide moving average per item. Quantity is still tracked per warehouse, but every
  warehouse level for the item carries the **same** average. Invariant: after any movement, all of an item's
  levels hold the current company-wide average, so all downstream readers (valuation, COGS, GL reconciliation,
  stock-levels rollup) are unchanged — they simply read a number that happens to be global.

GLOBAL is implemented inside `RecordStockMovementUseCase` as `processINGlobal` / `processOUTGlobal` /
`processTRANSFERGlobal`, gated at the top of each `process*` method. Mechanics:

- **Receipt (IN)** — reads every warehouse level for the item in the transaction
  (`IStockLevelRepository.getLevelsByItemInTransaction`, whose result set joins the transaction's optimistic
  lock), re-blends the company-wide average with the incoming cost, then writes the new average onto **every**
  level (the receiving warehouse also gets the +qty). A purchase into one warehouse therefore re-prices the
  item everywhere.
- **Issue (OUT)** — values COGS at the company-wide average (`Σ value ÷ Σ qty` across levels). A moving average
  is unchanged by an issue, so only the shipping warehouse's qty is written; availability is still checked
  per-warehouse. The defining property: a warehouse issues at the company cost, not the price it personally
  received.
- **Transfer** — FLAT leaves the average flat (qty moves A→B). VALUED capitalizes the uplift
  `qty × (landed − source)` into the company average; `inMov.totalCostBase − outMov.totalCostBase` still equals
  the uplift, so the clearing-voucher logic in `CompleteStockTransferUseCase` is untouched.

Switching basis after movements exist is not recommended (it is a one-time setup choice); the first GLOBAL
movement after a switch will re-blend any divergent per-warehouse averages into the true company-wide figure.

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

`processOUT` reads the settings record once up front — it drives **both** the costing basis (WAREHOUSE vs GLOBAL) and the negative-stock guard, so there is no second read. A settings read failure falls back to the WAREHOUSE path rather than aborting the posting. Callers may pre-fetch the settings record once per posting transaction and pass it via `preFetchedInventorySettings` to skip the read entirely.

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

Inventory documents **do** post to the GL when the Accounting module is enabled. The integration points:

- **Opening Stock Document** — produces an inventory-valuation voucher (Dr Inventory Asset / Cr opening-balance
  offset). When accounting effect is enabled, the offset account must be an active POSTING **EQUITY** account
  such as Opening Balance Equity or retained earnings. The backend rejects P&L accounts (COGS/revenue), ordinary
  liabilities, and using the same inventory asset account as its own offset; those choices would make the Trial
  Balance balance while corrupting inventory valuation or P&L.
- **Stock Adjustment** (Task 221) — posts a journal valued from the **actual posted movement cost**
  (`movement.totalCostBase`), not the user-typed cost. Write-downs (ADJUSTMENT_OUT) debit the **Inventory Loss**
  account; write-ups (ADJUSTMENT_IN) credit the **Inventory Gain** account. Offset resolution chain:
  dedicated gain/loss (Inventory Settings) → item COGS → settings COGS. Inventory-asset side: item → settings.
  Missing accounts produce a readable blocking error (never a silent skip).
- **Stock Transfer** (Task 221) has two modes:
  - **FLAT** — pure A→B move; destination inherits source moving-average cost; **no GL** (value-neutral).
  - **VALUED** — the destination may land at an overridden/uplifted cost (e.g. capitalized freight). The
    uplift `qty × (landedCost − sourceCost)` is capitalized into inventory (Dr) against the **Inventory
    Transfer Clearing** account (Cr). Zero uplift → no GL.
- **Sales** calls `ISalesInventoryService.processOUT()` and posts COGS itself using the returned unit cost.
- **Purchases** calls `IPurchasesInventoryService.processIN()` to record the receipt (GRN posts the GRNI cycle).

GL accounts for adjustments/transfers are configured in **Inventory Settings → Accounting** (`defaultInventoryGainAccountId`,
`defaultInventoryLossAccountId`, `defaultInventoryTransferClearingAccountId`).

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
| **Item sale/purchase price** | Implemented (Task 221) | `item.salePrice` / `item.purchasePrice` (base currency). Sale price is a price-list fallback. |
| **FIFO** | V2 | Only MOVING_AVG today. |
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
