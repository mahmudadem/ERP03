# Task 223 — Inventory Revaluation (value-only cost correction)

**Status:** Backlog (post-pilot candidate). Logged 2026-06-13.
**Module:** Inventory · **Touches:** Accounting (GL posting)
**Owner-confirmed need:** during GP02 GLOBAL costing QA on TESTCO, the only un-fixable
state was item `001`'s value drift (stock value ≠ GL). There is no in-app way to correct a
**wrong average cost** without changing quantity. This task fills that gap.

## Problem

Our Stock Adjustment only corrects **quantity** — it computes
`adjustmentQty = newQty - currentQty` and values it at the engine's moving-average cost.
There is no document that corrects **value/cost alone**.

Real-world situations that need a value-only fix (item cannot be deleted — it has history):
- Average cost is wrong from a past bug or a manual GL entry that bypassed the sub-ledger.
- Costing basis intent was wrong (e.g. should have been Per-Warehouse but ran Global, or vice
  versa) and the carried average needs restating.
- Opening stock / migration loaded units into the stock module without a matching GL posting
  (exactly item `001`: sub-ledger 12,773 vs GL ~0).

Standard ERP name for the tool: **Inventory Revaluation** / **Cost Adjustment**
(SAP MR21, Oracle, NetSuite, Dynamics all have it).

## Proposed behavior

A new **Inventory Revaluation** document:
- Pick item (+ warehouse when basis = Per-Warehouse; company-wide when basis = Global).
- Show current qty + current average cost (read-only) and **new average cost** (or **new total
  value**) as the input. **Quantity never changes.**
- Compute `valueDelta = qty × (newAvgCost − currentAvgCost)`.
- Post the delta to GL: `Dr/Cr Inventory Asset` vs a dedicated **Inventory Revaluation /
  Variance account** (new setting; can default to the existing Inventory Gain/Loss accounts).
- Update the sub-ledger average so sub-ledger and GL stay equal after posting.
- GLOBAL basis: a revaluation re-prices the item across **all** warehouses (mirror the receipt
  fan-out in `RecordStockMovementUseCase.processINGlobal`). Per-Warehouse: only the named
  warehouse.
- Append-only audit: store before/after avg cost, delta, reason, user, date. Respect
  period-lock and the posting gateway like every other ledger door.

## Acceptance / QA
- Revalue an item up and down; quantity unchanged; sub-ledger avg updates; GL Inventory moves
  by exactly `valueDelta`; **Inventory ↔ GL Reconciliation ties** afterward.
- GLOBAL: revaluing re-prices every warehouse to the new company average.
- Per-Warehouse: only the target warehouse changes; others untouched.
- Blocked cleanly under a locked period / missing revaluation account (readable error).

## Boundary / notes
- Engine math (moving average, receipt/issue blending, GLOBAL vs WAREHOUSE) is already correct
  and is NOT changed by this task — this only adds a value-only correction path.
- Out of scope: bulk/CSV revaluation, FX revaluation of foreign-currency cost layers.
- Relates to: [221 inventory deep stabilization epic](./221-inventory-deep-stabilization-epic.md),
  the GL reconciliation report (`ReconcileInventoryGLUseCase`).
- Cross-note: the separate Purchase Invoice **discount cost-basis mismatch** is closed by
  [240b phase 2](./240b-phase2-discount-cost-basis-fix.md). Task 223 remains the backlog item
  for **value-only revaluation/correction** cases where quantity stays unchanged but valuation
  must be restated.
