# Phase 2 (Epic 240) — backlog-223 discount cost-basis fix (perpetual + invoice-driven)

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** nothing · **Parallel-safe:** yes (independent of Phase 3+)
**Unblocks:** golden-path GP05 step 4.

## Problem
On a Purchase Invoice with a line discount, the **GL inventory debit uses the NET (post-discount) line total** but the **stock moving-average cost uses the GROSS unit price**, so stock value ≠ Inventory GL by exactly the discount. Observed in GP05: Inventory GL 1,277.5 vs stock valuation 1,300 (drift 22.5 = a 5% line discount). Every voucher balances — this is a cost-basis mismatch, not a posting bug.

## Root cause (verified)
`backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`:
- GL side: `freezeTaxSnapshotSync` computes `line.lineTotalBase` from the **discounted** `postDiscountDoc` (~lines 1011–1020). Correct.
- Stock side: the stock movement uses **gross** cost — `unitCostBase: line.unitPriceBase` (line ~705) where `line.unitPriceBase = line.unitPriceDoc * rate` (line ~1019) — discount NOT applied. Wrong.

## Fix
For tracked items in `INVOICE_DRIVEN` and `PERPETUAL` modes, derive the stock movement unit cost from the **net discounted line total** so stock avg cost == GL inventory debit:
- `unitCostBase = roundMoney(line.lineTotalBase / qtyInBaseUom)`
- `totalCostBase = line.lineTotalBase`
- mirror the `…CCY` values from `line.lineTotalDoc`
- use the net unit cost in the `avgCostBaseAfter` moving-average blend (line ~713).
- Re-derive `qtyInBaseUom` consistently with the existing UOM conversion already computed in that block.

Then **verify the GRN→PI (PERPETUAL two-step) path** does not reintroduce the gap (the GRN may set inventory at gross at receipt; confirm PI clearing nets correctly). Grep for the Goods Receipt posting use-case and check its cost basis.

**Note:** in `PERIODIC` mode (Phase 4) this is moot — no inventory asset posting — but this fix is still required for the two perpetual modes.

## Tests
- New regression: PI with a line discount → resulting `StockLevel.avgCostBase` × qty == the Inventory GL debit (drift 0).
- Re-run the purchases + inventory Jest slices (no regressions).
- `npm run build` (tsc→`lib/`) — backend emulator serves compiled `lib/`, so build is required to verify a real round-trip.

## Acceptance
- On a perpetual/invoice-driven tenant, GP05 step-4 Inventory-GL-vs-valuation drift → 0.
- All voucher balances unchanged; no change to AP/AR/tax math.

## Definition of Done
- `planning/done/240b-phase2-discount-cost-basis-fix.md` (include the QA script).
- Update `docs/architecture/inventory.md` (cost-basis note), JOURNAL, ACTIVE. Close backlog-223 / cross-note in [223](./223-inventory-revaluation-value-only-correction.md).
