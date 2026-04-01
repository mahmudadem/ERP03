# Inventory Module — Manual Test Guide

> **Scope:** Full manual test of all Phase 1, 2, and 3 features  
> **Prerequisites:** Backend running, user logged in, company selected in the app

---

## Setup Checklist

Before starting, confirm:
- [ ] Backend is running (`npm start` in `backend/`)
- [ ] Frontend is running or built
- [ ] You are logged in to the app for a company
- [ ] **Accounting module is initialized** (needed for GL voucher creation on adjustments)
  - If not, go to Accounting → Initialize first

---

## TEST 1: Initialize Inventory Module

**Goal:** Set up default inventory settings and a first warehouse.

1. Navigate to **Inventory** in the sidebar
2. If not initialized, click **Initialize**
3. Enter a default warehouse name (e.g. `Main Warehouse`) and code (e.g. `MW`)
4. Click Confirm

**Expected:**
- ✅ No error
- ✅ You land on the Inventory Home page
- ✅ A warehouse named `Main Warehouse` exists under **Warehouses**

---

## TEST 2: Create a Warehouse

**Goal:** Add a second warehouse for transfer testing later.

1. Go to **Inventory → Warehouses**
2. Click **Add Warehouse**
3. Enter name: `Secondary Warehouse`, code: `SW`
4. Save

**Expected:**
- ✅ Both warehouses appear in the list

---

## TEST 3: Create an Item Category

1. Go to **Inventory → Categories**
2. Click **Add Category**
3. Enter name: `Electronics`
4. Save

**Expected:**
- ✅ Category `Electronics` appears in the tree

---

## TEST 4: Create an Item (Product)

**Goal:** Create a tracked item with a cost currency.

1. Go to **Inventory → Items → New Item**
2. Fill in:
   - **Code:** `ITEM-001`
   - **Name:** `Test Product`
   - **Type:** Product
   - **Category:** Electronics
   - **Base UoM:** `pcs`
   - **Cost Currency:** `USD` ← this is user data, NOT the company base currency
   - **Costing Method:** Moving Average
   - **Track Inventory:** Yes
3. Save

**Expected:**
- ✅ Item created and visible in Items list
- ✅ Cost currency shows `USD`

---

## TEST 5: Enter Opening Stock

**Goal:** Record initial inventory for the item.

1. Go to **Inventory → Opening Stock**
2. Select Item: `ITEM-001`
3. Select Warehouse: `Main Warehouse`
4. Date: today's date
5. Qty: `100`
6. Unit Cost (in move currency): `10.00`
7. Move Currency: `USD`
8. FX Rate (USD → Base): enter the current rate (e.g. `32` if base is TRY)
9. FX Rate (USD → CCY): `1` (same as move currency)
10. Submit

**Expected:**
- ✅ Movement recorded with `movementType = OPENING_STOCK`
- ✅ Go to **Stock Levels** → `ITEM-001` in `Main Warehouse` shows:
  - `qtyOnHand = 100`
  - `avgCostBase = 320` (10 × 32)
  - `avgCostCCY = 10`

---

## TEST 6: Stock Levels Page

1. Go to **Inventory → Stock Levels**
2. Verify `ITEM-001` / `Main Warehouse` row shows correct qty and costs

**Expected:**
- ✅ `qtyOnHand = 100`, costs match opening stock entry

---

## TEST 7: Movement History

1. Go to **Inventory → Movement History**
2. Filter by item `ITEM-001`

**Expected:**
- ✅ One movement: `OPENING_STOCK`, qty=100, `costSettled=true`

---

## TEST 8: Stock Adjustment — Decrease Qty

**Goal:** Test adjustment + GL voucher creation.

1. Go to **Inventory → Stock Adjustments → New Adjustment**
2. Select Warehouse: `Main Warehouse`
3. Date: today
4. Reason: `Damage`
5. Add line:
   - Item: `ITEM-001`
   - Current Qty: `100` (auto-filled or enter manually)
   - New Qty: `90`
   - Unit Cost Base: `320` (current avg cost)
   - Unit Cost CCY: `10`
6. Save as DRAFT
7. Click **Post**

**Expected:**
- ✅ Status changes to `POSTED`
- ✅ Stock Level for `ITEM-001`/`Main Warehouse` now shows `qtyOnHand = 90`
- ✅ In Movement History: new `ADJUSTMENT_OUT` movement with `qty = 10`
- ✅ A GL Voucher was created (check Accounting → Vouchers for a new entry referencing this adjustment)

---

## TEST 9: Stock Adjustment — Increase Qty

1. Create another adjustment: New Qty = `95` (increase by 5)
2. Post it

**Expected:**
- ✅ Stock Level: `qtyOnHand = 95`
- ✅ Movement: `ADJUSTMENT_IN`, qty=5, `costSettled=true`

---

## TEST 10: Stock Transfer between Warehouses

**Goal:** Transfer stock from Main to Secondary warehouse.

1. Go to **Inventory → Transfers → New Transfer**
2. Source: `Main Warehouse`
3. Destination: `Secondary Warehouse`
4. Date: today
5. Add line: Item = `ITEM-001`, Qty = `20`
6. Save (status: DRAFT)
7. Click **Complete Transfer**

