# Manual Test - Sales Module

> Scope: current Sales module flow in the app as implemented now
> Includes: initialization, settings, customers, sales orders, delivery notes, sales invoices, sales returns, accounting linkage, stock effects, and key negative tests
> Excludes: quotation flow and sales unpost flow

---

## Setup Checklist

Before starting, confirm:

- [x] Backend is running from `backend/`
- [x] Frontend is running or built from `frontend/`
- [x] You are logged in and a company is selected
- [x] Accounting module is initialized
- [x] Inventory module is initialized
- [x] Sales module permission/menu is visible for the current user
- [x] System seeder has been run in the target environment if you are testing on emulator/local
  - Local command: `npm run seed:system` in `backend/`
- [x] At least one active warehouse exists
- [x] At least one active sales tax code exists if tax tests will be performed
- [x] Inventory accounting method is known
  - Recommended for this runbook: `PERPETUAL`

---

## Recommended Test Data

Use these records so results are easy to verify:

### Customer
- Code: `CUST-SAL-001`
- Legal Name: `Sales Test Customer LLC`
- Display Name: `Sales Test Customer`
- Default Currency: company base currency or `USD`
- Default AR Account: valid AR account

### Stock Item
- Code: `SAL-STK-001`
- Name: `Sales Stock Item`
- Type: `PRODUCT`
- Track Inventory: `Yes`
- Base UOM: `EA`
- Sales UOM: `EA`
- Revenue Account: valid revenue account
- COGS Account: valid COGS account
- Inventory Asset Account: valid inventory asset account
- Default Sales Tax Code: active sales tax code

### Service Item
- Code: `SAL-SVC-001`
- Name: `Sales Service Item`
- Type: `SERVICE`
- Track Inventory: `No`
- Base UOM: `EA`
- Sales UOM: `EA`
- Revenue Account: valid revenue account

### Optional Zero-Cost Test Item
- Code: `SAL-STK-ZERO-001`
- Name: `Zero Cost Stock Item`
- Type: `PRODUCT`
- Track Inventory: `Yes`
- Revenue/COGS/Inventory accounts configured
- No opening stock and no purchase/opening movement recorded

### Warehouse
- `Main Warehouse`

### Opening Stock for `SAL-STK-001`
- Create it through **Inventory -> Opening Stock Documents**
- Warehouse: `Main Warehouse`
- Qty: `20`
- Unit cost: any positive value, example `10`

### Suggested Sales Settings
- Allow Direct Invoicing: `ON`
- Require SO for Stock Items: `ON`
- Allow Over-delivery: `OFF`
- Over-delivery tolerance: `0`
- Over-invoice tolerance: `0`
- Default payment terms: `30`
- SO Prefix: `SO`
- DN Prefix: `DN`
- SI Prefix: `SI`
- SR Prefix: `SR`

### Suggested FX Data for Foreign Currency Test
- Enable one foreign currency for the company
- Example:
  - Company base currency = `TRY`
  - Invoice currency = `USD`
  - Exchange rate = `40`

If your company base currency is already `USD`, choose another enabled foreign currency such as `EUR`.

---

## TEST 1: Initialize Sales Module

**Goal:** Confirm Sales initialization works and lands on a usable dashboard.

1. Navigate to **Sales**
2. If the Sales module is not initialized, the initialization wizard should open automatically
3. In **Sales Policy**:
   - Leave **Allow Direct Invoicing** checked
   - Leave **Require Sales Orders for Stock Items** checked
4. In **Default Accounts**:
   - Select a valid default revenue account
5. In **Defaults & Numbering**:
   - Payment terms = `30`
   - SO Prefix = `SO`
   - DN Prefix = `DN`
   - SI Prefix = `SI`
   - SR Prefix = `SR`
6. Click through to **Review**
7. Click **Complete Setup**

**Expected:**
- [ ] No error is shown
- [ ] You land on **Sales Overview**
- [ ] **Sales Settings** opens normally after initialization
- [ ] The module does not ask for initialization again on refresh

