# Stock Adjustments, Transfers, Prices & GL Reconciliation

This guide covers the inventory features refreshed in the June 2026 stabilization pass. It is written for
everyday users — no accounting background needed.

## Setting your inventory GL accounts (one-time)

Go to **Inventory → Settings → Accounting** and set:

- **Default Inventory Asset Account** — where the value of stock on hand lives.
- **Inventory Loss / Write-down Account** — used when you remove stock you no longer have (damage, shrinkage,
  expiry). If you leave it blank, the item's COGS account is used.
- **Inventory Gain / Write-up Account** — used when you add stock you found. Falls back to COGS if blank.
- **Inventory Transfer Clearing Account** — used by *valued* transfers (see below).
- **Costing Basis** — **Per Warehouse** (default) keeps a separate moving-average cost for each
  item in each warehouse. **Global** keeps a single company-wide average per item, so every warehouse
  issues stock at the same cost and a purchase into one warehouse re-prices the item everywhere. Both
  are live; choose one at setup, because switching after movements exist is not recommended.

These only matter when the Accounting module is enabled.

## Item prices

Open any item → **Pricing** tab → **Default Prices**. You can now set a **Default Sale Price** and a
**Default Purchase Price**. The sale price is used as a fallback on sales documents when no customer price
list applies. (The multi-tier **Price Groups** below it still work as before.)

## Stock Adjustments

Use this to correct stock quantities (count corrections, damage, found stock).

1. Go to **Inventory → Adjustments**.
2. Pick the **Warehouse**, **Date**, and **Reason**.
3. Add item lines. When you pick an item, the page **auto-fills the current quantity and the current average
   cost** for that warehouse.
4. Change the **New Qty** to the counted quantity. The **Adj Qty** and **Adj Value** are calculated for you.
   - You normally do **not** change the unit cost — it is already the real average cost. Only change it for a
     deliberate revaluation.
5. Click **Create Adjustment**, then **Post** it from the list below.

**What posts to the books:** a write-down (negative adjustment) debits the Inventory Loss account; a write-up
(positive adjustment) credits the Inventory Gain account. The value is always the item's *real* average cost,
so your stock value and your General Ledger stay in step. If a required account is missing you get a clear
message instead of a silent half-post.

## Stock Transfers — Flat vs Valued

Go to **Inventory → Transfers**, choose source and destination warehouses, add item lines, then pick a **Mode**:

- **Flat** (default) — moves stock from A to B at its current cost. No accounting entry. Use this for normal
  internal moves.
- **Valued** — lets you set a **Landed Unit Cost** per line (for example, to add freight you paid to move the
  goods). The extra value (the "uplift") is added to the destination stock value and posted to the books
  against the **Inventory Transfer Clearing** account, so everything stays balanced. The destination's average
  cost rises by the uplift.

Complete a draft transfer with **Complete**. A **GL ✓** in the list means a valued transfer posted an entry.

## Stock Levels — by item or by warehouse

**Inventory → Stock Levels** now shows **one row per item** by default, with the total quantity and a blended
average cost across warehouses. Expand a row to see each warehouse. Switch to **By Warehouse** for the flat
view, and filter with the warehouse dropdown.

## Inventory ↔ GL Reconciliation report

**Inventory → Reports → Inventory GL Reconciliation** compares your stock value (quantity × average cost) to
the General Ledger balance of your inventory accounts, as of any date. A green banner means they tie out; an
amber banner with "Drift" rows means the stock value and the ledger disagree for an account — investigate
before closing the period. This is your safety net for catching costing or posting problems early.
