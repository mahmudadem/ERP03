# Task 241 — Party × Item price memory (customer/vendor-specific last & contract prices)

**Status:** Planned (spec complete, not started). Authored 2026-06-18.
**Module:** Sales + Purchases + Inventory (cross-cutting) · **Depends on:** [Epic 240](./240-simple-periodic-mode-and-item-costing-epic.md) Phase 3 (shares the posting-time price-capture hook).
**Relates to:** existing price-lists module (sales/purchase price lists — `planning/done/131-purchase-price-lists.md`).

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
interface PartyItemPrice {
  companyId: string;
  partyId: string;
  itemId: string;
  lastSale?: PricePoint;        // last unit SELLING price to this party (customer direction)
  lastPurchase?: PricePoint;    // last unit COST from this party (vendor direction)
  // Future-ready (schema reserves; not implemented now):
  contractSale?: PricePoint & { effectiveFrom?: string; effectiveTo?: string };
  contractPurchase?: PricePoint & { effectiveFrom?: string; effectiveTo?: string };
  extra?: Record<string, PricePoint>;   // forward-compatible linked-data bag
  updatedAt: Date;
}
```
FX-accurate: every point stores base + original transaction currency + rate + date (so a later FX revaluation can recompute). Source records `{ docType, docId, docNo }`.

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
- Foreign-currency party/item: price stored + defaulted correctly in both currencies.
- Resolution chain respects price lists (no duplication/conflict); company `defaultLinePriceSource` switches behavior.
- Idempotent re-post (no duplicate/incorrect price points).
- Firestore + SQL parity; no backfill needed (no production data).

## Out of scope (reserved in schema only)
- Contract/negotiated effective-dated pricing engine.
- Full per-party price-history timeline UI (store only `last*` now; `extra`/history is forward-compatible).
- Volume/tier pricing.

## Notes
- Backend changes take effect only after `npm run build` (tsc→`lib/`); verify via real round-trip.
- Every new report (if any) uses `<ReportContainer>` + `moduleMenuMap.ts`.
