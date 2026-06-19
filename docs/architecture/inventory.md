# Architecture: Inventory Module

**Last updated:** 2026-06-18 (Epic 240 Phase 5 — report-time valuation and trading)
**Status:** V1 implemented. Moving-average costing live, on either a **per-warehouse** or **company-wide
(GLOBAL)** basis (see Costing basis). Inventory accounting now supports **three distinct modes**:
`PERIODIC`, `INVOICE_DRIVEN`, and `PERPETUAL`. FIFO deferred to a follow-up.
**Module-level docs:** [`docs/modules/inventory/MASTER_PLAN.md`](../modules/inventory/MASTER_PLAN.md), [`docs/modules/inventory/ALGORITHMS.md`](../modules/inventory/ALGORITHMS.md), [`docs/modules/inventory/SCHEMAS.md`](../modules/inventory/SCHEMAS.md)

---

## Purpose

The Inventory module tracks physical stock and its cost. Every movement (receipt, issue, transfer, adjustment, opening balance) creates an immutable ledger entry, and the running stock level + average cost are maintained atomically.

Inventory is the **cost engine** for the system. Sales asks Inventory "what does this item cost to deliver?" and Inventory answers with the current weighted average. Purchases asks Inventory "record that we received X units at price Y" and Inventory updates the running average.

## Inventory accounting modes

ERP03 now supports three distinct inventory-accounting modes:

| Mode | Inventory / COGS GL timing | Operational docs (GRN / DN) | Invoice quantity move | Typical use |
|---|---|---|---|---|
| `PERIODIC` | **No per-transaction Inventory or COGS GL.** Purchases and Sales hit trading-book accounts only. | Quantity only, no GL. | Yes, but only if a GRN / DN did not already move the quantity. | Simple trading books where closing inventory and trading result are handled at report time. |
| `INVOICE_DRIVEN` | Invoice creates inventory/COGS-style GL when the operational doc did not already do it. | Quantity only, no GL. | Yes, and it may also recognize inventory / COGS when no GRN / DN exists. | Simple direct-invoice companies that still want inventory asset and COGS per invoice. |
| `PERPETUAL` | Inventory / COGS GL recognized continuously at the stock-operational boundary. | GRN / DN own the stock GL. | Invoice clears GRNI / posts revenue and does not re-recognize stock already handled operationally. | Full perpetual inventory accounting. |

`PERIODIC` is now a **real first-class mode**. Legacy `inventoryAccountingMethod = PERIODIC` no longer gets remapped to `INVOICE_DRIVEN`; it resolves to `accountingMode = PERIODIC`.

## Mode lock and re-seed policy

Epic 240 Phase 6 adds a company-level safety rule around `InventorySettings.accountingMode`:

- **Before the first posted history**: mode changes are allowed.
- **After the first posted history**: mode changes are blocked.

The lock state is evaluated from:

- any posted accounting voucher
- any stock movement

`InventoryAccountingModeLockService` is the authoritative backend rule. The Inventory Settings API now returns:

- `accountingModeLocked`
- `accountingModeLockReason`

### What happens before history exists

Changing the mode does **not** just flip a flag. ERP03 re-runs the same starter initializer used by onboarding so the company gets the matching setup bundle again:

- correct COA template (`periodic_trading` or `standard`)
- matching inventory mode
- matching Sales/Purchases workflow defaults
- matching linked inventory-control accounts

This is an **additive reseed**, not destructive chart cleanup. Existing accounts are preserved and missing ones are added. That is the safer ERP behavior while the company is still pre-live, because it avoids deleting accounts that drafts or references may already point at.

## Core Concepts

