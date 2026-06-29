# Inventory — User Guide

The Inventory module tracks what physical stock you have, where it's located, and what it cost you. Every movement is recorded — receipts from purchases, deliveries to customers, transfers between warehouses, adjustments for damage or loss.

It's tightly wired into **Sales** (delivering decrements stock) and **Purchases** (receiving increments stock), but you can also use it standalone for opening balances, transfers, and adjustments.

---

## What you can do here

| Area | What it does |
|---|---|
| **Items** | The master list of what you stock — products, raw materials, services. |
| **Categories** | Group items hierarchically (e.g., Electronics → Phones → Smartphones). |
| **Warehouses** | Where stock lives. Can be a hierarchy (e.g., Main Warehouse → Section A → Bin 1). |
| **Units of Measure** | Define base UOM per item, plus conversions (1 box = 12 pcs). |
| **Opening Stock** | Initial stock entry when you start using the system. |
| **Stock Adjustments** | Record damage, loss, or found stock. |
| **Inventory Revaluations** | Correct the **carrying cost** of stock without changing quantity. See [inventory-revaluation.md](./inventory-revaluation.md). |
| **Stock Transfers** | Move goods between warehouses. |
| **Inventory Accounting Mode** | Choose whether inventory accounting is Periodic, Invoice-Driven, or Perpetual. |
| **Inventory Valuation** | Value current or as-of stock using Average or Last Purchase policy. |
| **Stock Levels** | See what's on hand, what's reserved, and the running average cost. |
| **Stock Movements** | The full append-only ledger of every movement. |
| **Alerts** | Items below minimum stock level. |
| **Dashboard** | KPIs: total value, item count, low/negative stock, recent activity. |

---

## First things to set up

1. **`Inventory → Initialize Inventory`** (one-time, sets defaults).
2. **Warehouses:** `Inventory → Warehouses → New Warehouse`. Mark your main one as default.
3. **Categories:** `Inventory → Categories`. Build the hierarchy you'll use to group items.
4. **Units of Measure:** `Inventory → UOMs`. Add any non-default units you use (pieces, boxes, kg, etc.).
5. **Items:** `Inventory → Items → New Item`. For each product:
   - Code (unique), Name, Type (PRODUCT / RAW_MATERIAL / SERVICE)
   - Base UOM and cost currency *(cost currency is locked once you record movements!)*
   - Optional item UOM conversions, such as `1 BOX = 12 PCS`, from the item's **Stock Control** tab
   - Category, brand, tags
   - Min / max stock levels (drives the Low Stock alert)
   - *(Optional)* GL accounts for inventory asset, revenue, and COGS — defaults come from category or company settings
   - UOM conversions such as `BOX → PCS`. Each From/To pair can appear only once per item; if the pair already exists,
     update its factor row instead of adding another row.
6. **Opening Stock:** `Inventory → Opening Stock Documents → New Document`. Enter your starting stock per item per warehouse. This is a one-time event. Once posted, it can't be edited (use an Adjustment instead). If you enable the accounting effect, the offset account is prefilled from Inventory Settings and can be overridden per document. It must be an Opening Balance Equity / retained-earnings style account. Do not use Inventory, COGS, revenue, AP, or AR as the offset. If the Opening Stock list is empty but warns about legacy opening-stock movements, review **Stock Movements** first so you do not enter the same opening stock twice.

### Maintaining item UOM conversions

Use the **Item UOM Conversions** section on the item card for item-specific conversions such as `BOX → PCS`.

- If the conversion has **Usage: 0**, you can delete it. ERP03 confirms the action, removes the row, and refreshes the conversion table.
- If the conversion was already used by posted stock, sales, or purchase movements, ERP03 refuses deletion. This protects historical quantities and stock valuation from becoming unreadable.
- To change a used conversion, use the impact analysis/correction workflow shown in the same section, or reverse the related posted documents where appropriate.

---

## Daily activities

### Recording damage, loss, or found stock — Stock Adjustment

When physical reality differs from what the system says:

1. `Inventory → Adjustments → New Adjustment`.
2. Pick the warehouse and adjustment date.
3. Pick a **reason** (Damage, Loss, Correction, Expiry, Found Stock).
4. Add item lines. The form shows the current quantity, new counted quantity, adjustment quantity, and value.
5. Create the adjustment, review it, then **Post**. Stock level updates immediately.