If Sales is already initialized, skip to Test 2.

---

## TEST 2: Review Sales Settings

**Goal:** Confirm settings page loads and saved values persist.

1. Go to **Sales -> Settings**
2. Verify the following values:
   - **Allow Direct Invoicing**
   - **Require SO for stock items**
   - **Default Revenue Account**
   - Numbering prefixes and next sequence values
3. Change one harmless value, for example:
   - Increase **Default Payment Terms** from `30` to `31`
4. Click **Save Settings**
5. Refresh the page
6. Confirm the changed value persisted
7. Return the value to its original number and save again

**Expected:**
- [x] Page loads without error
- [x] Settings save successfully
- [x] Saved values persist after refresh
- [x] Inventory-related read-only account display is visible when inventory is initialized

---

## TEST 3: Create Customer Master

**Goal:** Create one customer that will be used in the rest of the test.

1. Go to **Sales -> Customers**
2. Click to create a new customer
3. Fill:
   - Code = `CUST-SAL-001`
   - Legal Name = `Sales Test Customer LLC`
   - Display Name = `Sales Test Customer`
   - Default Currency = your chosen test currency
   - Default AR Account = valid AR account
4. Save
5. Search for the customer in the list
6. Open the detail page again

**Expected:**
- [x] Customer saves successfully
- [x] Customer appears in the list and is searchable
- [x] Customer detail page shows the saved values
- [x] The customer has role `CUSTOMER`
  Check by confirming the `CUSTOMER` badge is visible either in the customer list row or in the customer detail header

---

## TEST 4: Verify Inventory Test Data

**Goal:** Confirm the stock item and warehouse are ready before Sales posting.

1. Go to **Inventory -> Items**
2. Confirm `SAL-STK-001` exists and is tracked
3. Open the item and verify:
   - Revenue account is set
   - COGS account is set
   - Inventory asset account is set
4. Go to **Inventory -> Stock Levels**
5. Filter or locate `SAL-STK-001` in `Main Warehouse`

**Expected:**
- [x] Item exists and is active
- [x] Warehouse exists and is active
- [x] Stock level is positive
- [x] Average cost is positive

If the item or stock does not exist, create it in Inventory before continuing.

---

## TEST 4A: Validate Opening Stock Document Workflow

**Goal:** Confirm the current Opening Stock Document flow is working before Sales stock tests continue.

Run this test when you need to create or re-check opening stock for `SAL-STK-001`.

1. Go to **Inventory -> Opening Stock Documents**
2. Confirm the page shows whether **Accounting** is enabled or disabled
3. Start a new document:
   - Warehouse = `Main Warehouse`
   - Date = today
   - Item = `SAL-STK-001`
   - Qty = `20`
   - Unit cost = your chosen positive value, example `10`
4. Confirm the item picker allows the stock item and does not behave like a free-text raw UUID field
5. If Accounting is enabled:
   - Set **Create Accounting Effect = Yes**
   - Select a valid **Opening Balance / Clearing Account**
6. Click **Save Draft**
7. In the recent documents list, confirm the document appears as `DRAFT`
8. Click **Edit** on the draft and confirm the draft loads back into the form
9. Post the draft
10. Confirm the document becomes locked / posted and cannot be edited directly anymore
11. If Accounting effect was `Yes`, confirm a voucher reference is shown on the document row
12. Go to **Inventory -> Stock Levels** and confirm `SAL-STK-001` in `Main Warehouse` now has positive quantity and positive average cost

**Optional warning checks:**
- [x] With Accounting enabled, create another draft with **Create Accounting Effect = No** and confirm the page warns that stock will change without accounting impact
- [x] On post of an inventory-only draft, confirm the confirmation dialog appears
- [x] If you create another document for the same item + warehouse + date, confirm a duplicate warning is shown but posting is not hard-blocked
- [x] Delete any extra draft created only for warning checks so Sales stock is not doubled

