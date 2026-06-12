# Golden Path 02 — Inventory

> **Goal:** master data + stock documents move quantities and values correctly.
> **Precondition:** Golden Path 01 passed on this tenant.

## A. Master data

| # | Step | Expected |
|---|------|----------|
| 1 | Create UOM "PCS" (if not seeded) and a category "General" | Saved, visible in lists |
| 2 | Create item ITEM-A: stock item, PCS, purchase price 10, sales price 15 | Saved; appears in Items list with status chip |
| 3 | Create item SRV-1: service item (non-stock) | Saved |
| 4 | Create a second warehouse WH-2 (main WH-1 exists from wizard) | Saved |

## B. Opening stock

| # | Step | Expected |
|---|------|----------|
| 5 | Opening Stock document: 100 × ITEM-A @ cost 10 into WH-1; post | Stock level WH-1 = 100; opening stock GL entry posted (inventory account debited) |
| 6 | Stock Levels page | ITEM-A: 100 in WH-1, 0 in WH-2 |

## C. Movements

| # | Step | Expected |
|---|------|----------|
| 7 | Stock Transfer: 20 × ITEM-A from WH-1 → WH-2; post | WH-1 = 80, WH-2 = 20; movement records visible |
| 8 | Stock Adjustment: −5 × ITEM-A in WH-1 (damage); post | WH-1 = 75; adjustment GL entry posted (expense/shrinkage vs inventory) |
| 9 | Try an OUT movement bigger than stock (e.g. adjustment −500) with negative stock disallowed in Inventory Settings | Rejected with negative-stock error |
| 10 | Stock Movements report for ITEM-A | Shows opening 100, transfer −20/+20, adjustment −5, in order |

## D. Valuation

| # | Step | Expected |
|---|------|----------|
| 11 | Inventory Valuation report | ITEM-A total qty 95, value 950 (95 × 10 weighted average) |
| 12 | Trial Balance | Inventory GL balance equals valuation report total |

**Pass condition:** all 12 steps green. File failures as `GP02-step#` in `planning/qa/findings.md`.
