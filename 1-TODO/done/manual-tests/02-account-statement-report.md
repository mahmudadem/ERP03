# Manual Test — 02: Account Statement Report

## Feature Overview

**What it is:** The Account Statement is the most frequently used report by accountants. It shows all transactions for a single account in chronological order with a running balance — like a bank statement but for any account in your chart of accounts.

**How it works:**
- User selects one account from the Chart of Accounts and a date range
- Backend computes the **Opening Balance** (all entries before the start date)
- Entries within the date range are listed chronologically with Debit, Credit, and a **Running Balance** that accumulates from the opening balance
- A **Closing Balance** is shown at the bottom
- Foreign currency accounts show both FX and base currency columns

**Workflow impact:**
- Primary tool for verifying a customer's outstanding balance
- Used to reconcile bank accounts against bank statements
- Debug tool for tracing why an account balance looks wrong
- Voucher numbers are clickable — enabling drill-through to source documents

**Benefits:**
- Running balance gives instant visibility into how the balance changed over time
- Opening/closing balance provides period-level summary
- Foreign currency support handles multi-currency accounting natively
- Server-side running balance computation ensures accuracy

---

## Prerequisites

- [x] At least one company with accounting initialized
- [x] Chart of Accounts with at least 3-4 accounts that have posted transactions
- [x] At least **5+ posted vouchers** spread across different dates
- [x] At least one account with transactions **before** the test date range (for opening balance testing)
- [x] (Optional) A foreign currency account with FX transactions
- [x] User has `accounting.reports.generalLedger.view` permission

---

## Test Cases

### TC-02.1 — Basic Page Load and Navigation

**Steps:**
1. Navigate to **Accounting → Reports → Account Statement**
2. Observe the page layout

**Expected:**
- [x] Page title shows "Account Statement"
- [x] An **Account Selector** dropdown is visible (same component as used in voucher entry)
- [x] Date range inputs (From / To) are visible
- [x] A **Load** or **Refresh** button is visible
- [x] No data table is shown until an account is selected

---

### TC-02.2 — Select Account and Load Statement

**Steps:**
1. Select an account that has posted transactions (e.g., "Cash in Bank")
2. Set a date range that covers some of those transactions
3. Click Load / Refresh (or it auto-loads)

**Expected:**
- [x] The account header shows: **Account Code**, **Account Name**, **Account Currency**
- [x] Period information shows the From and To dates
- [x] An **Opening Balance** row appears at the top (styled differently — bold/highlighted)
- [x] Transaction rows appear in **chronological order** (oldest first)
- [x] Each row shows: **Date**, **Voucher No**, **Description**, **Debit**, **Credit**, **Running Balance**
- [x] A **Closing Balance** row appears at the bottom
- [x] Total Debit and Total Credit sums are shown

---

### TC-02.3 — Opening Balance Accuracy

**Steps:**
1. Choose an account with known transactions both BEFORE and DURING the selected date range
2. Manually calculate: Opening Balance = sum of all debits minus credits for this account, for entries dated BEFORE the "From" date
3. Compare with the displayed opening balance

**Expected:**
- [x] Opening balance matches your manual calculation
- [x] Opening balance is shown even if it's zero
- [x] Opening balance reflects the net of all prior-period entries

**Edge case:** Set "From" date to the very beginning (before any transactions) → Opening Balance should be 0.

---

### TC-02.4 — Running Balance Accuracy