**Expected:**
- [x] Opening Stock is handled through documents, not raw one-off movement entry
- [x] Draft documents are editable and deletable
- [x] Posted documents are locked
- [x] Voucher linkage is visible when accounting effect is enabled
- [x] Inventory-only posting is clearly warned when Accounting is enabled
- [x] Duplicate detection is warning-only
- [x] Stock levels and cost basis are updated after posting

---

## TEST 5: Create Draft Sales Order

**Goal:** Create a standard Sales Order for the customer.

1. Go to **Sales -> Sales Orders**
2. Create a new Sales Order
3. Fill:
   - Customer = `Sales Test Customer`
   - Order Date = today
   - Expected Delivery Date = tomorrow or later
   - Currency = base currency
   - Exchange Rate = `1`
4. Add line 1:
   - Item = `SAL-STK-001`
   - Qty = `5`
   - UOM = `EA`
   - Unit Price = `20`
   - Tax Code = your active sales tax code or leave blank for no-tax test
   - Warehouse = `Main Warehouse`
5. Optional line 2:
   - Item = `SAL-SVC-001`
   - Qty = `1`
   - Unit Price = `50`
6. Enter customer notes and internal notes
7. Save

**Expected:**
- [ ] Draft Sales Order is created
- [ ] SO number is generated automatically
- [ ] Totals calculate correctly
- [ ] The order detail page opens after save

---

## TEST 6: Confirm Sales Order

**Goal:** Move the Sales Order into a deliverable/invoiceable state.

1. Open the Sales Order from Test 5
2. Click **Confirm**
3. Refresh the page
4. Try to change a line or customer field if the UI allows it

**Expected:**
- [ ] Status changes to `CONFIRMED`
- [ ] The order remains visible in the list
- [ ] Create actions become available for downstream documents
- [ ] Confirmed order should not behave like an editable draft

---

## TEST 7: Create and Post Delivery Note from Sales Order

**Goal:** Validate controlled stock delivery flow and stock decrease.

1. From the confirmed Sales Order, click **Create Delivery Note**
2. Confirm the Delivery Note create page opens
3. Verify the **Sales Order** selector shows a readable label like:
   - `SO-xxxxx - Sales Test Customer`
   - It must not require a raw UUID to be typed
4. Click **Load SO Lines**
5. Verify the stock item line is loaded
6. Set:
   - Delivery Date = today
   - Warehouse = `Main Warehouse`
7. Create the draft delivery note
8. Open the saved Delivery Note
9. Click **Post Delivery Note**
10. Go to **Inventory -> Stock Levels**
11. Verify `SAL-STK-001` quantity decreased by the delivered quantity
12. Go to **Inventory -> Movements**
13. Verify a stock movement exists for the posted delivery

**Expected:**
- [ ] DN number is generated automatically
- [ ] DN status becomes `POSTED`
- [ ] Stock decreases in the chosen warehouse
- [ ] Delivery Note line shows positive `Unit Cost (Base)` and `Line Cost (Base)`
- [ ] Sales Order delivered quantity is updated

---

## TEST 8: Negative Delivery Note Guard - Over-Delivery Block

**Goal:** Confirm over-delivery is blocked when tolerance is zero.

1. Create another Sales Order for `SAL-STK-001` with ordered qty `2`
2. Confirm the order
3. Create a new Delivery Note from that order
4. Load SO lines
5. Change delivered qty from `2` to `3`
6. Create draft and attempt to post

**Expected:**
- [ ] Posting is blocked with an over-delivery/open-qty error
- [ ] Delivery Note remains `DRAFT`
- [ ] No stock movement is created for the failed posting
- [ ] The Sales Order delivered quantity does not change

---

## TEST 9: Create and Post Sales Invoice from Sales Order

**Goal:** Validate controlled invoicing flow, AR/revenue voucher creation, and SO update.

