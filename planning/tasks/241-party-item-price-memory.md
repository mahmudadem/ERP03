# Task 241 — Party × Item price memory (per-currency last prices + per-party last prices)

**Status:** Implemented and validated 2026-06-19; awaiting owner-approved commit/merge. Authored 2026-06-18. **Owner-expanded 2026-06-19** (multi-currency model + FX cost basis).
**Module:** Sales + Purchases + Inventory (cross-cutting) · **Depends on:** [Epic 240](./240-simple-periodic-mode-and-item-costing-epic.md) Phase 3 (shares the posting-time price-capture hook).
**Relates to:** existing price-lists module (sales/purchase price lists — `planning/done/131-purchase-price-lists.md`).
**Companion brief (READ FIRST):** [briefs/20260619-inventory-fx-valuation.md](../briefs/20260619-inventory-fx-valuation.md) — the inventory valuation / selling-profit FX cost basis this feature reads from.

---

## ⭐ Owner-confirmed model (2026-06-19) — read this before the original spec below

The original spec below covered only **last-for-party**. The owner expanded it to a three-category, per-currency model. Where this section and the original spec differ, **this section wins**.

### Three price categories, two directions (sale / purchase)
| Category | What it is | Stored how |
|---|---|---|
| **Last-event** | Last price the item was sold to / bought from **anyone** | natively, **per (currency × UOM)** |
| **Last-for-party** | Last price sold to **this customer** / bought from **this vendor** | natively, **per (currency × UOM)**, keyed by party |
| **Average cost** | The single moving-average **cost** (cost only — there is **no** "average sale price") | **once, in the item's main currency + base/stock UOM**; derived for other currencies/UOMs at the document's rate + UOM factor |

### Currency & UOM rule (the core architecture)
- **Observed prices (last-event, last-for-party) are stored natively per (currency × UOM).** If we sold in USD at 1.30 USD **per box**, we keep `1.30 USD / box` as a fact. Each `(currency, uomId)` combination we transact in gets its own record. Same customer can hold a last-SYP-per-piece price and a last-USD-per-box price side by side; they never overwrite each other.
- **Average cost is NOT per currency and NOT per UOM.** It is one source of truth in the item's main currency **and base/stock UOM** (e.g. SYP per piece). A foreign-currency or non-base-UOM document derives the cost figure from that single average **at the document's own exchange rate** (FX) **and the item's UOM conversion factor** — never a separately-maintained "USD average" or "per-box average" (parallel averages would drift / double-count FX or unit conversion).

