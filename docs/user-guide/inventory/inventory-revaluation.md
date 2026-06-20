# Inventory Revaluation

> **What it does:** Corrects the **carrying cost** of inventory without
> changing the on-hand quantity. Re-prices the existing stock at a new
> average cost and (in live-inventory modes) posts a balanced GL voucher
> so the sub-ledger and the Inventory GL stay tied.

> **When to use it:** Use this when the on-hand **quantity is correct**
> but the average cost is wrong. For a quantity mistake (over/under count)
> use **Stock Adjustment** instead — Revaluation is **not** a quantity
> tool.

## Where to find it

**Inventory → Forms → Revaluations** in the sidebar.

Or directly: `#/inventory/revaluations` (list) /
`#/inventory/revaluations/new` (new) /
`#/inventory/revaluations/:id` (detail).

## Who can use it

Anyone with the `inventory.stock.adjust` permission. This is the same
permission that unlocks stock adjustment and stock transfer.

## What it looks like

The page is built on the same document scaffold as Stock Adjustment,
Opening Stock, and Stock Transfer — same header, same line table, same
readiness rail, same action footer. The labels and the editable
columns are different, on purpose.

| Section | Field | Editable? |
|---|---|---|
| **Document control** | Reason (`Cost correction`, `Costing basis change`, `Migration cleanup`, `Write-off`, `Other`) | Yes (draft only) |
| **Header** | Warehouse (only when costing basis is `WAREHOUSE`) | Yes (draft only) |
| **Header** | Revaluation date | Yes (draft only) |
| **Header** | Notes | Yes (draft only) |
| **Lines** | Item | Yes (draft only) |
| **Lines** | Current Qty | **Read-only** (snapshot) |
| **Lines** | Current Avg Cost | **Read-only** (snapshot) |
| **Lines** | Current Value | **Read-only** (computed) |
| **Lines** | New Avg Cost (Base) | **Yes** — the only quantity you change |
| **Lines** | New Value | Read-only (computed) |
| **Lines** | Value Delta | Read-only (computed) |

## Create a revaluation

1. Open **Inventory → Revaluations** and click **New Revaluation**.
2. Pick a **reason**. Defaults to `Cost correction`.
3. Pick a **revaluation date** with the date picker.
4. If your company uses **Per-Warehouse** costing, pick a **warehouse**.
   The page lets you change the warehouse later and auto-refills the
   current quantities and average costs on every line.
   If your company uses **Company-Wide (GLOBAL)** costing, the
   warehouse field is informational; the revaluation will update every
   warehouse to the new company average.
5. In the **lines** table, add an item (using the shared Item picker)
   and type the **New Avg Cost**. The line auto-fills the **Current
   Qty** and **Current Avg Cost** from the sub-ledger.
6. (Optional) Add a free-text **note** explaining why the revaluation
   is being recorded.
7. Click **Save Draft**. The revaluation is saved as `DRAFT` and you
   land on the detail view.

## Post a revaluation

> Posting is a balanced GL write in `INVOICE_DRIVEN` and `PERPETUAL`
> modes. Make sure the revaluation account is configured in
> **Inventory Settings → Default Inventory Revaluation Account** before
> you post.

1. Open the draft and click **Post Revaluation**.
2. Confirm in the dialog. The system does the following in one
   transaction:
   - Re-snapshots the current sub-ledger quantity and average cost so
     the delta is sourced from the authoritative on-hand, not the
     draft display.
   - Writes the new average cost to the target stock level(s) and
     updates the item's costing stats.
   - Posts a balanced `JOURNAL_ENTRY` voucher
     (Dr/Cr Inventory Asset vs the Inventory Revaluation account)
     through the same posting gateway that protects every other
     inventory GL write — period-lock, approval, and balance checks
     apply.
3. A toast confirms the post. The detail view now shows the linked
   voucher and the **POSTED** badge.

## Accounting mode behavior

| Mode | What posting does |
|---|---|
| `PERIODIC` | Updates the sub-ledger average cost. The next **Inventory Valuation** report uses the new basis. **No daily Inventory Asset GL voucher is created.** |
| `INVOICE_DRIVEN` / `PERPETUAL` | Updates the sub-ledger average cost **and** posts a balanced `JOURNAL_ENTRY` voucher. Sub-ledger and GL stay tied. |

If you post in `INVOICE_DRIVEN` / `PERPETUAL` mode and the
**Inventory Revaluation / Variance** account is not configured, the
post is refused with a readable error. Open
**Inventory → Settings** and set the **Default Inventory Revaluation
Account** to the dedicated variance account on your chart of accounts
(it is a separate account from the Stock Adjustment gain/loss accounts
in the standard COA — e.g. account `50105` *Inventory Revaluation* in
the standard chart).

## Posting rule

For each line the system writes a Dr/Cr pair with the absolute value
of `qtyOnHand × (newAvgCost − currentAvgCost)`:

- **Write-up** (new cost > current cost) →
  `Dr Inventory Asset / Cr Inventory Revaluation (Variance)`
- **Write-down** (new cost < current cost) →
  `Dr Inventory Revaluation (Variance) / Cr Inventory Asset`

A single revaluation document with multiple items can mix write-ups
and write-downs — each line gets the correct direction automatically.

## What you can and cannot do

| You can | You cannot |
|---|---|
| Revalue up or down any number of items in one document | Change the on-hand quantity — that is Stock Adjustment |
| Revalue a single warehouse (WAREHOUSE costing) | Re-price a single warehouse when costing basis is GLOBAL — the revaluation always re-prices every warehouse to the new company average |
| Post a revaluation when a periodic/INV-DRIVEN/PERPETUAL tenant has the revaluation account configured | Post a revaluation that would create a phantom GL — the system blocks any item with zero on-hand quantity |
| Use a corrective revaluation to undo a previous post (deferred one-click button; today you create a paired reverse revaluation manually) | Edit a posted revaluation — once posted, it is locked; corrections go through a new revaluation |

## Troubleshooting

**"Inventory Revaluation / Variance account is not configured."**
The default Inventory Revaluation account is missing in Inventory
Settings. Add it on the Inventory Settings page (in INVOICE_DRIVEN /
PERPETUAL mode). PERIODIC tenants do not need it.

**"Item has zero on-hand quantity."**
Revaluation requires positive stock. Receive stock first (Purchase
Invoice / Opening Stock) and then revalue.

**"Costing basis is WAREHOUSE: warehouseId is required for the
revaluation line."**
The revaluation was opened without a warehouse while the company is
on Per-Warehouse costing. Pick a warehouse in the document header.

**"Costing basis is GLOBAL: do not specify a warehouseId on the
revaluation line."**
The line was sent with a warehouseId but the company is on
Company-Wide costing. Remove the warehouseId on the line (it is
informational only in GLOBAL mode).

**"Only DRAFT inventory revaluations can be posted."**
The revaluation is already posted. To correct, create a paired
revaluation with the inverse value delta.

**Period lock error.**
The voucher goes through the same period-lock service as every other
GL write. Move the revaluation date into an open period, or open an
override per the existing override flow.

## Where it lives in the menu

`Inventory` → `Forms` → `Revaluations` (next to **Adjustments** and
**Transfers**). The icon is a `Scale` (balance) icon, to evoke
"revaluation / valuation".
