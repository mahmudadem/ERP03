# Inventory Revaluation — User Guide

A revaluation corrects the carrying value of stock without changing
quantity. Use it when the average cost in the sub-ledger has drifted
from reality (a manual GL fix, a past import, a costing basis switch,
a migration).

> **Quantity never changes.** The revaluation moves the *value* of stock,
> not the *count*. For quantity changes, use a regular **Stock
> Adjustment** instead.

## When to use it

- A manual journal entry was posted in a past period to inventory but
  the stock sub-ledger was not updated, leaving the books out of
  balance.
- An opening stock or migration loaded units into the sub-ledger
  without a matching GL posting, so the sub-ledger value does not tie
  to the Inventory GL account.
- The costing basis was switched (e.g., Global → Per-Warehouse) and
  the carried average needs a one-time restatement.
- The cost basis is wrong because of a known past bug that has since
  been fixed.

## What you need first

- **Inventory Revaluation / Variance** account configured in
  **Inventory → Settings → Accounting → Inventory Revaluation
  Account**. The revaluation is refused with a readable error if this
  is missing.
- A real `itemId` for each line. The page reuses the standard
  **ItemSelector**.
- The current sub-ledger snapshot is read automatically. You do **not**
  type the current avg cost — the form fills it in and the backend
  re-derives it from the live stock level at post time.
- Date in `YYYY-MM-DD` (uses your company's date format).

## Create a revaluation

1. Go to **Inventory → Forms → Revaluations** in the sidebar (or
   navigate to `#/inventory/revaluations`).
2. Click **+ New Revaluation**.
3. Pick the **Posting Date**.
4. Pick the **Reason**:
   - `COST_CORRECTION` — one-off fix
   - `BASIS_CHANGE` — costing basis switch
   - `MIGRATION_FIX` — opening stock or migration correction
   - `WRITE_OFF` — explicit write-down (e.g., for damage, expiry)
   - `OTHER`
5. Add a line per item. For each line:
   - Select the **Item** — the form auto-fills the current average
     cost (read-only) and current qty on hand.
   - Type the **New Average Cost (Base)** and **New Average Cost
     (CCY)**. The line shows the resulting **Value Delta (Base)** live.
6. Review the **Value Δ (Base)** and **Value Δ (CCY)** totals in the
   right rail. They should match the correction you want to apply.
7. (Optional) Add a note for the audit trail.
8. Click **Create Revaluation** to save the DRAFT. The page reloads
   the read view.

## Post a revaluation

1. Open the DRAFT revaluation.
2. Click **Post** in the footer.
3. The system re-snapshots the sub-ledger at post time (your typed
   value is recomputed authoritatively), writes the new average cost
   to the level, updates the item costing stats, and posts a balanced
   journal entry to the GL. The new voucher is linked to the
   revaluation.
4. Once posted, the revaluation is locked. To correct, create a
   follow-up revaluation.

## What the revaluation writes

For a revaluation with one line, item `X`, new avg cost `N`, current
avg cost `C`, qty `Q`, and value delta `V = Q × (N − C)`:

| Direction | Inventory Asset account | Revaluation / Variance account |
|-----------|--------------------------|----------------------------------|
| Write-up (`V > 0`) | Dr `V` | Cr `V` |
| Write-down (`V < 0`) | Dr `|V|` | Cr `|V|` |

Under **Global** costing (one company-wide average per item), the new
average is applied to every warehouse at once; the GL is still posted
once for the value delta. Under **Per-Warehouse** costing, the new
average is applied only to the named warehouse.

The sub-ledger **quantity is never touched** — the revaluation only
changes the per-unit carrying cost. After the post, the **Inventory ↔
GL Reconciliation** report should show drift = 0 for the affected item.

## Period lock, approval, and PERIODIC

- The revaluation posts through the same `PostingGateway` as every
  other inventory document. **Period lock** and **approval** are
  enforced there.
- In **PERIODIC** mode, the revaluation still updates the sub-ledger
  average (so the next report-time valuation is accurate) but does
  **not** post to the GL. The periodic P&L absorbs the change via
  report-time valuation.

## Troubleshooting

- **"Inventory Revaluation cannot be posted because no Inventory
  Revaluation / Variance account is configured."** Open Inventory
  Settings → Accounting and pick a `EXPENSE` or `REVENUE` account as
  the default Inventory Revaluation / Variance account.
- **"Account X has no Inventory Asset account."** Set the per-item
  Inventory Asset account on the item's Accounting tab, or set a
  default Inventory Asset account in Inventory Settings.
- **"All revaluation lines have zero value delta."** Your new
  average cost equals the current average cost. The revaluation
  intentionally refuses no-op posts; change the new average cost to
  produce a real value delta.
- **The new average cost did not stick on a single warehouse** —
  your company is on **Global** costing. Either set the per-warehouse
  line under **Per-Warehouse** costing, or leave the line without a
  warehouse to re-price the company-wide average.
- **The revaluation was rejected by the GL with a "PERIOD_LOCKED"
  error.** Close the period or wait until the locked period is
  reopened before re-trying.