### Reading prices for a document line
- Document currency == item main currency **and** line UOM == base UOM → read that `(currency, uom)` record directly (last, last-for-party, avg).
- Otherwise → read the **last / last-for-party** from the **exact matching `(currency, uomId)`** native record (no match → fall through the resolution chain; do **not** convert another UOM's price); **compute avg cost** from the single base average via the FX cost basis (below) **+ UOM factor**.

### Cost vs price derivation across UOM (Sales/Purchases setting)
**Cost and price behave differently when a line's UOM has no record:**
- **COST is always derived across UOM** (and currency) — it's deterministic math on the single base-currency + base-UOM average (× UOM factor, × FX). Never optional.
- **PRICE (last / last-for-party) cross-UOM derivation is OPTIONAL** — separate flags `salesSettings.deriveLinePriceAcrossUom` and `purchaseSettings.deriveLinePriceAcrossUom` (default **false**):
  - **ON:** if the line's `(currency, uomId)` has no recorded price but another UOM **for the same party + same currency** does, derive the default via the UOM conversion factor — e.g. box sold at **10**, box = **4** units → unit defaults to **2.5** (10 ÷ 4). Overridable.
  - **OFF:** leave the price **blank** until a real transaction in that UOM records it (the "unseen UOM → blank" behavior).
- **Scope:** derivation is **same party + same currency, across UOM only**. A price is **never** derived across currencies (FX fluctuates; a UOM factor is a fixed ratio, a price is a negotiated fact).

### FX cost basis (the avg-in-a-foreign-currency choice) — see the companion brief
Company setting **`inventoryFxCostBasis`**: **`REPLACEMENT` (default)** | `HISTORICAL`. This same setting drives stock valuation and COGS in the [FX valuation brief](../briefs/20260619-inventory-fx-valuation.md):
- `REPLACEMENT` → cost = stable-currency-anchored replacement cost (e.g. the real `1 USD` you paid).
- `HISTORICAL` → cost = recorded base average ÷ document rate (the strict-GAAP view).

### Owner decisions locked
1. **Average = cost only.** One moving-average cost; no "average selling price."
2. **Unseen currency → always blank.** A document in a currency we have no record for → leave the price **blank / manual** (never derive a price across currencies). The value the user types becomes the first record for that currency.
3. **Unseen UOM → flag-controlled.** A line in a UOM with no record → **blank** by default, OR **derived via the UOM conversion factor** if `deriveLinePriceAcrossUom` is ON for that module (Sales/Purchases), same party + same currency.
4. **Cost is always derived across UOM/currency; price derivation across UOM is optional (the flag above). Price is never derived across currency.**
5. **Default cost basis = `REPLACEMENT`** (volatile base currency); `HISTORICAL` available as a setting.
6. **Prices are UOM-recorded.** Every observed price point carries its `uomId`; the storage key for last / last-for-party is `(party?, item, currency, uomId)`. Average cost is held once in base currency + base/stock UOM and converted (FX × UOM factor) when a line differs.

---

## Goal
Remember, per **(party × item)** pair, the price we actually transacted with *that specific party* for *that specific item*, so a new document can **default each line to that party's own price**:
- Customer + item → **last sale price** to that customer.
- Vendor + item → **last purchase cost** from that vendor.
- Future: a **fixed negotiated/contract price** per party that overrides "last".

End-goal UX: start an invoice → choose the party → add items → each line's unit price **pre-fills** from this party's price (overridable), per a configurable resolution chain.

## Why a dedicated store (architecture decision)
- Many-to-many, unbounded (party↔item). Must NOT live on `Item` or `Party` (document bloat / size limits).
- Access pattern is a **point lookup** by (party,item) → use a **composite document id** for O(1) reads.
- **Firestore:** `companies/{companyId}/party_item_prices/{partyId}__{itemId}`
- **SQL:** table `party_item_prices`, PK `(company_id, party_id, item_id)` (parity).

## Schema (reuse `CostPoint` from Epic 240 §3)
```ts
interface PricePoint extends CostPoint {        // base, ccy, currency, fxRateToBase, asOf, source
  qty?: number;        // qty on the source line
  uomId?: string;
}

// Map key convention for all observed-price maps below: `${currencyCode}__${uomId}`
//   e.g. "USD__uom_box", "SYP__uom_piece". `uomId` is REQUIRED on every PricePoint.
type CcyUomKey = string;

// Last-for-party — keyed by (party, item), holding ONE point per (currency × UOM) per direction.
interface PartyItemPrice {
  companyId: string;
  partyId: string;
  itemId: string;
  // ⭐ per (currency × UOM): map of `${currency}__${uomId}` → last native price point
  lastSaleByCcyUom?: Record<CcyUomKey, PricePoint>;      // last SELLING price to this party
  lastPurchaseByCcyUom?: Record<CcyUomKey, PricePoint>;  // last COST from this party
  // Future-ready (schema reserves; not implemented now):
  contractSale?: PricePoint & { effectiveFrom?: string; effectiveTo?: string };
  contractPurchase?: PricePoint & { effectiveFrom?: string; effectiveTo?: string };
  extra?: Record<string, PricePoint>;   // forward-compatible linked-data bag
  updatedAt: Date;
}
```

**Last-event** (item-level, NOT party-scoped) lives on the item's existing `costingStats` (Epic 240 §4 — already on `main`), extended to per (currency × UOM):
```ts
// extend costingStats: last sold/bought to/from ANYONE, per (currency × UOM)
lastSalePriceByCcyUom?: Record<CcyUomKey, PricePoint>;     // key = `${currency}__${uomId}`
lastPurchaseCostByCcyUom?: Record<CcyUomKey, PricePoint>;
// avgCost stays a SINGLE base-currency + base/stock-UOM value (no per-currency/per-UOM variant) — see brief
```

FX-accurate: every point stores base + original transaction currency + rate + date + `uomId` (so a later FX revaluation can recompute). Source records `{ docType, docId, docNo }`. **Average cost is never stored per currency or per UOM** — it is one base-currency + base-UOM value, converted at the document's rate (× UOM factor) per `inventoryFxCostBasis` (see [companion brief](../briefs/20260619-inventory-fx-valuation.md)).

## Write path (mode-agnostic — all 3 inventory modes)
On posting of **Sales Invoice, Sales Return, Purchase Invoice, Purchase Return**, upsert one `party_item_prices` record per line, in the **same transaction** as the posting, idempotent on re-post:
- Sales docs → set `lastSale` from the line **selling price** (not COGS).
- Purchase docs → set `lastPurchase` from the line **unit cost**.
This is the granular sibling of Epic 240 §4's item-level `lastSale`/`lastPurchase`: the same hook updates **both** the global item stat and the per-party stat.

## Read path / line-price resolution chain
When defaulting a document line's unit price (party known + item chosen), walk:
1. **Contract/negotiated** price for (party,item) if effective *(future)*
2. **Active price list** for the party/item *(existing price-lists module — reconcile, do not duplicate)*
3. **Last transaction price to this party** *(this task: read `party_item_prices/{partyId}__{itemId}`)*
4. **Item default** `salePrice`/`purchasePrice`
5. Manual / empty
- Add a company setting `defaultLinePriceSource` (e.g. `LAST_PARTY_PRICE | PRICE_LIST | ITEM_DEFAULT`) selecting the default behavior; the user can always override the line.
- Read performance: direct composite-id read with a small client cache; optional batch endpoint `GET /parties/:id/item-prices?itemIds=...` to prefetch when the party is selected.

## UI
- On sales/purchase document lines: when party + item are set, pre-fill unit price from the resolution chain; show a subtle hint ("last sold to {party} at {price} on {date}") and allow override.
- Optional read-only "Customer/Vendor price history" panel on the Party card and/or Item card (later).

## Acceptance / QA
- Sell item X to customer A at price P → next invoice for A defaults line to P (overridable).
- Buy item X from vendor V at cost C → next PI for V defaults line to C.
- Resolution chain respects price lists (no duplication/conflict); company `defaultLinePriceSource` switches behavior.
- Idempotent re-post (no duplicate/incorrect price points).
- Firestore + SQL parity; no backfill needed (no production data).

### Per-currency + FX scenarios (owner-confirmed 2026-06-19)
Item A: main currency SYP, recorded avg cost 8,000 SYP. USD docs in these examples use rate 1 USD = 10,000 SYP unless noted.
1. **Sale, invoice in SYP** → reads SYP records directly: last-for-party / last-event / avg all in SYP. Avg used = 8,000 SYP.
2. **Sale, invoice in USD** → last-for-party (e.g. 1.30 USD) and last-event (1.25 USD) read **natively from USD records**; avg cost is **computed** from the single SYP average at the document rate per `inventoryFxCostBasis` (REPLACEMENT → USD-anchored cost; HISTORICAL → 8,000 ÷ 10,000 = 0.80 USD).
3. **Purchase, invoice in SYP** → reads SYP purchase records; posting recomputes the SYP moving average.
4. **Purchase, invoice in USD** → USD purchase records stored natively; on posting, the line cost is converted to SYP at the doc rate and folded into the **single SYP** moving average.
5. **First sale to a brand-new customer** → no last-for-party → chain falls to last-event → item default; UI shows which source filled the line.
6. **Same customer, two currencies** → last-SYP and last-USD kept side by side; SYP doc defaults from SYP record, USD doc from USD record; never overwrite each other.
7. **Currency never transacted before** → that currency's last / last-for-party is empty → line stays **blank/manual** (decision: no auto-convert seed); the typed value becomes the first record for that currency.
8. **Volatile-rate costing** (see [brief](../briefs/20260619-inventory-fx-valuation.md)): bought 1 unit @ 1 USD at rate 1,000; rate now 12,000 → under `REPLACEMENT`, stock value = 12,000 SYP, selling profit segregates real margin from the 11,000 SYP holding gain.
9. **Per-UOM prices:** sell item A at 1.30 USD **per box** and 0.12 USD **per piece** (12 pieces/box) → both kept as separate `(USD, box)` and `(USD, piece)` records; a USD-per-box line defaults to 1.30, a USD-per-piece line defaults to 0.12; they never overwrite each other. Avg cost for a non-base-UOM line is the single base average × UOM factor (× FX if foreign — always derived).
10. **Cross-UOM price flag:** sold a **box at 10** (box = 4 units), no per-unit price recorded yet. With `salesSettings.deriveLinePriceAcrossUom` **OFF** → a unit line stays **blank**. With it **ON** → the unit line defaults to **2.5** (10 ÷ 4), same party + same currency, overridable. Cost is unaffected — always derived regardless of the flag. The flag never derives across currencies.

## Out of scope (reserved in schema only)
- Contract/negotiated effective-dated pricing engine.
- Full per-party price-history timeline UI (store only `last*` now; `extra`/history is forward-compatible).
- Volume/tier pricing.

## Notes
- Backend changes take effect only after `npm run build` (tsc→`lib/`); verify via real round-trip.
- Every new report (if any) uses `<ReportContainer>` + `moduleMenuMap.ts`.
