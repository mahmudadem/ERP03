# Manual Test — 04: Cost Center (Full Implementation)

## Feature Overview

**What it is:** Cost Centers are organizational units (departments, projects, branches) used to track where costs occur and revenues originate. They enable management accounting — answering questions like "How much did Marketing spend this quarter?" or "Which branch is most profitable?"

**How it works:**
- Admin creates cost centers with a code, name, and optional parent (for hierarchy)
- Each voucher line can optionally be tagged with a cost center
- The `CostCenterRequiredPolicy` can mandate cost centers for certain account classifications
- Cost centers can be deactivated (soft-deleted) but not hard-deleted if used in vouchers

**Workflow impact:**
- Voucher entry now includes a cost center field per line
- Reports can be filtered/grouped by cost center
- Budget module can have per-cost-center budgets
- Management gets department-level profitability visibility

**Benefits:**
- Department/branch-level cost tracking without separate companies
- Hierarchical structure (e.g., Operations → Marketing, Sales, IT)
- Policy-enforced: configurable which accounts require cost center assignment
- Foundation for departmental budgeting and cost allocation

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] User has `accounting.accounts.view` and `accounting.settings.write` permissions
- [ ] At least some accounts in the Chart of Accounts (for testing voucher integration)

---

## Test Cases

### TC-04.1 — Access Cost Centers Page

**Steps:**
1. Navigate to **Accounting → Cost Centers**
2. Observe the page

**Expected:**
- [ ] Cost Centers page loads
- [ ] An empty list or existing cost centers are shown
- [ ] A "Create" or "Add" button is available

---

### TC-04.2 — Create a Root Cost Center

**Steps:**
1. Click Create/Add
2. Enter code: **OPS**, name: **Operations**, description: "Main operations department"
3. Leave parent empty (root level)
4. Save

**Expected:**
- [ ] Cost center is created successfully
- [ ] It appears in the list with code "OPS" and name "Operations"
- [ ] Status shows **ACTIVE**
- [ ] No parent indicated

---

### TC-04.3 — Create a Child Cost Center (Hierarchy)

**Steps:**
1. Create another cost center:
   - Code: **OPS-MKT**, Name: **Marketing**, Parent: **Operations (OPS)**
2. Create a sibling:
   - Code: **OPS-IT**, Name: **IT Department**, Parent: **Operations (OPS)**

**Expected:**
- [ ] Both children are created under the "Operations" parent
- [ ] The tree view shows hierarchy: Operations → Marketing, IT Department
- [ ] Children are indented under the parent
- [ ] The parent has an expand/collapse chevron

---

### TC-04.4 — Validation Rules

**Steps:**
1. Try creating a cost center with **empty code** → Save
2. Try creating a cost center with **empty name** → Save
3. Try creating a cost center with a code longer than **20 characters** → Save
4. Try creating a cost center with a **duplicate code** (same as existing) → Save

**Expected:**
- [ ] Empty code: validation error "Code is required"
- [ ] Empty name: validation error "Name is required"
- [ ] Code too long: validation error about max length
- [ ] Duplicate code: error (unique constraint)

---

### TC-04.5 — Update a Cost Center

**Steps:**
1. Select an existing cost center
2. Change its name, description, or code
3. Save

**Expected:**
- [ ] Changes persist after save
- [ ] The list updates to reflect the new values
- [ ] Code changes are validated (no duplicates, not empty)

---

### TC-04.6 — Deactivate a Cost Center

**Steps:**
1. Select a cost center that is NOT used in any posted vouchers
2. Deactivate it
3. Check if it still appears in the list

**Expected:**
- [ ] Status changes to **INACTIVE**
- [ ] The cost center is still visible but marked as inactive (badge/styling)
- [ ] The inactive cost center no longer appears in the cost center **selector** dropdown (voucher entry)

---

### TC-04.7 — Cost Center Selector in Voucher Entry

**Steps:**
1. Navigate to create a new voucher
2. Look at the voucher lines table
3. Check if a **Cost Center** column exists

**Expected:**
- [ ] A "Cost Center" column (or dropdown) is visible in the voucher lines
- [ ] Clicking it opens a searchable dropdown showing active cost centers
- [ ] Cost centers display their code + name
- [ ] Only ACTIVE cost centers appear in the selector
- [ ] Selecting a cost center assigns it to that line

---

### TC-04.8 — Save Voucher with Cost Center

**Steps:**
1. Create a new voucher with at least 2 lines
2. Assign different cost centers to each line
3. Save and post the voucher
4. Reopen the voucher

**Expected:**
- [ ] Cost center assignments persist after save
- [ ] Cost center assignments persist after posting
- [ ] When reopening, the correct cost centers are shown per line

---

### TC-04.9 — Cost Center in Ledger Entries

**Steps:**
1. After posting a voucher with cost centers
2. Open the **General Ledger** report

**Expected:**
- [ ] Ledger entries show the cost center (code/name) inline or in a column
- [ ] Entries can be identified by their cost center assignment

---

### TC-04.10 — Cost Center Without Assignment (Optional)

**Steps:**
1. Create a voucher without assigning any cost center to lines
2. Save and post

**Expected:**
- [ ] Voucher saves successfully (cost center is optional by default)
- [ ] No validation errors unless cost center policy is enabled

---

### TC-04.11 — CostCenterRequiredPolicy Enforcement

**Steps:**
1. If there's a setting to require cost centers for certain account types (e.g., Expense accounts)
2. Enable the cost center requirement
3. Create a voucher with an Expense account line but **no cost center**
4. Try to save/post

**Expected:**
- [ ] Validation error: "Cost center is required for [account type]"
- [ ] Adding a cost center to the line resolves the error
- [ ] Lines with non-required account types (e.g., Asset) can be saved without cost center

---

### TC-04.12 — Deactivate Cost Center Used in Vouchers

**Steps:**
1. Create and post a voucher that uses cost center "Marketing" (OPS-MKT)
2. Try to deactivate cost center "Marketing"

**Expected:**
- [ ] Either: deactivation succeeds but existing ledger entries retain the cost center reference
- [ ] Or: deactivation is blocked with a message "Cost center is used in posted vouchers"
- [ ] Either way, historical data is preserved

---

### TC-04.13 — Parent Deactivation

**Steps:**
1. Try to deactivate a parent cost center that has active children
2. Observe the behavior

**Expected:**
- [ ] Either: blocked with "Cannot deactivate — has active children"
- [ ] Or: cascading deactivation (children also become inactive)
- [ ] The behavior should be consistent and predictable

---

### TC-04.14 — Permission Check

**Steps:**
1. Log in as a user with `accounting.accounts.view` but NOT `accounting.settings.write`
2. Navigate to Cost Centers

**Expected:**
- [ ] User can **view** the list of cost centers
- [ ] User **cannot** create, update, or deactivate cost centers
- [ ] Write actions return permission errors

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-04.1 | ⬜ | |
| TC-04.2 | ⬜ | |
| TC-04.3 | ⬜ | |
| TC-04.4 | ⬜ | |
| TC-04.5 | ⬜ | |
| TC-04.6 | ⬜ | |
| TC-04.7 | ⬜ | |
| TC-04.8 | ⬜ | |
| TC-04.9 | ⬜ | |
| TC-04.10 | ⬜ | |
| TC-04.11 | ⬜ | |
| TC-04.12 | ⬜ | |
| TC-04.13 | ⬜ | |
| TC-04.14 | ⬜ | |