- **Item** — what's tracked. Types: `PRODUCT` (physical), `RAW_MATERIAL`, `SERVICE` (non-stock). Costs are tracked per item, in the item's `costCurrency` (immutable once movements exist).
- **Warehouse** — where stock lives. Hierarchical (parent/child). One default warehouse per company.
- **StockLevel** — materialized per (item, warehouse): `onHandQty`, `reservedQty`, `avgCostBase`, `lastCostBase`, `version`, `postingSeq`. Updated atomically with each movement.
- **StockMovement** — append-only ledger entry. One per physical event (receipt, issue, transfer leg, adjustment).
- **Item Category** — hierarchical classification; can inherit GL accounts to items.
- **UOM (Unit of Measure)** — base UOM per item; conversion rules for alternative UOMs.

### Item UOM conversion uniqueness

Each item can have only one active conversion for a given `From UOM -> To UOM` pair. `ManageUomConversionsUseCase`
normalizes both sides through the company UOM repository before create/update and rejects a duplicate active pair for
the same item. This prevents ambiguous factors such as `BOX -> PCS = 12` and `BOX -> PCS = 24` from coexisting and
keeps document-line quantity conversion, cost conversion, and per-UOM price memory deterministic.

Inactive conversions do not reserve the pair. If an unused conversion is deleted/deactivated, the same pair can be
created again later with a new factor.

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
- **Transfer** — plain/journaled transfers move quantity A→B at the source carrying cost and leave the company
  average flat. Value beyond source cost is never inferred from `IN − OUT`; it is applied only from an explicit
  added-cost input or an explicit revaluation input. Added cost raises the company value and posts to Transfer
  Clearing. Revaluation raises/lowers company value and posts to the dedicated Inventory Revaluation account.

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

Controlled by `InventorySettings.allowNegativeStock` (default `false` for new and hydrated settings).

- **`allowNegativeStock = false`** — default and market-standard control posture. `RecordStockMovementUseCase.processOUT` throws `NegativeStockError` **before** mutating the StockLevel. No movement is created, no ledger entry posted. Callers (Sales/Purchases posting flows) propagate the error to the API response.
- **`allowNegativeStock = true`** — explicit opt-in. OUT movements that would drive `qtyOnHand` below zero succeed; the movement records `negativeQtyAtPosting = true` and `unsettledCostBasis` reflects how the cost was sourced (see below).

The guard covers **every stock-issuing path**, not just `processOUT`. A stock transfer issues from the source warehouse exactly like an OUT, so `processTRANSFER` and `processTRANSFERGlobal` apply the same guard to the source (OUT) leg before decrementing `qtyOnHand` — a transfer can no longer drive a source warehouse negative while the policy is off. The destination (IN) leg is never guarded (a receipt cannot create a deficit).

`processOUT` and `processTRANSFER` each read the settings record once up front — it drives **both** the costing basis (WAREHOUSE vs GLOBAL) and the negative-stock guard, so there is no second read. A settings read failure falls back to the WAREHOUSE path rather than aborting the posting. Callers may pre-fetch the settings record once per posting transaction and pass it via `preFetchedInventorySettings` to skip the read entirely.

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

## Item costing statistics (Epic 240 Phase 3)

Beyond the per-warehouse cost on `StockLevel` (which the engine uses to cost issues), each `Item` carries a **read/reporting rollup** of cost & price statistics in `Item.costingStats`. This feeds the Item card, the report-time inventory valuation (Phase 5), and party×item price memory (Task 241). It does **not** change any GL posting.

**Schema** (`domain/inventory/entities/Item.ts`):
- `CostPoint` = `{ base, ccy, currency, fxRateToBase, asOf, source? }` — every figure is stored in **company base currency AND the original transaction currency**, with the FX rate and date, so a later FX revaluation can recompute.
- `ItemCostingStats` = `{ avgCost, lastPurchaseCost?, lastSalePrice?, extra? }`. `extra: Record<string, CostPoint>` is reserved for future methods (standard / FIFO / highest / lowest) **without a schema migration**. `ItemCostingMethod` is an open union (only `MOVING_AVG` is enforced).

