# 185 — Deferred cost settlement: recognize COGS when cost becomes known

**Status:** Open (confirmed missing feature)
**Severity:** 🔴 High — silently understates COGS / overstates inventory & profit, indefinitely, for any sale made before its cost exists.
**Origin:** Mahmud QA scenario 2026-06-08 (sold an item with no settled cost → COGS 0 → never settled). Verified by code dig.
**Related:** [Task 184 Finding 3](./184-posting-qa-findings.md) (standalone returns) — the same cost-basis problem; and [Task 183](./183-fx-correctness-epic.md) (costing correctness).

## Confirmed state (2026-06-08 code dig)

The system can **track** and **report** deferred cost, but cannot **settle** it:

| Capability | Status | Evidence |
|---|---|---|
| Flag an OUT movement as unsettled at creation | ✅ | `RecordStockMovementUseCase`, `SalesInvoiceUseCases:1140`, `DeliveryNoteUseCases:406`, `PurchaseReturnUseCases:740` set `settledQty`/`unsettledQty`/`unsettledCostBasis`/`costSettled` |
| Skip/defer COGS when no settled cost | ✅ | SI `cogsStatus = 'SKIPPED_UNSETTLED_COST'`; posts COGS 0 |
| Report unsettled costs | ✅ | `GetUnsettledCostReportUseCase` (read-only filter/reduce), dashboard `getUnsettledMovements` count |
| `'SETTLEMENT'` movement type | ⚠️ defined but never created | enum has it; only reached as a `default:` fallback in a type-mapper ([RecordStockMovementUseCase.ts:603](../../backend/src/application/inventory/use-cases/RecordStockMovementUseCase.ts:603)) |
| **Recognize deferred COGS later / flip unsettled→settled / post settlement voucher** | ❌ **MISSING** | `settledQty` is never mutated after creation; no settle/backfill/recognize use case exists |

## Consequence if left as-is

For any unit sold before its cost is established (negative-stock sale, item with no purchase cost yet):
- COGS stays understated (0 or partial) **forever** → **profit overstated**.
- Inventory value stays **overstated** (the cost never leaves the asset).
- The 0/under-cost unit **pollutes the moving average** for every later sale.
- The unsettled-cost report grows monotonically with no mechanism to clear entries.

## What to build

A **cost-settlement** mechanism that, when an item's cost becomes known, recognizes the COGS that was deferred on its earlier OUT movements.

### Trigger (when does cost become "known"?)
- Primary: when a **purchase posts** (PI/GRN) that establishes a cost for an item with outstanding unsettled OUT movements → settle those movements (FIFO by `postingSeq`) up to the received quantity.
- Optional: a **manual "Settle Costs" action** (operator runs it from the unsettled-cost report) and/or a periodic job.

### Settlement posting (per settled unit/qty)
At settlement, with the now-known cost $C for a previously-deferred OUT of qty Q:
```
Dr COGS        C×Q     recognize the cost of the earlier sale
   Cr Inventory C×Q     remove the now-known cost from the asset
```
Plus: create a `'SETTLEMENT'` stock movement (the type already exists), increment `settledQty` / decrement `unsettledQty` on the original OUT movement, set `costSettled = true` when fully settled. Route through `SubledgerDocumentPoster` (Task 178) — it's another subledger posting.

### Edge cases
- **Returned before settlement:** if the unit was returned (qty came back) before its cost settled, the deferred obligation must be **cancelled**, not settled — don't recognize COGS for a unit that's no longer "sold". (Ties to Task 184 Finding 3.)
- **Partial settlement:** a purchase covers only part of the outstanding unsettled qty → settle FIFO partially, leave the rest unsettled.
- **Cost arrives at a different value than any guess:** the deferred amount uses the *actual* settled cost, overriding any avg/last-known estimate displayed earlier.
- **Period lock:** the settlement voucher dates — at the purchase/settlement date or the original sale date? Decide (likely settlement date) and respect period locks + override.

### Definition of done
- A settlement use case recognizes deferred COGS when cost becomes known, posts `Dr COGS / Cr Inventory`, creates the SETTLEMENT movement, and flips `unsettled→settled`.
- Triggered on purchase posting (and/or manual action); FIFO partial settlement supported.
- Returned-before-settled cancels rather than settles.
- The unsettled-cost report shrinks as items settle; dashboard count reflects it.
- Tests: a sale-before-cost → purchase arrives → COGS recognized at the real cost; partial; returned-before-settle; period-lock interaction.
- Docs: `docs/architecture/inventory-costing.md` + user guide on deferred cost & settlement.

## Note
This is the foundation that makes negative-stock / sell-before-buy perpetual costing actually correct. Until it exists, **`allowDeferredCost` should be treated as "defers COGS but never recognizes it"** — a sharp edge worth a warning in the settings UI.