1. Open the original Sales Order from Test 5
2. Click **Create Invoice**
3. Verify the **Sales Order** selector shows a readable label
4. Click **Load SO Lines**
5. Confirm the order lines are loaded
6. Set:
   - Invoice Date = today
   - Due Date = leave blank or set manually
   - Currency = base currency
   - Exchange Rate = `1`
7. Create draft invoice
8. Open the saved invoice
9. Click **Post Invoice**
10. Refresh the page

**Expected:**
- [ ] Invoice status becomes `POSTED`
- [ ] Invoice number is generated automatically
- [ ] Customer, totals, and SO reference are shown correctly
- [ ] The SO reference display uses a readable document label where available, not a raw UUID input
- [ ] If the item is tracked and perpetual inventory is enabled, COGS behavior is applied

---

## TEST 10: Negative Invoice Guard - Invoiced Qty Cannot Exceed Delivered Qty

**Goal:** Confirm controlled invoicing is blocked above delivered quantity.

1. Create and confirm a new Sales Order for `SAL-STK-001` with qty `5`
2. Create and post a Delivery Note for only qty `2`
3. Create a Sales Invoice from that Sales Order
4. Load SO lines
5. Change the invoice qty to `3`
6. Attempt to create/post the invoice

**Expected:**
- [ ] Posting is blocked with a delivered/open quantity validation error
- [ ] The invoice remains `DRAFT` if it was created
- [ ] No revenue voucher is created
- [ ] No stock side-effects are written for the failed posting

---

## TEST 11: Sales Invoice Voucher and Account Statement

**Goal:** Confirm the Sales Invoice voucher is created and openable from Account Statement.

1. Open the posted invoice from Test 9
2. Note the customer and posted amount
3. Open the customer detail page and note the **Default AR Account**
4. Go to **Accounting -> Reports -> Account Statement**
5. Select the customer's AR account
6. Choose a date range that includes the invoice date
7. Run the statement
8. Find the invoice entry
9. Click the voucher number

**Expected:**
- [ ] The account statement shows the Sales Invoice entry
- [ ] Debit/credit effect matches an AR increase
- [ ] Clicking the voucher opens the voucher successfully
- [ ] The voucher resolves with the Sales Invoice form, not a generic payment/receipt form

---

## TEST 12: Foreign Currency Sales Invoice

**Goal:** Confirm doc currency, base amounts, and exchange rate behavior are correct.

1. Create a new Sales Order for the same customer
2. Use a foreign currency enabled for the company
   - Example: `USD`
3. Set:
   - Qty = `2`
   - Unit Price = `10`
   - Exchange Rate = `40` if base is `TRY`
4. Confirm the SO
5. Create and post a Sales Invoice from it
6. Verify on the invoice detail page:
   - Doc subtotal = `20` in invoice currency
   - Base subtotal = `800` if rate is `40`
7. Open Account Statement for the AR account again
8. Confirm the posted base amount matches the invoice base total

**Expected:**
- [ ] Invoice doc totals and base totals are both correct
- [ ] Tax base amounts also match the exchange rate if tax is used
- [ ] Account statement amount is recorded in base currency correctly

---

## TEST 13: AFTER_INVOICE Sales Return

**Goal:** Confirm return after invoicing creates stock return plus revenue reversal.

1. Open the posted Sales Invoice from Test 9
2. Click **Create Return**
3. On the create page:
   - Confirm **After Invoice** mode is selected
   - Verify the source selector shows a readable invoice label, not a raw UUID field
4. Select the posted invoice if it is not already selected
5. Set:
   - Return Date = today
   - Reason = `Customer returned damaged item`
   - Warehouse = leave default or choose `Main Warehouse`
6. Create the draft return
7. Open the saved return
8. Click **Post Return**
9. Go to **Inventory -> Stock Levels**
10. Verify the returned stock quantity was added back
11. Go to **Accounting -> Reports -> Account Statement**
12. Open the AR account again and locate the Sales Return entry
13. Click the voucher number