**How each point updates** (`application/inventory/services/ItemCostingStatsService.ts`):
| Point | Updated on | Source |
|---|---|---|
| `avgCost` | every IN | `buildAverageCostPoint` — GLOBAL = company-wide average; WAREHOUSE = qty-weighted across the item's levels |
| `lastPurchaseCost` | every `PURCHASE_RECEIPT` IN | `buildPurchaseCostPoint(movement)` (movement unit cost, FX-split) |
| `lastSalePrice` | every sale (SI / DN) | `buildSalePricePoint(line)` — the **selling price** (`unitPriceDoc × rate`), NOT COGS |

**Two purchase IN paths are both hooked:** the generic `RecordStockMovementUseCase` (incl. GLOBAL fan-out) **and** the inline receipt block in `PurchaseInvoiceUseCases` (plus `GoodsReceiptUseCases`). Sale-price capture lives in `SalesInvoiceUseCases` + `DeliveryNoteUseCases`. All writes persist via `IItemRepository.updateItemInTransaction` inside the posting transaction (idempotent on re-post), implemented in **both** the Firestore and Prisma repositories.

## Report-time valuation (Epic 240 Phase 5)

Phase 5 turns the costing stats into a real **valuation service** for reporting:

- `application/inventory/services/InventoryValuationService.ts`
- contract: `value(companyId, asOfDate, pricingPolicy, warehouseId?)`
- pricing policies implemented today:
  - `AVERAGE`
  - `LAST_PURCHASE`

The service returns:

- `asOfDate`
- `pricingPolicy`
- `totalValueBase`
- `totalItems`
- `items[]` with per item/warehouse:
  - `qtyOnHand`
  - `avgCostBase` / `avgCostCCY`
  - `lastPurchaseCostBase` / `lastPurchaseCostCCY`
  - `pricingUnitCostBase` / `pricingUnitCostCCY`
  - `valueBase`

Two valuation paths exist:

- **Current valuation** reads live `StockLevel` quantities plus current `Item.costingStats`.
- **Historical valuation** replays stock movements up to `asOfDate` to rebuild quantity-on-hand and the relevant pricing point for that date.

Important historical rules:

- In **GLOBAL** costing, when an IN movement changes the company-wide average, replay propagates that new average across every warehouse for the item so historical valuation matches the real GLOBAL invariant.
- Historical `LAST_PURCHASE` follows the latest qualifying IN movement cost up to the report date. It is not derived from today's item card value.

This service is **read-only**. It does not post a closing journal, rewrite historical stock levels, or mutate ledger balances. Its job is to give Periodic-mode reports a defensible carrying value at any reporting date.

## Documents (User-facing workflows)

- **Stock Adjustment** — manual IN or OUT for damage/loss/correction/expiry/found. Status: DRAFT → POSTED.
- **Stock Transfer** — paired TRANSFER_OUT/TRANSFER_IN movements. Status: DRAFT → IN_TRANSIT → COMPLETED.
- **Opening Stock Document** — initial inventory entry. Optionally posts an Accounting voucher for inventory valuation. Status: DRAFT → POSTED.

Document posting is immutable; corrections require a separate adjustment.

### Frontend document shell

Inventory document workflows now follow the same list-to-form shell used by Sales/Purchases documents:

- `/inventory/adjustments` and `/inventory/opening-stock` are list pages built on `OperationalListLayout`.
- `/inventory/adjustments/new` and `/inventory/opening-stock/new` open dedicated form routes.
- `/inventory/adjustments/:id` and `/inventory/opening-stock/:id` open scaffold-backed document views.
- Forms use `DocumentDetailScaffold` with the same body slots as the native Sales Invoice pattern: `control`, `header`, `lines`, rail readiness/totals, and footer actions.

Opening Stock places the **Create Accounting Effect** toggle and warning in the scaffold `control` section. When accounting effect is enabled, the document pre-fills its offset account from `InventorySettings.defaultOpeningBalanceAccountId`, while still allowing a per-document override. The backend remains authoritative: the selected account must be an active POSTING EQUITY account.

## Accounting Integration

Inventory documents **do** post to the GL when the Accounting module is enabled. The integration points:

### Mode matrix