### Moving stock between warehouses — Stock Transfer

1. `Inventory → Transfers → New Transfer`.
2. Pick source warehouse, destination warehouse, items, and quantities.
3. Save the transfer as a draft, then review it.
4. If the draft is wrong, use **Edit** or **Delete**. Drafts have not moved stock or posted accounting yet.
5. When it is correct, choose **Complete**. The system creates two paired movements (OUT from source, IN to destination) — they stay linked.
6. If a completed transfer was a mistake, choose **Undo**. ERP03 creates a linked reverse transfer for you. The original stays in history for audit, but the stock is moved back through a simple one-click action.

For small teams, this means you do not need to manually build a reversal document. For larger companies, the audit trail still shows both the original transfer and the reversing transfer.

Transfer costing rules:
- A normal transfer moves stock at the source warehouse's current average cost. It does not create profit, loss, clearing, or extra inventory value.
- Added transfer costs such as freight or customs must be entered as added cost. ERP03 posts that amount to Inventory Transfer Clearing so a later supplier bill can clear it.
- If the item value itself needs to change, use an explicit revaluation value. ERP03 posts the difference to the Inventory Revaluation account, not to Gain/Loss and not to Transfer Clearing.
- A zero-cost item transfers at zero unless you explicitly revalue it first.

### Viewing what's on hand — Stock Levels

`Inventory → Reports → Stock Levels`. Shows for each item/warehouse:
- On-hand qty
- Reserved qty *(reserved is currently not populated — for future Sales Order reservations)*
- Report cost basis
- Total value

If negative stock is allowed, the report still shows the financial exposure. Example: qty `-2` with known cost `1200`
shows value `-2400`. If there is no known cost basis, the report marks the line as **Unvalued negative stock** instead
of showing a clean zero.

### Tracking history — Item Movement

`Inventory → Reports → Item Movement`. Select an item to see the full append-only ledger for that item. Filter by
warehouse, date range, source type, direction, or movement type.

Use this when an auditor asks "show me every transaction that touched item X in May".

The report shows running quantity and running value. If the source document has a supported detail page, the source
reference is clickable. If not, the reference remains plain text.

### Maintaining item UOM conversions

Open `Inventory → Items`, then open the item card. In both Web mode and Windows mode, go to **Stock Control** and use
**Item UOM Conversions** to maintain item-specific unit relationships such as boxes to pieces.

The same section is available in both UI modes. Windows mode changes how the card is framed as a desktop-style window;
it does not remove UOM conversion maintenance.

### Valuing stock — Inventory Valuation

Open `Inventory → Reports → Inventory Valuation`.

Use it when you need:

- the current stock value
- an as-of-date stock value
- a quick comparison between **Average** and **Last Purchase** pricing

For periodic companies, this report is also the source for the Balance Sheet inventory figure and the Trading / Profit & Loss cost-of-sales calculation.

---

## How costing works

ERP03 uses **Moving Average** costing.

What that means in plain terms:

- When you receive items (purchase, opening balance, transfer in, return), the system blends the new cost into the existing weighted average. Example: you have 10 widgets at $5 average. You buy 10 more at $7. New average = ((10 × $5) + (10 × $7)) ÷ 20 = $6.
- When you issue items (sales delivery, transfer out, return out, adjustment out), the system uses the current weighted average as the cost.
- The cost is **frozen on each movement**. Later cost changes don't retroactively affect already-posted issues.

This is the standard approach for businesses that don't need batch-level or FIFO tracking. **FIFO and Weighted Average (period-end) are planned but not yet implemented.**

---

## Negative stock

The system **blocks** negative stock by default. This means an issue, delivery, transfer, or adjustment OUT that would make an item go below zero is rejected before stock or accounting is changed.

An admin can enable **Allow Negative Stock** in `Inventory → Settings → Operational Rules` if the business intentionally allows stock to go below zero.