**Expected:**
- ✅ Transfer status = `COMPLETED`
- ✅ Stock Levels:
  - `ITEM-001` / `Main Warehouse`: `qtyOnHand = 75`
  - `ITEM-001` / `Secondary Warehouse`: `qtyOnHand = 20`
- ✅ In Movement History: two movements with same `transferPairId`:
  - `TRANSFER_OUT` at Main Warehouse, qty=20
  - `TRANSFER_IN` at Secondary Warehouse, qty=20
- ✅ Costs must match: `avgCostBase` on `TRANSFER_IN` = same as source's `avgCostBase`

---

## TEST 11: Dashboard KPIs

1. Go to **Inventory → Home (Dashboard)**

**Expected (approximate values):**
- ✅ Total Inventory Value = `(75 × avgCostBase) + (20 × avgCostBase)` ≈ `95 × 320 = 30,400` in base currency
- ✅ Total Tracked Items = `1`
- ✅ Low Stock Alerts = `0` (if no `minStockLevel` set on item)
- ✅ Recent Movements table shows the last 10 movements

---

## TEST 12: Low Stock Alert

**Goal:** Trigger a low stock alert.

1. Go to **Items → ITEM-001 → Edit**
2. Set **Min Stock Level** = `200` (above current qty of 95)
3. Save
4. Go to **Dashboard**

**Expected:**
- ✅ `lowStockAlerts = 1`
5. Go to **Inventory → Alerts → Low Stock**

**Expected:**
- ✅ `ITEM-001` appears with `qtyOnHand = 95`, `minStockLevel = 200`, `deficit = 105`

---

## TEST 13: Negative Stock

**Goal:** Verify the system allows negative stock and flags it correctly.

1. Create a stock adjustment: New Qty = `0` (subtract remaining 95 from Main)
2. Then create one more: New Qty = `-10` (or do another adjustment out of 10 more)
   - Alternatively, sub-step: record a manual `ADJUSTMENT_OUT` for qty=105 (more than on hand)
3. Check Movement History

**Expected:**
- ✅ Movement recorded with `negativeQtyAtPosting = true`
- ✅ Movement has `costSettled = false` (stock was negative at posting)
- ✅ Dashboard shows `negativeStockCount ≥ 1`

---

## TEST 14: Unsettled Cost Report

1. Go to **Inventory → Reports → Unsettled Costs**

**Expected:**
- ✅ The negative-stock movement from Test 13 appears in this list
- ✅ Shows `unsettledCostBasis` (e.g. `LAST_KNOWN` or `MISSING`)

---

## TEST 15: Cost Query (API check)

This tests the Phase 3 cost query service used by Sales.

Using browser dev tools or Postman:
```
GET /tenant/inventory/costs/current?itemId=ITEM-001-ID&warehouseId=MAIN-WH-ID
```

**Expected response:**
```json
{
  "qtyOnHand": 75,
  "avgCostBase": 320,
  "avgCostCCY": 10,
  "lastCostBase": 320,
  "lastCostCCY": 10,
  "costBasis": "AVG"
}
```

---

## TEST 16: Period Snapshot + As-Of Valuation (API check)

**Step 1:** Create a period snapshot for this month:
```
POST /tenant/inventory/snapshots
Body: { "periodKey": "2026-03" }
```

**Expected:**
```json
{
  "periodKey": "2026-03",
  "totalValueBase": ...,
  "snapshotData": [ ... ]
}
```

**Step 2:** Query as-of valuation for today:
```
GET /tenant/inventory/valuation/as-of?date=2026-03-07
```

**Expected:**
- ✅ Returns per-item valuations with the totalized `totalValueBase`
- ✅ Matches what you see in Stock Levels

---

## TEST 17: Reconciliation Check

1. Go to (or call): `POST /tenant/inventory/reconcile`

**Expected:**
```json
{
  "matches": true,
  "checkedLevels": 2,
  "mismatchCount": 0
}
```
- ✅ `matches = true` means StockLevel qty is perfectly consistent with all recorded movements
- ⚠️ If `matches = false`, the mismatch payload will show which item/warehouse is off

---

## TEST 18: costCurrency Immutability

**Goal:** Verify you cannot change Cost Currency once stock movements exist.

1. Go to **Items → ITEM-001 → Edit**
2. Try to change **Cost Currency** from `USD` to `EUR`
3. Save

**Expected:**
- ✅ Error: `"Item costCurrency cannot be changed after first stock movement"`

---

## Summary Checklist

| Test | Description | Pass/Fail |
|------|-------------|-----------|
| 1 | Initialize Inventory | |
| 2 | Create 2nd Warehouse | |
| 3 | Create Category | |
| 4 | Create Item with Cost Currency | |
| 5 | Opening Stock | |
| 6 | Stock Levels Page | |
| 7 | Movement History | |
| 8 | Adjustment Out + GL Voucher | |
| 9 | Adjustment In | |
| 10 | Stock Transfer (2 warehouses) | |
| 11 | Dashboard KPIs | |
| 12 | Low Stock Alert | |
| 13 | Negative Stock | |
| 14 | Unsettled Cost Report | |
| 15 | Cost Query API | |
| 16 | Period Snapshot + As-Of | |
| 17 | Reconciliation | |
| 18 | costCurrency Immutability | |
