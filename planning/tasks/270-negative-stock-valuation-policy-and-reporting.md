# Task 270 - Stock Level Reporting, Negative Valuation, and Item Movement Drill-Down

**Status:** Planned  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Created:** 2026-06-26  
**Estimated time:** 5-8 hours  
**Priority:** P0 inventory/accounting correctness follow-up from manual QA

## Context

Manual QA found an item with:

- quantity: `-2`
- blended average cost: `0.00`
- total value: `0.00`

This is misleading. If the system allows negative stock, the valuation/reporting layer must not silently zero the stock value. A negative stock balance means stock was issued/sold before the corresponding receipt/correction. The report must keep the financial signal visible.

Example:

- Item last/current known cost: `1200`
- Stock level quantity: `-2`
- Expected valuation: `-2400`
- Expected displayed cost basis: `1200`

If a later receipt arrives:

- receipt qty `5` at `1200`
- new qty `3`
- new value `-2400 + 6000 = 3600`
- avg cost remains `1200`

The same QA pass also showed that `Inventory -> Stock Levels` is currently a plain operational page, not a report using the mandatory `ReportContainer` pattern. Stock Levels is a financial/inventory control report and should support standard report behavior: filters, refresh, export/print, search, sorting, column controls, and predictable result rendering.

Users also need a dedicated **Item Movement** report to explain how a quantity/cost/value was built over time, with drill-down to the source document that created each movement.

## Decision

Separate two concerns:

1. **Negative stock permission** is a configurable policy.
   - Block negative stock.
   - Warn and allow negative stock.
   - Future: role/item/warehouse exceptions.

2. **Negative stock valuation** is a hard accounting rule.
   - If negative stock is allowed, it must still carry a cost basis.
   - It must not show `qty < 0` with `avg 0` and `value 0` unless there is truly no cost basis.
   - If no cost basis exists, the UI/report must show an explicit warning such as `Unvalued negative stock`, not a silent zero.

## Goal

Fix stock-level valuation so negative quantities remain financially meaningful and visible in stock reports, convert Stock Levels to the standard report pattern, and add an Item Movement report with source-document drill-down.

## Scope

In scope:

- Stock-level valuation calculation and display.
- Convert Stock Levels to use `ReportContainer`.
- Add Inventory Item Movement report.
- Inventory report/menu wiring.
- Inventory reports/views that show blended average cost and total value.
- Negative-stock policy checks if current settings already exist.
- Backend tests around negative stock valuation.
- UI warning/display for unvalued negative stock.

Out of scope:

- Rewriting the full inventory costing engine.
- Changing already-posted vouchers.
- Adding role/item-specific negative stock policies unless the current settings already support it.
- Changing COGS voucher output for already-posted SI documents unless a focused test proves the posting path is wrong.

## Required Behavior

### When Negative Stock Is Blocked

- Existing block behavior should remain.
- No valuation change needed because stock should not go below zero.

### When Negative Stock Is Allowed And Cost Basis Exists

Stock reports should show:

- negative quantity
- cost basis from last known/current moving average/valuation source
- negative total value

Example:

```text
Qty: -2
Blended Avg Cost: 1200.00
Total Value: -2400.00
```

### When Negative Stock Is Allowed But No Cost Basis Exists

Stock reports should not silently show clean zero valuation.

Preferred display:

```text
Qty: -2
Blended Avg Cost: Unvalued
Total Value: Unvalued
Warning: Negative stock has no cost basis.
```

If numeric fields cannot support text, show `0.00` only with a clear visible warning marker and report flag.

## Cost Basis Priority

Use the safest existing source in this order, unless code shows a better canonical source:

1. Current stock level average cost, if non-zero.
2. Last known inventory movement cost for the item/warehouse.
3. Item default/standard cost if already modeled and explicitly intended as fallback.
4. Otherwise mark as unvalued negative stock.

Do not invent a silent arbitrary cost.

## Backend Requirements

1. Locate the stock-level aggregation source used by `Inventory -> Stock Levels`.
2. Fix valuation calculation so negative quantities do not zero value when cost basis exists.
3. Preserve tenant/company isolation.
4. Preserve SQL-migration-ready repository boundaries.
5. Add tests:
   - negative quantity with known average/last cost reports negative value.
   - negative quantity with no known cost reports explicit unvalued flag/warning.
   - later positive receipt recomputes from negative value correctly.
   - positive stock valuation remains unchanged.

## Frontend Requirements

### Stock Levels Report

