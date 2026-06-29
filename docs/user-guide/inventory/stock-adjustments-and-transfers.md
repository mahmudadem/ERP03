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
- **Default Opening Balance Account** — prefills Opening Stock Documents when you choose **Inventory + Accounting**.
  This should be an Opening Balance Equity / retained-earnings style account. You can override it on a document
  if a specific migration batch needs a different equity offset.
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
2. The page opens as a list. Click **New Adjustment** to open the document form.
3. Pick the **Warehouse**, **Date**, and **Reason**.
4. Add item lines. When you pick an item, the page **auto-fills the current quantity and the current average
   cost** for that warehouse.
5. Change the **New Qty** to the counted quantity. The **Adj Qty** and **Adj Value** are calculated for you.
   - You normally do **not** change the unit cost — it is already the real average cost. Only change it for a
     deliberate revaluation.
6. Click **Create Adjustment**, review the document, then **Post** it from the document or the list.

**What posts to the books:** a write-down (negative adjustment) debits the Inventory Loss account; a write-up
(positive adjustment) credits the Inventory Gain account. The value is always the item's *real* average cost,
so your stock value and your General Ledger stay in step. If a required account is missing you get a clear
message instead of a silent half-post.

## Opening Stock Documents

Use this when you start using ERP03 and need to enter stock that already exists.

1. Go to **Inventory → Opening Stock Documents**.
2. The page opens as a list. Click **New Document** to open the form.
3. Choose the warehouse and document date.
4. In the **Create Accounting Effect** control section, choose:
   - **No** for inventory-only migration batches.
   - **Yes** to create the opening inventory accounting voucher.
5. When **Yes** is selected, the **Opening Balance / Clearing Account** is filled from Inventory Settings. You can override it for the document, but it must be an equity account such as Opening Balance Equity or retained earnings.
6. Add stock-tracked item lines with quantity, unit cost, currency, and FX rates where needed.
7. Save as draft, then post when reviewed. Drafts can be edited or deleted. Posted documents are locked.

If the list says there are no Opening Stock Documents but shows a warning about legacy opening-stock movements,
open **Stock Movements** from the warning and review those old rows before creating a new document. The stock may
already have been entered through an older direct movement flow. Creating a new Opening Stock Document for the same
items would duplicate the quantity.

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