**Expected:**
- [ ] Return status becomes `POSTED`
- [ ] Stock increases back into the warehouse
- [ ] The AR balance is reduced by the return value
- [ ] The return voucher opens successfully from Account Statement
- [ ] The voucher resolves with the Sales Return form
- [ ] Posted return lines show positive `Unit Cost`

---

## TEST 14: BEFORE_INVOICE Sales Return

**Goal:** Confirm return before invoicing affects stock without creating revenue reversal.

1. Create and confirm a new Sales Order for `SAL-STK-001`, qty `2`
2. Create and post a Delivery Note for that order
3. Open the posted Delivery Note
4. Click **Create Return**
5. On the return create page:
   - Select **Before Invoice**
   - Confirm the source selector shows a readable Delivery Note label
6. Create the draft return with reason `Rejected on delivery`
7. Open the saved return
8. Click **Post Return**
9. Check stock levels and stock movements
10. Check Account Statement for the customer AR account

**Expected:**
- [ ] Return status becomes `POSTED`
- [ ] Stock increases back into inventory
- [ ] Sales Order delivered quantity is reduced appropriately
- [ ] No AR/revenue reversal should appear because this is before invoicing
- [ ] If perpetual inventory is enabled, cost-side reversal behavior should still remain consistent

---

## TEST 15: Return Guard - Cannot Return More Than Already Returned/Source Qty

**Goal:** Confirm repeat return posting is blocked once source quantity is exhausted.

1. Use the posted Sales Invoice from Test 13 or another posted invoice with a full return already posted
2. Create a second **After Invoice** return from the same invoice
3. Create the draft return using the same source document
4. Attempt to post it
5. Repeat the same idea for a **Before Invoice** return using a Delivery Note that was already fully returned

**Expected:**
- [ ] Posting is blocked with a return-quantity validation error
- [ ] The new return stays `DRAFT`
- [ ] No extra stock movement is created
- [ ] No extra voucher is created

---

## TEST 16: Direct Sales Invoice Without Sales Order

**Goal:** Confirm direct invoicing still works when Sales Order is not selected.

1. Go to **Sales -> Sales Invoices -> New**
2. Leave **Sales Order** empty
3. Select customer = `Sales Test Customer`
4. Add one line for `SAL-STK-001`
5. Set:
   - Qty = `1`
   - Unit Price = `25`
   - Warehouse = `Main Warehouse`
6. Create draft invoice
7. Post the invoice

**Expected:**
- [ ] The invoice can be created without selecting a Sales Order
- [ ] Posting succeeds if stock and cost are available
- [ ] Stock movement is created for the tracked item
- [ ] Revenue voucher is created

---

## TEST 17: Zero-Cost Guard and Rollback

**Goal:** Confirm posting fails atomically when tracked inventory has no positive cost basis.

1. Ensure `SAL-STK-ZERO-001` exists with valid accounts but no opening stock or purchase cost history
2. Go to **Sales -> Sales Invoices -> New**
3. Leave **Sales Order** empty
4. Select customer = `Sales Test Customer`
5. Add one line:
   - Item = `SAL-STK-ZERO-001`
   - Qty = `1`
   - Unit Price = `10`
   - Warehouse = `Main Warehouse`
6. Create the draft invoice
7. Click **Post Invoice**
8. After the error, check:
   - Sales Invoice detail
   - Inventory movements
   - Account Statement or voucher list

**Expected:**
- [ ] Posting fails with a missing/invalid positive inventory cost error
- [ ] Invoice remains `DRAFT`
- [ ] No stock movement is created for the failed post
- [ ] No voucher is created for the failed post

---

## TEST 18: Numbering Collision Recovery

**Goal:** Confirm manual sequence rollback does not create duplicate document numbers.

1. Note an existing posted SO, DN, SI, or SR number
2. Go to **Sales -> Settings**
3. Set the matching **Next Seq** value back to a number that would collide with an existing document
   - Example: if `SI-00001` already exists, set `SI Next Seq = 1`
