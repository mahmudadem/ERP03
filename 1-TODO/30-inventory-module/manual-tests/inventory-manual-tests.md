# Manual Test — Inventory Module

## Prerequisites
- [ ] Company with accounting initialized
- [ ] User has inventory module enabled

## Test Cases

### TC-INV.1 — Item CRUD
**Steps:** Create item with all fields (product type, pricing, accounting links) → Edit → Deactivate → Verify list filter
**Expected:**
- [ ] Item created with correct fields
- [ ] Item editable
- [ ] Deactivated item hidden from active list

### TC-INV.2 — Categories & Account Inheritance
**Steps:** Create category with default accounts → Create item in category → Verify accounts inherited
**Expected:**
- [ ] Category created
- [ ] Item inherits default accounts from category

### TC-INV.3 — Warehouse Management
**Steps:** Create warehouse → Set as default → Create second → Verify only one default
**Expected:**
- [ ] Warehouse created
- [ ] Only one default at a time

### TC-INV.4 — Stock Movements & Levels
**Steps:** Record opening stock → Record purchase receipt → Record sales delivery → Check stock level
**Expected:**
- [ ] Stock level increases on IN movements
- [ ] Stock level decreases on OUT movements
- [ ] Movement history shows all records

### TC-INV.5 — Stock Adjustment (with Accounting)
**Steps:** Create stock adjustment (decrease) → Post → Verify stock + accounting voucher
**Expected:**
- [ ] Stock level adjusted
- [ ] Accounting voucher generated (Debit: Stock Adj, Credit: Inventory)

### TC-INV.6 — Stock Transfer
**Steps:** Transfer items between warehouses → Verify source decreases, destination increases
**Expected:**
- [ ] Source warehouse stock decreases
- [ ] Destination warehouse stock increases
- [ ] Total company stock unchanged

### TC-INV.7 — Dashboard & Reports
**Steps:** Check dashboard cards → Run valuation report → Check low stock alerts
**Expected:**
- [ ] Dashboard shows correct totals
- [ ] Valuation matches qty × average cost
- [ ] Low stock shows items below minimum

## Test Results
| Test ID | Status | Notes |
|---|---|---|
| TC-INV.1 | ⬜ | Item CRUD |
| TC-INV.2 | ⬜ | Categories |
| TC-INV.3 | ⬜ | Warehouses |
| TC-INV.4 | ⬜ | Stock Movements |
| TC-INV.5 | ⬜ | Stock Adjustment |
| TC-INV.6 | ⬜ | Stock Transfer |
| TC-INV.7 | ⬜ | Dashboard |
