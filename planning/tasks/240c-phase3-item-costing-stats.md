# Phase 3 (Epic 240) — Item costing stats: avg / last-purchase / last-sale (mode-agnostic, FX-accurate, extensible)

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** nothing · **Parallel-safe:** yes (independent of Phase 2)
**Feeds:** Phase 5 (valuation reads these) and Task [241](./241-party-item-price-memory.md) (party×item prices use the same posting hook).

## Objective
Store, **per item**, continuously-updated, FX-accurate cost/price statistics, with a schema that accepts future methods without migration:
- **average cost** (moving-average rollup)
- **last known purchase cost**
- **last known sale price**

## Current state (verified)
- Per-warehouse cost lives on `StockLevel` (`avgCostBase/CCY`, `lastCostBase/CCY`) — keep, unchanged. The engine needs it to cost issues.
- `Item` (`backend/src/domain/inventory/entities/Item.ts`) has only static `salePrice`/`purchasePrice` hints and `costingMethod` hardcoded to `'MOVING_AVG'`.
- `StockMovement` already carries `unitCostBase/CCY`, `movementCurrency`, `fxRateMovToBase`, `fxRateCCYToBase` — the FX foundation. Sale *price* is NOT in stock movements (they carry COGS cost); it lives on the sales document line.

## Schema (add — do NOT remove per-warehouse cost)
On `Item` (sub-object) or a sibling `companies/{cid}/item_costing/{itemId}` doc if write-contention is a concern:
```ts
interface CostPoint { base: number; ccy: number; currency: string; fxRateToBase: number; asOf: string; source?: { movementId?: string; refType?: string; refId?: string }; }
interface ItemCostingStats {
  avgCost: CostPoint;            // moving-avg rollup: GLOBAL basis = company-wide; WAREHOUSE basis = qty-weighted across warehouses
  lastPurchaseCost?: CostPoint;  // set on every PURCHASE_RECEIPT IN
  lastSalePrice?: CostPoint;     // set on every sale, from the SELLING price (not COGS)
  extra?: Record<string, CostPoint>;  // forward-compatible: standardCost, fifoCost, highest/lowest...
}
```
- Generalize `ItemCostingMethod` from `'MOVING_AVG'` to an open union `'MOVING_AVG' | 'STANDARD' | 'FIFO' | string` (only `MOVING_AVG` is enforced/working; others reserved).
- Add `InventoryPricingPolicy = 'AVERAGE' | 'LAST_PURCHASE' | 'STANDARD' | string` (report-time read policy; does NOT affect posting).

## Update rules / wiring
- IN cost + avg/last per-warehouse update today: `RecordStockMovementUseCase.ts:152–165`; GLOBAL fan-out at `~786`, `~841`, `~928`. **Add the item-rollup update alongside these**: recompute `avgCost` per `costingBasis`, set `lastPurchaseCost` from the movement (base + ccy + fx + date).
- **IMPORTANT — there are TWO purchase IN paths (found during Phase 2 audit, 2026-06-18):** Purchase Invoice receipts do NOT go through `RecordStockMovementUseCase`. They build the `StockMovement` and update `StockLevel` **inline** inside `PurchaseInvoiceUseCases.ts` — the receipt block guarded by `!goodsAlreadyReceived(line, po)` (~lines 642–765). Phase 2 added the net-cost + `level.avgCostBase/avgCostCCY/lastCostBase/lastCostCCY` write-back there (this write-back did not exist before Phase 2). **You MUST hook the item-rollup update in this inline PI block too**, or purchase invoices will silently skip item-level costing stats. Also check the Goods Receipt use-case for a similar inline path.
- **Sale price capture:** add a hook in the sales posting path (`SalesInvoiceUseCases.ts`, `DeliveryNoteUseCases.ts`) to set `lastSalePrice` from the line **selling price** — source `unitPriceDoc`, document `currency`, `exchangeRate` → compute base. Runs in all 3 modes.
- All updates **transactional** with the movement/posting write and **idempotent** on re-post.
- **FX:** always store both base and transaction-currency values + the rate + date, so a future FX revaluation can recompute.

## Repos / parity
- Update the Firestore item repository **and** the SQL repository/table (column or JSON blob) — keep parity. No backfill needed (no production data).
- Surface the stats in the Item read DTO + Item card UI (read-only): avg cost, last purchase, last sale.

## Tests
- Purchase receipt updates `avgCost` + `lastPurchaseCost`; verify for a **foreign-currency** cost item (base + ccy both correct).
- Sale updates `lastSalePrice` from the selling price (not COGS), foreign-currency too.
- Idempotent re-post (no double application).
- `npm run build`; verify via a real emulator round-trip.

## Acceptance
- Item card shows live avg cost / last purchase / last sale; correct in a non-base cost currency; schema cleanly accepts a new `extra` key without migration.

## Definition of Done
- `planning/done/240c-phase3-item-costing-stats.md` (with QA script), `docs/architecture/inventory.md` + user-guide update, JOURNAL, ACTIVE.
