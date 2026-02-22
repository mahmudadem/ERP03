# Manual Test — Purchases Module

## Prerequisites
- [ ] Inventory module implemented (items, warehouses, stock levels)
- [ ] Accounting module configured (AP control account exists)

## Test Cases

### TC-PUR.1 — Supplier CRUD
**Steps:** Create supplier with AP sub-account → Edit → Search → Delete (no invoices)
**Expected:**
- [ ] Supplier created, AP sub-account in COA
- [ ] Searchable by name/code
- [ ] Deletable when no invoices

### TC-PUR.2 — Purchase Order Lifecycle
**Steps:** Create PO → Approve → Cannot edit post-approval → Cancel (no receipts)
**Expected:**
- [ ] PO number auto-generated
- [ ] Draft → Approved transition
- [ ] Approved PO not editable
- [ ] Cancel blocked if receipts exist

### TC-PUR.3 — Goods Receipt from PO
**Steps:** Create GRN from PO → Lines pre-filled → Post → Check inventory increased
**Expected:**
- [ ] GRN lines match PO outstanding quantities
- [ ] Stock levels increase in specified warehouse
- [ ] Stock movements created (type: purchase_receipt)
- [ ] PO receivedQuantities updated

### TC-PUR.4 — Purchase Invoice → Accounting Voucher
**Steps:** Create PI → Post → Verify voucher in accounting → Check AP balance
**Expected:**
- [ ] Invoice posted successfully
- [ ] Accounting voucher created (Debit: Purchases, Credit: AP)
- [ ] Voucher visible in accounting module
- [ ] AP account balance increased

### TC-PUR.5 — Multi-Currency Invoice
**Steps:** Create PI in foreign currency → Post → Verify exchange rate applied
**Expected:**
- [ ] Base amounts calculated correctly
- [ ] Voucher lines in base currency

### TC-PUR.6 — Debit Note (Return)
**Steps:** Create debit note from invoice → Post → Check AP decreased + stock adjusted
**Expected:**
- [ ] AP reversal voucher created
- [ ] Supplier balance decreased

### TC-PUR.7 — Reports
**Steps:** AP Aging → Supplier Statement → Purchase Register → Dashboard
**Expected:**
- [ ] AP Aging matches unpaid invoices
- [ ] Supplier statement shows all transactions
- [ ] Dashboard totals consistent

## Test Results
| Test ID | Status | Notes |
|---|---|---|
| TC-PUR.1 | ⬜ | Suppliers |
| TC-PUR.2 | ⬜ | PO Lifecycle |
| TC-PUR.3 | ⬜ | Goods Receipt |
| TC-PUR.4 | ⬜ | Invoice Posting |
| TC-PUR.5 | ⬜ | Multi-Currency |
| TC-PUR.6 | ⬜ | Returns |
| TC-PUR.7 | ⬜ | Reports |
