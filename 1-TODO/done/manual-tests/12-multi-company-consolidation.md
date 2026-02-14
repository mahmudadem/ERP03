# Manual Test — 12: Multi-Company Consolidation

## Feature Overview

**What it is:** Multi-Company Consolidation combines financial statements from multiple subsidiaries into a single group-level view. Essential for holding companies and enterprise groups managing multiple entities.

**How it works:**
- Admin defines a Company Group (parent + subsidiaries) with a reporting currency
- System fetches each subsidiary's Trial Balance and converts to the reporting currency using exchange rates
- Balances are summed by account code to produce a Consolidated Trial Balance
- Inter-company eliminations can be configured (not yet implemented per the completion report)

**Workflow impact:**
- Group CFOs and controllers get a single view of the entire organization
- FX conversion handles subsidiaries operating in different currencies
- Foundation for consolidated Balance Sheet and P&L

---

## Prerequisites

- [ ] At least **2-3 companies** set up in the system, each with:
  - Accounting initialized
  - Some posted vouchers / ledger data
  - A defined Chart of Accounts
- [ ] Ideally, companies with **different base currencies** (e.g., one USD, one EUR) to test FX conversion
- [ ] Exchange rates defined between the currencies

---

## Test Cases

### TC-12.1 — Access Consolidation Page

**Steps:**
1. Navigate to **Accounting → Consolidation** (or Reports → Consolidated)

**Expected:**
- [ ] Consolidation page loads
- [ ] Options to manage Company Groups and view consolidated reports

---

### TC-12.2 — Create a Company Group

**Steps:**
1. Click "Create Group" or "Manage Groups"
2. Enter group name: "Test Holdings"
3. Select 2+ companies as subsidiaries
4. Set reporting currency (e.g., USD)
5. Save

**Expected:**
- [ ] Group is created successfully
- [ ] Subsidiaries are listed under the group
- [ ] Reporting currency is recorded

---

### TC-12.3 — View Consolidated Trial Balance

**Steps:**
1. Select the company group
2. Set an "As of" date
3. Load the Consolidated Trial Balance

**Expected:**
- [ ] A single Trial Balance appears combining all subsidiaries
- [ ] Account balances from each subsidiary are summed
- [ ] If subsidiaries have different currencies, amounts are **converted** to the reporting currency
- [ ] Total Debits = Total Credits (balanced)

---

### TC-12.4 — FX Conversion Accuracy

**Steps:**
1. If companies have different base currencies:
   - Note Company A's balance for "Cash" (e.g., 1000 EUR)
   - Note the EUR/USD exchange rate (e.g., 1.10)
   - Check the consolidated report
2. Verify the converted amount

**Expected:**
- [ ] 1000 EUR × 1.10 = 1100 USD in the consolidated view
- [ ] Conversion uses the correct exchange rate for the reporting currency
- [ ] The reporting currency is clearly labeled

---

### TC-12.5 — Same-Currency Companies (No FX)

**Steps:**
1. If all subsidiaries are in the same currency, load the consolidated report

**Expected:**
- [ ] Balances are simply summed (no FX conversion needed)
- [ ] Results are straightforward addition of each company's Trial Balance

---

### TC-12.6 — Group Selector

**Steps:**
1. If multiple groups exist, switch between them

**Expected:**
- [ ] Each group shows different consolidated results
- [ ] The selected group name is clearly displayed
- [ ] Subsidiaries list updates per group

---

### TC-12.7 — Single-Company Group

**Steps:**
1. Create a group with only one subsidiary
2. Load the consolidated report

**Expected:**
- [ ] Consolidated results are identical to the single company's Trial Balance
- [ ] No errors from having only one subsidiary

---

### TC-12.8 — Empty Company in Group

**Steps:**
1. Add a company with no transactions to the group
2. Load the consolidated report

**Expected:**
- [ ] No errors
- [ ] The empty company contributes zero to all balances
- [ ] Other companies' data is unaffected

---

### TC-12.9 — Inter-Company Eliminations (If Available)

**Steps:**
1. If elimination configuration exists, set up inter-company eliminations
2. Reload the consolidated report

**Expected:**
- [ ] Elimination column or row shows adjusted values
- [ ] Inter-company receivables/payables cancel out
- [ ] Net consolidated balance excludes inter-company transactions

**Note:** Per the completion report, inter-company eliminations are **not yet implemented** — mark this as N/A if not available.

---

### TC-12.10 — Permission Check

**Steps:**
1. Log in as a user without consolidation permissions
2. Try to access consolidated reports or manage groups

**Expected:**
- [ ] Access is denied appropriately

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-12.1 | ⬜ | |
| TC-12.2 | ⬜ | |
| TC-12.3 | ⬜ | |
| TC-12.4 | ⬜ | |
| TC-12.5 | ⬜ | |
| TC-12.6 | ⬜ | |
| TC-12.7 | ⬜ | |
| TC-12.8 | ⬜ | |
| TC-12.9 | ⬜ | |
| TC-12.10 | ⬜ | |
