# Manual Test — Sales Module

## Prerequisites
- [ ] Inventory module implemented
- [ ] Accounting module configured (AR control account exists)

## Test Cases

### TC-SAL.1 — Customer CRUD
**Steps:** Create customer with AR sub-account → Edit → Search → Delete
**Expected:**
- [ ] Customer created, AR sub-account in COA
- [ ] Searchable, deletable (when no invoices)

### TC-SAL.2 — Quotation → Sales Order Conversion
**Steps:** Create quotation → Send → Convert to SO → Verify quotation marked converted
**Expected:**
- [ ] Quotation number auto-generated
- [ ] SO created with same lines
- [ ] Quotation status = converted

### TC-SAL.3 — Sales Order Lifecycle
**Steps:** Create SO → Confirm → Cannot edit → Cancel (no deliveries)
**Expected:**
- [ ] SO number auto-generated
- [ ] Confirmed SO not editable

### TC-SAL.4 — Delivery Note → Inventory
**Steps:** Create DN from SO → Post → Stock decreases → SO deliveredQuantities updated
**Expected:**
- [ ] Stock levels decrease in warehouse
- [ ] Stock movements created (type: sales_delivery)
- [ ] Insufficient stock → error on post

### TC-SAL.5 — Sales Invoice → Accounting Voucher
**Steps:** Create SI → Post → Verify voucher (Debit AR, Credit Revenue) → Check AR balance
**Expected:**
- [ ] Accounting voucher created correctly
- [ ] AR balance increased for customer
- [ ] Voucher visible in accounting module

### TC-SAL.6 — Receipt Against Invoice
**Steps:** Record receipt → amountReceived updated → Status transitions to paid
**Expected:**
- [ ] Status: posted → partially_paid → paid
- [ ] AR balance decreases

### TC-SAL.7 — Credit Note
**Steps:** Create credit note from invoice → Post → AR reversal → Stock return
**Expected:**
- [ ] AR reversal voucher created
- [ ] Customer balance decreased

### TC-SAL.8 — Reports & Dashboard
**Steps:** AR Aging → Customer Statement → Sales by Item → Dashboard
**Expected:**
- [ ] Reports show accurate data
- [ ] Dashboard revenue matches posted invoices

## Test Results
| Test ID | Status | Notes |
|---|---|---|
| TC-SAL.1 | ⬜ | Customers |
| TC-SAL.2 | ⬜ | Quotation→SO |
| TC-SAL.3 | ⬜ | SO Lifecycle |
| TC-SAL.4 | ⬜ | Delivery→Stock |
| TC-SAL.5 | ⬜ | Invoice→GL |
| TC-SAL.6 | ⬜ | Receipts |
| TC-SAL.7 | ⬜ | Credit Notes |
| TC-SAL.8 | ⬜ | Reports |