When negative stock is enabled and an OUT movement creates a deficit:
- The OUT movement is recorded normally.
- The system flags the part of the issue that's "unsettled" (issued from a deficit).
- The Unsettled Costs report (`Inventory → Reports → Unsettled Costs`) lists movements where the cost is uncertain because there was no prior IN to derive a cost from.
- When you later receive stock that covers the deficit, the books reconcile via reporting — *but the original OUT movements are not retroactively rewritten*. Their cost is what it was at posting time.

---

## Backdating

You can post movements with a date in the past. The system flags these with `isBackdated = true`.

**Important:** Backdated movements apply to the *current* weighted average, not retroactively. They will not rewrite history. If you need true period-correct valuation, wait for the V2 Period Snapshots feature.

---

## Low stock alerts

If you set `minStockLevel` on an item, it appears in `Inventory → Alerts → Low Stock` whenever the on-hand qty drops below that threshold. Use this to drive reordering.

The alert is a list, not a notification — there's no email or push (yet). Check it manually or build a dashboard widget.

---

## Multi-warehouse

- Stock is tracked per (item, warehouse) pair. Item X can have 100 units in Warehouse A and 50 in Warehouse B.
- Transfers move stock between warehouses. The destination inherits the cost from the source unless the transfer explicitly declares added cost or revaluation.
- If you have only one warehouse, set it as default and everything happens there transparently.

---

## What inventory does NOT do (yet)

- **Lot / batch / serial tracking.** Items are treated as fungible. If you need lot tracking for expiry dates or recalls, this is planned but not built.
- **Reservation** (e.g., "reserve 10 units for this Sales Order"). The field exists but isn't populated.
- **Period-end snapshots** for faster audited closes. ERP03 can already do report-time as-of valuation by replaying movements, but it does not yet persist snapshot periods.
- **Automatic GL posting** from every inventory movement. Today, Sales posts COGS and Purchases posts the receipt; Inventory itself only posts GL in limited controlled cases such as Opening Stock Documents and explicit valuation-related flows.

---

## Permissions

| Role | Can do |
|---|---|
| `inventory.view` | See dashboard, stock levels, movements |
| `inventory.items.manage` | Create / edit items |
| `inventory.categories.manage` | Create / edit categories |
| `inventory.warehouses.manage` | Create / edit warehouses |
| `inventory.uom.manage` | Define UOMs |
| `inventory.stock.adjust` | Post adjustments, transfers, opening stock |
| `inventory.stock.view` | View on-hand stock |
| `inventory.stockLevels.view` | View detailed stock-level page |
| `inventory.movements.view` | View movement ledger |
| `inventory.valuation.view` | View valuation-related inventory reports |

---

## Common questions

**Q: I posted an Opening Stock with the wrong number. Can I edit it?**
A: No — posted opening stock is immutable. Create a Stock Adjustment to correct it. (Or, if you haven't started using the system in production yet, ask your admin to wipe and start over.)

**Q: I see the average cost changed but I didn't expect it to. Why?**
A: Probably a new IN movement with a different unit cost was posted. The system blends it into the running average. Check the most recent IN under `Movements`.

**Q: An item shows negative stock. Is that bad?**
A: It means you sold or issued more than you've received in the system. Either you need to record a missing purchase/opening balance, or you over-issued. Receive the missing stock and the deficit clears.

**Q: I tried to create an item with `costCurrency = USD` but the system blocked it.**
A: Check if movements exist for that item. The cost currency is locked once any movement is recorded.

**Q: Why isn't my Inventory total matching the Inventory account in the Balance Sheet?**
A: Three common causes: (1) you haven't posted Opening Stock with the Accounting flag enabled, (2) Sales/Purchases are posting COGS/Inventory entries the inventory engine isn't aware of, (3) timing — an inventory movement happened in one period and the GL voucher landed in another. Compare timestamps and reach out to your accountant.

**Q: Can I have two warehouses with the same items at different costs?**
A: Yes — costs are tracked per (item, warehouse). The same SKU can have different averages in different locations.

---

*For technical details (Moving Average math, negative stock handling, atomic transactions, dual-currency cost tracking) see [`docs/architecture/inventory.md`](../../architecture/inventory.md). For the canonical algorithms see [`docs/modules/inventory/ALGORITHMS.md`](../../modules/inventory/ALGORITHMS.md).*