The posting rules are now:

| Document | `PERIODIC` | `INVOICE_DRIVEN` | `PERPETUAL` |
|---|---|---|---|
| Purchase Invoice | Dr **Purchases** / Cr AP (+ tax). No Inventory / GRNI line. | If no GRN already handled stock: quantity + Dr Inventory / Cr AP. | If GRN already posted: Dr GRNI / Cr AP (+ tax). No double receipt. |
| Sales Invoice | Dr AR / Cr **Sales** (+ tax). No COGS / Inventory line. | If no DN already handled stock: quantity + COGS / Inventory recognition. | Revenue voucher +, when needed, separate COGS / Inventory voucher only for stock the DN did not already handle. |
| Purchase Return | Dr AP / Cr **Purchase Returns**. No Inventory line. | Dr AP / Cr Inventory (after-invoice/direct) per existing behavior. | Before-invoice: reverses GRNI path. After-invoice/direct: reverses Inventory. |
| Sales Return | Dr **Sales Returns** / Cr AR. No COGS / Inventory reversal. | Revenue reversal + inventory reversal for after-invoice/direct returns. | Revenue reversal + inventory / COGS reversal. |
| Goods Receipt / Delivery Note | No GL. Quantity only. | No GL. Quantity only. | Own stock GL (GRNI or COGS / Inventory). |
| Stock Adjustment | No GL. Quantity only. | Existing behavior unchanged. | Existing behavior unchanged. |
| Opening Stock | Dr **Goods / Opening Inventory** / Cr Opening Balance Equity. | Existing opening-stock behavior. | Existing opening-stock behavior. |

Two control rules matter:

- **No-double-count quantity rule:** invoice posting reuses the existing `goodsAlreadyReceived(...)` / operational-delivery gates. In all modes, the invoice moves quantity **only if** the GRN / DN did not already move it.
- **Opening stock is the periodic exception:** even in `PERIODIC`, opening stock may post GL because the company still needs an audited opening Inventory-vs-Equity entry.

- **Opening Stock Document** — produces an inventory-valuation voucher (Dr Inventory Asset / Cr opening-balance
  offset). When accounting effect is enabled, the offset account must be an active POSTING **EQUITY** account
  such as Opening Balance Equity or retained earnings. The backend rejects P&L accounts (COGS/revenue), ordinary
  liabilities, and using the same inventory asset account as its own offset; those choices would make the Trial
  Balance balance while corrupting inventory valuation or P&L.
  `InventorySettings.defaultOpeningBalanceAccountId` is the optional company default used to prefill new Opening
  Stock Documents. Users may override it per document, but not bypass the EQUITY validation.
- **Stock Adjustment** (Task 221) — posts a journal valued from the **actual posted movement cost**
  (`movement.totalCostBase`), not the user-typed cost. Write-downs (ADJUSTMENT_OUT) debit the **Inventory Loss**
  account; write-ups (ADJUSTMENT_IN) credit the **Inventory Gain** account. Offset resolution chain:
  dedicated gain/loss (Inventory Settings) → item COGS → settings COGS. Inventory-asset side: item → settings.
  Missing accounts produce a readable blocking error (never a silent skip).
  In `PERIODIC`, adjustments still change quantity and costing stats, but they post **no GL voucher**.