**Steps:**
1. Load a statement with at least 5 entries
2. Starting from the Opening Balance, manually verify each row:
   - For a Debit entry: Running Balance = Previous Balance + Debit amount
   - For a Credit entry: Running Balance = Previous Balance − Credit amount
   (Note: this depends on the account's balance nature — debit-nature vs credit-nature accounts may differ)

**Expected:**
- [x] Each row's running balance correctly reflects the cumulative total
- [x] The running balance after the last row **equals** the displayed Closing Balance
- [x] No gaps or jumps in the running balance sequence

---

### TC-02.5 — Closing Balance Matches

**Steps:**
1. Load a statement
2. Note the Closing Balance
3. Cross-reference with the Trial Balance for the same account at the "To" date

**Expected:**
- [x] Closing Balance = Opening Balance + Total Debits − Total Credits (for debit-nature accounts)
- [x] Closing Balance matches the account's balance in the Trial Balance at the same date
- [x] Closing Balance matches the last row's running balance

---

### TC-02.6 — Date Range Filter

**Steps:**
1. Load a full statement (wide date range covering all transactions)
2. Note the number of entries
3. Narrow the date range to cover only a subset
4. Reload
5. Widen the range again

**Expected:**
- [x] Narrower range shows fewer entries
- [x] Only entries within the date range appear in the table
- [x] Opening Balance recalculates to reflect pre-period balances for the new start date
- [x] Widening the range shows all entries again

---

### TC-02.7 — Empty Account (No Transactions)

**Steps:**
1. Select an account that has **no posted transactions at all**
2. Load the statement

**Expected:**
- [x] Page loads without errors
- [x] Opening Balance shows 0
- [x] No transaction rows in the table (empty or "No entries" message)
- [x] Closing Balance shows 0 (or blank)
- [x] Export buttons still work without crashing

---

### TC-02.8 — No Transactions in Date Range

**Steps:**
1. Select an account with transactions, but set a date range where **no transactions exist** (e.g., a future date range)
2. Load the statement

**Expected:**
- [x] Opening Balance is calculated correctly (all entries are "before" the range)
- [x] The transaction table is empty
- [x] Closing Balance equals the Opening Balance

---

### TC-02.9 — Voucher Number Link (Drill-Through)

**Steps:**
1. Load a statement with entries
2. Click on a **Voucher Number** in the list

**Expected:**
- [x] The voucher opens in a detail view (modal, window, or new page)
- [x] The opened voucher shows the full voucher details (lines, amounts, status)
- [x] You can close/return back to the Account Statement

---

### TC-02.10 — Foreign Currency Account

**Steps:**
1. Select an account that has a **non-base currency** (e.g., EUR account in a USD-base company)
2. Load the statement

**Expected:**
- [x] Additional columns appear for FX: **Currency**, **FX Amount**, **Exchange Rate**
- [x] The Debit/Credit columns show **base currency** amounts
- [x] FX columns show the original foreign currency amounts
- [x] Running balance is computed in the base currency
- [x] If there's also a base-currency running balance, both are shown

---

### TC-02.11 — Include Unposted Option (If Available)

**Steps:**
1. Check if there's an "Include Unposted" toggle or checkbox
2. Create a voucher in DRAFT status (not posted) for the selected account
3. Toggle the option on and off

**Expected:**
- [ ] With "Include Unposted" OFF: only posted entries appear
- [ ] With "Include Unposted" ON: draft/pending entries also appear (possibly styled differently)
- [ ] Running balance always reflects only what's shown

---

### TC-02.12 — Print Layout

**Steps:**
1. Load a statement with data
2. Click **Print**
3. Check the print preview

**Expected:**
- [ ] The toolbar/controls are hidden in print
- [ ] Account header info is shown at the top
- [ ] The table prints cleanly with all columns
- [ ] Page breaks are handled sensibly if there are many rows
- [ ] Opening and Closing Balance rows are clearly visible

---

10201 - cash try1

**Steps:**
1. Select an account with many entries (50+ if possible, ideally 100+)
2. Load the statement

**Expected:**
- [ ] Page loads within a reasonable time (under 5 seconds)
- [ ] Scrolling is smooth
- [ ] Running balance is correctly computed for every single row
- [ ] No data is missing or truncated

---

### TC-02.14 — Cross-Validation with General Ledger

**Steps:**
1. Open the **General Ledger** report, filter to a specific account and date range
2. Open the **Account Statement** for the same account and date range
3. Compare the entries

**Expected:**
- [ ] The same entries appear in both reports
- [ ] The debit and credit amounts match for each entry
- [ ] The General Ledger's total debit/credit sums match the Account Statement's totals

---

### TC-02.15 — Permission Check

**Steps:**
1. Log in as a user without `accounting.reports.generalLedger.view` permission
2. Try to access the Account Statement page

**Expected:**
- [ ] Access is denied (redirect, hidden menu item, or error message)
- [ ] The API returns an authorization error

---

### TC-02.16 — Debit-Nature vs Credit-Nature Accounts

**Steps:**
1. Test with a **debit-nature** account (e.g., Asset — Cash)
2. Test with a **credit-nature** account (e.g., Liability — Accounts Payable)
3. Compare running balance behavior

**Expected:**
- [ ] For debit-nature: Debits increase the balance, Credits decrease it
- [ ] For credit-nature: Credits increase the balance, Debits decrease it
- [ ] The running balance accurately reflects the correct convention for each type

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-02.1 | ⬜ | |
| TC-02.2 | ⬜ | |
| TC-02.3 | ⬜ | |
| TC-02.4 | ⬜ | |
| TC-02.5 | ⬜ | |
| TC-02.6 | ⬜ | |
| TC-02.7 | ⬜ | |
| TC-02.8 | ⬜ | |
| TC-02.9 | ⬜ | |
| TC-02.10 | ⬜ | |
| TC-02.11 | ⬜ | |
| TC-02.12 | ⬜ | |
| TC-02.13 | ⬜ | |
| TC-02.14 | ⬜ | |
| TC-02.15 | ⬜ | |
| TC-02.16 | ⬜ | |