4. Save settings
5. Create a new document of that type
6. Save/post as needed

**Expected:**
- [ ] The new document does not reuse an existing number
- [ ] The system skips forward to the next free number
- [ ] No duplicate document number is created

Repeat for SO, DN, SI, and SR if you want full numbering coverage.

---

## TEST 19: UI Label Check - No Raw UUID Entry for Sales Source Selection

**Goal:** Confirm Sales create pages are usable without manually typing internal IDs.

1. Open **New Delivery Note**
2. Confirm the source field is a readable **Sales Order** selector
3. Open **New Sales Invoice**
4. Confirm the source field is a readable **Sales Order** selector
5. Open **New Sales Return**
6. Confirm the source document is selected from readable **Posted Sales Invoice** or **Posted Delivery Note** dropdowns
7. Confirm warehouse choices show warehouse names/codes instead of internal IDs

**Expected:**
- [ ] No raw UUID entry is required on these create flows
- [ ] Selectors display document numbers and customer names
- [ ] Warehouse selector displays warehouse labels

---

## TEST 20: Dashboard and List Sanity Check

**Goal:** Confirm major Sales pages show the posted results consistently.

1. Go to **Sales -> Overview**
2. Review:
   - Total Revenue
   - Outstanding AR
   - Posted Invoices
3. Go to **Sales -> Sales Orders**
4. Confirm order statuses reflect work done during testing
5. Go to **Sales -> Delivery Notes**
6. Confirm posted DNs are listed
7. Go to **Sales -> Sales Invoices**
8. Confirm posted invoices are listed
9. Go to **Sales -> Sales Returns**
10. Use the return context filter for `AFTER_INVOICE` and `BEFORE_INVOICE`

**Expected:**
- [ ] Overview values are reasonable for the documents posted in this run
- [ ] Lists show the created documents
- [ ] Sales Returns context filter works

---

## Evidence to Capture

Capture evidence for each major test:

- [ ] Source document screenshot
- [ ] Posted document header screenshot
- [ ] Voucher/account statement screenshot where applicable
- [ ] Stock level or movement screenshot where applicable
- [ ] Error screenshot for each negative test

---

## Result Table

| Test ID | Scenario | Status | Notes |
|---|---|---|---|
| 1 | Initialize Sales Module | ⬜ |  |
| 2 | Review Sales Settings | ⬜ |  |
| 3 | Create Customer Master | ⬜ |  |
| 4 | Verify Inventory Test Data | ⬜ |  |
| 5 | Create Draft Sales Order | ⬜ |  |
| 6 | Confirm Sales Order | ⬜ |  |
| 7 | Create and Post Delivery Note | ⬜ |  |
| 8 | Over-Delivery Guard | ⬜ |  |
| 9 | Create and Post Sales Invoice | ⬜ |  |
| 10 | Over-Invoice Guard | ⬜ |  |
| 11 | SI Voucher and Account Statement | ⬜ |  |
| 12 | Foreign Currency Sales Invoice | ⬜ |  |
| 13 | AFTER_INVOICE Sales Return | ⬜ |  |
| 14 | BEFORE_INVOICE Sales Return | ⬜ |  |
| 15 | Return Quantity Guard | ⬜ |  |
| 16 | Direct Sales Invoice | ⬜ |  |
| 17 | Zero-Cost Guard and Rollback | ⬜ |  |
| 18 | Numbering Collision Recovery | ⬜ |  |
| 19 | UI Label Check | ⬜ |  |
| 20 | Dashboard and List Sanity Check | ⬜ |  |

---

## Exit Criteria

Sales manual QA can be considered ready to sign off when:

- [ ] All critical posting flows pass
- [ ] All negative tests fail safely without partial persistence
- [ ] Sales Invoice and Sales Return vouchers open from Account Statement
- [ ] No duplicate document numbers are observed
- [ ] No raw UUID entry is required on Sales create flows
- [ ] No blocked issue remains on stock, voucher, or AR totals
