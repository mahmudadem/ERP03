# Sales Module — Runtime Testing Guide

## Prerequisites

Before testing Sales, make sure these modules are already initialized:

1. **Accounting** — Chart of Accounts exists (AR, Revenue, COGS, Inventory, Bank accounts)
2. **Inventory** — At least 1 warehouse, 1 category, 2 items (one stock, one service)
3. **Purchase** (optional) — If you want to test full cycle with existing stock

### Start the App

```bash
# Terminal 1 — Backend
cd d:\DEV2026\ERP03\backend
npm run dev

# Terminal 2 — Frontend
cd d:\DEV2026\ERP03\frontend
npm run dev
```

### Enable Sales Module
Go to **Company Admin → Modules** → enable the `sales` module for your company.

---

## Test 1: Sales Initialization

1. Navigate to **Sales** in the sidebar (or go to `/sales`)
2. You should see the **Initialization Wizard**
3. Fill in:
   - **Sales Mode**: `SIMPLE` (start with this)
   - **Default AR Account**: pick your Accounts Receivable account
   - **Default Revenue Account**: pick your Revenue/Sales account  
   - **Default COGS Account**: pick your Cost of Goods Sold account
4. Complete the wizard
5. ✅ **Expect**: Sales dashboard loads with placeholder KPIs

---

## Test 2: Create a Customer

1. Sidebar → **Customers** (or `/sales/customers`)
2. Click **New Customer**
3. Fill in: name, contact info, payment terms (e.g., 30 days)
4. Save
5. ✅ **Expect**: Customer appears in the list

---

## Test 3: Create a Sales Order

1. Sidebar → **Sales Orders** (or `/sales/orders`)
2. Click **New SO**
3. Fill in:
   - **Customer**: select the customer you created
   - **Currency**: your base currency
   - **Line 1**: select a **stock item**, qty = 10, unit price = 50
   - **Line 2**: select a **service item**, qty = 5, unit price = 100
4. Save → status should be `DRAFT`
5. Click **Confirm**
6. ✅ **Expect**: Status changes to `CONFIRMED`, order number like `SO-00001`

### Verify
- Go to **Inventory → Stock Levels** — stock should be unchanged (SO has no inventory effect)
- Go to **Accounting → Vouchers** — no new voucher (SO has no GL effect)

---

## Test 4: Deliver Goods (Delivery Note)

1. Open the confirmed SO
2. Click **Deliver Goods** button
3. A new DN form opens pre-filled from the SO
4. Select a **warehouse** with stock of that item
5. Set `deliveredQty = 5` (partial delivery)
6. Save → DN is `DRAFT`
7. Click **Post**
8. ✅ **Expect**: DN status = `POSTED`

### Verify (This is the key COGS check!)
- **Inventory → Stock Levels**: stock decreased by 5 for that item/warehouse
- **Inventory → Movements**: new `SALES_DELIVERY` movement, qty = 5
- **Accounting → Vouchers**: new voucher `DN-XXXX`:
  ```
  Dr  COGS Account        [5 × WAC unit cost]
  Cr  Inventory Account   [5 × WAC unit cost]
  ```
- **Sales Orders → SO detail**: `deliveredQty = 5`, status = `PARTIALLY_DELIVERED`

---

## Test 5: Create Sales Invoice

1. Open the SO
2. Click **Create Invoice**
3. SI form opens pre-filled
4. Set `invoicedQty = 5` (matching the delivery)
5. Save → `DRAFT`
6. Click **Post**
7. ✅ **Expect**: SI status = `POSTED`, `paymentStatus = UNPAID`

### Verify (Revenue recognition!)
- **Accounting → Vouchers**: new Revenue voucher:
  ```
  Dr  Accounts Receivable   [grand total]
  Cr  Revenue Account       [subtotal]
  Cr  Sales Tax Account     [tax amount, if any]
  ```
- **No second COGS voucher** (because this is CONTROLLED stock and DN already created COGS)
- SO detail: `invoicedQty = 5`

---

## Test 6: SIMPLE Standalone Invoice (No SO)

1. Go to **Sales Invoices** → **New Invoice**
2. Select a customer, add a stock item line (qty = 3, price = 80)
3. Make sure warehouse is set
4. Save → Post
5. ✅ **Expect**: TWO vouchers created:
   - Revenue voucher: Dr AR / Cr Revenue / Cr Tax
   - COGS voucher: Dr COGS / Cr Inventory

### Verify
- Inventory decreased by 3
- Two separate vouchers in Accounting

---

## Test 7: Sales Return (AFTER_INVOICE)

1. Open a posted Sales Invoice
2. Click **Create Return**
3. SR form opens pre-filled from the SI
4. Set `returnQty = 2` (partial return)
5. Enter a **reason**
6. Save → Post
7. ✅ **Expect**: TWO reversal vouchers:
   - Revenue reversal: Dr Revenue + Dr Tax / Cr AR
   - COGS reversal: Dr Inventory / Cr COGS

### Verify
- Stock increased by 2 (RETURN_IN movement)
- SI `outstandingAmount` decreased by the return amount
- SO `returnedQty = 2`

---

## Test 8: Try Boundary Cases

### Over-delivery block
- Create DN with `deliveredQty > orderedQty` → should get error

### Over-invoice block (CONTROLLED)
- Try to invoice more than delivered → should get error
- Service item: can invoice without DN ✅

### Return qty validation
- Try to return more than invoiced → should get error

### Cancel SO
- Create a new SO, confirm it, then try to cancel (should work if no deliveries)
- Try to cancel after delivery → should fail

---

## Test 9: Multi-Currency

1. Enable a foreign currency (e.g., EUR) in Company Settings
2. Create SO with `currency = EUR`, `exchangeRate = 1.1`
3. Go through full cycle: SO → DN → SI
4. ✅ **Verify**: GL voucher amounts are in base currency (multiplied by exchange rate)

---

## Test 10: Accounting Reports

After completing the above tests:

1. **Trial Balance** — AR, Revenue, COGS, Inventory balances should reflect the transactions
2. **Profit & Loss** — Revenue and COGS should appear
3. **Account Statement** — select the AR account, verify SI and SR entries

---

## Quick Reference: Where to Check

| What | Where |
|------|-------|
| Stock effect | Inventory → Stock Levels |
| Movement type | Inventory → Movements |
| GL vouchers | Accounting → Vouchers |
| Account balances | Accounting → Trial Balance |
| SO status | Sales → Sales Orders |
| Invoice payment status | Sales → Sales Invoices |
| COGS unit cost | DN detail → line `unitCostBase` |