1. Convert the existing Stock Levels route/page to use `<ReportContainer>` from `frontend/src/components/reports/ReportContainer.tsx`.
2. Ensure the route is listed in `frontend/src/config/moduleMenuMap.ts` under Inventory -> Reports.
3. Preserve current views:
   - By Item
   - By Warehouse
4. Add/keep logical filters:
   - warehouse
   - item search/item selector if available
   - include/exclude zero quantity
   - include/exclude negative stock
5. Support standard report interactions through `ReportContainer`:
   - refresh
   - filter panel
   - search/quick filter where compatible
   - sort
   - column visibility
   - export/print if the container supports it
6. Stock Levels should make negative valued stock visually clear.
7. Display negative total value if backend returns it.
8. Display a warning marker for unvalued negative stock.
9. Do not hide negative value by formatting it as zero.

### New Item Movement Report

Add a new Inventory report: **Item Movement**.

Purpose:

- Show the full historical movement ledger for one item.
- Explain how quantity, cost basis, and value changed over time.
- Allow users to drill down from a movement line to the source document that created it.

Required filters:

- Item (required, use the shared `ItemSelector`; no raw item id input).
- Warehouse (optional).
- Date from / date to (use the shared DatePicker, not raw date input).
- Source document type/source module, where available.
- Movement direction/type:
  - In
  - Out
  - Adjustment
  - Transfer
  - Opening
  - Revaluation/value-only if represented.
- Posted/source status if the backend exposes it.

Required columns:

- Date
- Item
- Warehouse
- Movement type
- Source document type
- Source document number/reference
- Quantity in
- Quantity out
- Running quantity
- Unit cost / cost basis
- Movement value
- Running value
- Created by / posted by if available
- Notes/description if available

Required interactions:

- Sort by date, source document, quantity, and value.
- Search by document number/reference and movement notes.
- Drill down from source document to the originating document detail page where route support exists.
- If a route cannot be resolved, show the source reference as plain text instead of breaking the report.

Menu/routing:

- Add the Item Movement route under Inventory -> Reports in `moduleMenuMap.ts`.
- The route must pass `frontend/scripts/check-reports.mjs`.

## Acceptance Criteria

- An item at `-2` qty with known cost `1200` shows value `-2400`.
- An item at `-2` qty with no cost basis is visibly flagged as unvalued negative stock.
- Positive stock levels retain current average/value behavior.
- Inventory valuation reports do not silently omit negative stock value.
- Negative-stock permission remains policy-driven, but valuation correctness is not optional.
- Stock Levels uses `ReportContainer` and passes the reports guard.
- Item Movement report exists under Inventory -> Reports.
- Item Movement can filter by item, date range, warehouse, source document type, and movement type where data is available.
- Item Movement supports drill-down to the source document detail page when route mapping exists.

## Verification Commands

Run from `D:\DEV2026\ERP03-267-engine-audit`:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/inventory/StockLevels*.test.ts
npm --prefix backend test -- --runInBand src/tests/application/inventory/InventoryValuation*.test.ts
npm --prefix backend run build
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run check:reports
git diff --check
```

Adjust focused test filenames to match the repo; create focused tests if none exist.

## Stop Conditions

- If the system cannot determine a last known cost without a new repository query/service, stop and propose the narrow design first.
- If current negative-stock policy is inconsistent across SI/DN/POS/stock adjustments, stop and document the policy matrix before broad changes.
- If Item Movement cannot reliably map source document routes for all movement types, implement drill-down for known routes and show unresolved sources as plain text with a documented route-map follow-up.
- If converting Stock Levels to `ReportContainer` would break current operational behavior, keep the existing operational view separate and add a new `Inventory -> Reports -> Stock Levels` report route instead.
- Do not silently change posted voucher output while fixing reports.
- Do not hardcode a fallback cost when no cost basis exists.

## Owner QA Script

1. Enable/warn-allow negative stock if the company policy supports it.
2. Create or use an item with known average cost `1200`.
3. Sell/issue more than on-hand so stock becomes `-2`.
4. Open Stock Levels.
   - Expected: qty `-2`, avg/cost basis `1200`, total value `-2400`.
5. Receive `5` units at `1200`.
6. Open Stock Levels.
   - Expected: qty `3`, avg cost `1200`, total value `3600`.
7. Repeat with a brand-new item with no known cost basis and force negative stock.
   - Expected: visible `Unvalued negative stock` warning, not silent clean zero.
8. Open Inventory -> Reports -> Item Movement.
9. Select the same item and date range.
   - Expected: all movements are listed in chronological order with running quantity/value.
10. Click the source document link for an SI/PI/GRN/opening/adjustment movement.
   - Expected: the originating document opens when route mapping exists.
