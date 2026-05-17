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
| **Stock Transfers** | Move goods between warehouses. |
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
   - Category, brand, tags
   - Min / max stock levels (drives the Low Stock alert)
   - *(Optional)* GL accounts for inventory asset, revenue, and COGS — defaults come from category or company settings
6. **Opening Stock:** `Inventory → Opening Stock → New Document`. Enter your starting stock per item per warehouse. This is a one-time event. Once posted, it can't be edited (use an Adjustment instead).

---

## Daily activities

### Recording damage, loss, or found stock — Stock Adjustment

When physical reality differs from what the system says:

1. `Inventory → Adjustments → New Adjustment`.
2. Pick the warehouse and the items being adjusted.
3. For each line: choose IN (found / over-counted) or OUT (damage / loss / under-counted).
4. Pick a **reason** (Damage, Loss, Correction, Expiry, Found Stock).
5. Save as DRAFT, review, **Post**. Stock level updates immediately.

### Moving stock between warehouses — Stock Transfer

1. `Inventory → Transfers → New Transfer`.
2. Pick source warehouse, destination warehouse, items, and quantities.
3. **Confirm** (or post directly if you don't need a transit stage).
4. Status flows: DRAFT → IN_TRANSIT → COMPLETED. The system creates two paired movements (OUT from source, IN to destination) — they stay linked.

### Viewing what's on hand — Stock Levels

`Inventory → Stock Levels`. Shows for each item/warehouse:
- On-hand qty
- Reserved qty *(reserved is currently not populated — for future Sales Order reservations)*
- Average cost (weighted moving average)
- Last cost (cost of the most recent IN movement)
- Total value

### Tracking history — Stock Movements

`Inventory → Movements`. The full append-only ledger. Filter by item, warehouse, date range, or movement type.

Use this when an auditor asks "show me every transaction that touched item X in May".

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

The system **allows** negative stock by default — you can sell items you don't have on paper.

When that happens:
- The OUT movement is recorded normally.
- The system flags the part of the issue that's "unsettled" (issued from a deficit).
- The Unsettled Costs report (`Inventory → Reports → Unsettled Costs`) lists movements where the cost is uncertain because there was no prior IN to derive a cost from.
- When you later receive stock that covers the deficit, the books reconcile via reporting — *but the original OUT movements are not retroactively rewritten*. Their cost is what it was at posting time.

If you'd rather block negative stock entirely, your admin can flip `allowNegativeStock = false` in inventory settings (currently backend-only; UI toggle is planned).

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
- Transfers move stock between warehouses. The destination inherits the cost from the source.
- If you have only one warehouse, set it as default and everything happens there transparently.

---

## What inventory does NOT do (yet)

- **Lot / batch / serial tracking.** Items are treated as fungible. If you need lot tracking for expiry dates or recalls, this is planned but not built.
- **Reservation** (e.g., "reserve 10 units for this Sales Order"). The field exists but isn't populated.
- **Period-end snapshots** for true as-of valuation.
- **Automatic GL posting** from inventory movements. Today, Sales posts COGS and Purchases posts the receipt — Inventory itself doesn't generate journal entries (except via Opening Stock Documents).

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
| `inventory.valuation.view` | View Unsettled Costs report |

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