- **Stock Transfer** (Task 221 / 231) has two persisted modes, but four strict economic cases:
  - **Plain / Journaled** — pure A→B move. OUT value = IN value = `qty × source carrying cost`. The source
    average is not changed by the outbound leg. With the current single inventory control account model this is
    value-neutral and posts no GL; future per-warehouse inventory accounts may post `Dr Inv-Dest / Cr Inv-Source`
    at the same source value.
  - **Added-cost** — explicit freight/customs/handling cost. OUT remains at source cost; IN receives source cost
    plus `addedCostBaseAtTransfer`. GL posts the inventory delta to Inventory and the opposite side to
    `defaultInventoryTransferClearingAccountId`. Transfer Clearing is for real costs that a later AP/Cash bill
    can clear.
  - **Revaluation** — explicit value-only carrying-cost change. OUT remains at source cost; IN receives
    `revaluationUnitCostBaseAtTransfer`. The variance posts to the dedicated
    `defaultInventoryRevaluationAccountId` with sign-based sides: upward revaluation debits Inventory and
    credits Inventory Revaluation; downward revaluation debits Inventory Revaluation and credits Inventory.
    Do not reuse Inventory Gain/Loss for this path.
  - **Zero-cost source** — a 0-cost item transfers at 0 unless the user declares an explicit revaluation. The
    old automatic `uplift = IN − OUT` path is deleted, so a transfer can no longer mint inventory value from a
    zero-cost source into Transfer Clearing.
  - **Lifecycle:** `createTransfer` saves a **DRAFT** (no stock/GL effect); `completeTransfer` posts the paired
    TRANSFER_OUT/TRANSFER_IN movements and any explicit valuation voucher **in one transaction** (so a negative-stock
    block on the source OUT leg rolls back the voucher too).
  - **Edit a draft** — `updateTransfer` (`PUT /transfers/:id`, `UpdateStockTransferUseCase`) rebuilds the draft
    (re-snapshots source costs via `CreateStockTransferUseCase.buildDraft`) and overwrites the record. Allowed
    **only** while `DRAFT`; a COMPLETED transfer is refused.
  - **Cancel a draft** — `cancelTransfer` (`DELETE /transfers/:id`, `CancelStockTransferUseCase`) hard-deletes,
    allowed **only** for DRAFT (it has posted nothing to reverse).
  - **Undo a completed transfer** — `undoTransfer` (`POST /transfers/:id/undo`, `UndoStockTransferUseCase`) does
    **not** delete history; it creates and completes a **mirror-image** transfer (source/destination swapped,
    same lines/costs) and links the pair via `reversesTransferId` / `reversedByTransferId`. The reverse runs the
    normal `complete` path, so it posts its own paired movements (and, for VALUED, a reversing uplift voucher
    through the guard) and is itself subject to the negative-stock guard. Guards: only `COMPLETED` transfers can
    be undone, not one already undone, and a reversal cannot itself be undone. Covered by
    `StockTransferCorrectionUseCase.test.ts`.
  - Transfer valuation vouchers post through `SubledgerVoucherPostingService` → `PostingGateway.record()` (the
    single ledger door), so they honor period locks and the enabled policy set.
- **Sales** calls `ISalesInventoryService.processOUT()` and posts COGS itself using the returned unit cost.
- **Purchases** calls `IPurchasesInventoryService.processIN()` to record the receipt (GRN posts the GRNI cycle).

### Periodic trading COA + starter

Epic 240 Phase 4 adds a dedicated **`periodic_trading`** COA template. It includes:

- Purchases
- Purchase Returns
- Purchase Discounts Received
- Sales
- Sales Returns
- Sales Discounts
- Goods / Opening Inventory
- Goods / Closing Inventory
- Trading Account
- the normal AR / AP / Cash / Bank / Equity / Tax support accounts

The **Simple Trading Company** starter now defaults to this COA and to `InventorySettings.accountingMode = PERIODIC`. In the sidebar, operational stock-flow documents (`Sales Orders`, `Delivery Notes`, `Purchase Orders`, `Goods Receipts`) are hidden by default for simple companies, but can still be surfaced if the workflow later needs them.

### Periodic report-time close

`PERIODIC` mode now relies on a **virtual close at report time**, not on per-transaction Inventory / COGS GL posting:

- **Balance Sheet** overrides the inventory asset line with report-time valuation at the report date.
- **Trading Account** computes gross profit as:
  - `Sales − (Opening Inventory + Net Purchases − Closing Inventory)`
- **Profit & Loss** reuses that same periodic cost-of-sales figure instead of trusting the raw purchases bucket as final expense.
- **Inventory Valuation report** exposes the pricing-policy switch directly to the user.

The report-time close uses the valuation service above and does **not** create an automatic closing voucher. Stock quantities and immutable ledger rows stay as posted; the reporting layer supplies the missing periodic carrying value.

### Purchase-invoice discount cost basis

For tracked Purchase Invoices in the perpetual modes:
- `INVOICE_DRIVEN`
- `PERPETUAL`

the stock receipt must capitalize at the **net discounted line total**, not the gross unit price. The accounting invariant is:

- stock movement total cost
- resulting moving average
- Inventory GL debit

must all use the same discounted basis.

Applied rule:
- direct PI receipts derive `unitCostBase` from `line.lineTotalBase / qtyInBaseUom`
- `totalCostBase` is `line.lineTotalBase`
- `unitCostCCY` / `totalCostCCY` mirror the discounted document totals

Boundary:
- in the two-step perpetual flow, the **GRN remains the stock-receipt authority**
- the later PI clears **GRNI** and must not create a second receipt
- `PERIODIC` is unaffected because it does not post inventory-asset lines per transaction

### Item-scoped line UOM selection

Document line UOM selection is item-scoped. The shared frontend selector
(`frontend/src/components/shared/selectors/UomSelector.tsx`) must build its selectable options from:

- the item's base UOM
- the item's sales and purchase UOMs
- active item UOM conversions returned by `/tenant/inventory/uom-conversions/:itemId`

The selector preserves the existing document payload shape (`uomId`, `uom`). It does not create or edit UOM
conversions; conversion maintenance remains in the item card. Because document pages may receive wrapped API
responses from the frontend client, the selector unwraps the conversion response before calling
`buildItemUomOptions()`. This prevents document line pickers from showing only the base UOM when an active
alternate conversion, such as BOX to PCS, exists.

### Item card Web/Windows parity

The item master card is a single shared component for Web page mode and Windows mode. UI mode may change the shell,
window frame, or navigation chrome, but it must not decide whether an item-card business section exists.

The Inventory tab must expose the same item sections in both modes, including:

- Inventory Tracking
- Managed UOM Defaults
- Item UOM Conversions

Windows item-card openings pass the selected item id through `WindowManagerContext` as `data.itemId`. `ItemCardWindow`
also accepts the older `data.id` payload as a compatibility fallback, but new callers should use `itemId` so the same
existing item is hydrated in Web and Windows modes. Without the selected item id, Windows mode can render the card as a
new/empty item and make existing-item UOM conversion maintenance appear unavailable.

GL accounts for adjustments/transfers are configured in **Inventory Settings → Accounting** (`defaultInventoryGainAccountId`,
`defaultInventoryLossAccountId`, `defaultInventoryTransferClearingAccountId`,
`defaultInventoryRevaluationAccountId`). These accounts have separate meanings:
Gain/Loss is for quantity adjustments, Transfer Clearing is for real added transfer costs, and Inventory
Revaluation is for value-only cost corrections.

### Item master card opening contract

Inventory item list rows open the shared `ItemMasterCard` in either normal page mode or Windows mode. Both modes must pass the backend item id into the card so `inventoryApi.getItem(id)` hydrates the full editable item record before rendering fields. The Windows wrapper accepts both `win.data.itemId` and the current list-page `win.data.id` payload shape; this prevents existing items from opening as blank new-item cards in Windows mode.

The item card remains a frontend hydration surface only. It does not change item repository reads, inventory valuation, UOM conversion math, GL mappings, posting, or tenant scoping.

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
| **Snapshot-based as-of valuation** | V2 | Current report-time valuation works by movement replay; Period Snapshots are still planned for faster audited closes. |

## Key Use Cases

| Use case | Purpose |
|---|---|
| `RecordStockMovementUseCase` | The cost engine. Implements `processIN()`, `processOUT()`, `processTRANSFER()`. |
| `InventoryValuationService` | Report-time valuation for Inventory Valuation, periodic Balance Sheet, Trading Account, and P&L. |
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
