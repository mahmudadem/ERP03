# Manual Test — 11: Aging Reports (AR / AP)

## Feature Overview

**What it is:** Aging reports show how long invoices and payments have been outstanding, organized into time buckets (Current, 30, 60, 90, 120+ days). AR Aging tracks who owes you money; AP Aging tracks what you owe suppliers.

**How it works:**
- Backend calculates the age of each outstanding transaction based on its date vs the "as of" date
- Transactions are bucketed: Current, 1-30 days, 31-60, 61-90, 91-120, 120+
- Report shows per-account breakdown with totals per bucket
- Drill-down to individual transactions per account

**Workflow impact:**
- Collections teams use AR Aging to prioritize follow-ups
- Finance uses AP Aging to manage cash flow and payment scheduling
- Identifies credit risk from slow-paying customers

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] Receivable accounts (ASSET / AR role) with multiple transactions at **different dates**
- [ ] Payable accounts (LIABILITY / AP role) with transactions at different dates
- [ ] Transactions spanning at least 60+ days back for meaningful bucket distribution

---

## Test Cases

### TC-11.1 — Access Aging Report

**Steps:**
1. Navigate to **Accounting → Reports → Aging**

**Expected:**
- [ ] Aging report page loads
- [ ] Toggle or selector for **AR** vs **AP** view
- [ ] An "As of" date picker (defaults to today)
- [ ] A Load/Refresh button

---

### TC-11.2 — AR Aging Report

**Steps:**
1. Select **AR** (Accounts Receivable)
2. Set "As of" date to today
3. Load the report

**Expected:**
- [ ] Only receivable/AR accounts appear
- [ ] Table columns: Account | Current | 1-30 | 31-60 | 61-90 | 91-120 | 120+ | Total
- [ ] Each account shows amounts bucketed by age
- [ ] A **totals row** at the bottom sums each column

---

### TC-11.3 — AP Aging Report

**Steps:**
1. Switch to **AP** (Accounts Payable)
2. Load

**Expected:**
- [ ] Only payable/AP accounts appear
- [ ] Same bucket structure as AR
- [ ] Totals reflect payable amounts

---

### TC-11.4 — Aging Bucket Accuracy

**Steps:**
1. Pick one account with known transactions
2. Manually calculate: for each transaction, days outstanding = "as of" date − transaction date
3. Verify which bucket each falls into

**Expected:**
- [ ] Transactions 0 days old → Current
- [ ] 1-30 days → 1-30 bucket
- [ ] 31-60 days → 31-60 bucket
- [ ] 61-90 days → 61-90 bucket
- [ ] 91-120 days → 91-120 bucket
- [ ] 120+ days → 120+ bucket
- [ ] Account total = sum of all buckets

---

### TC-11.5 — "As of" Date Filter

**Steps:**
1. Load AR Aging as of today
2. Change "as of" date to **60 days ago**
3. Reload

**Expected:**
- [ ] The report recalculates aging relative to the new "as of" date
- [ ] Transactions that didn't exist yet on that date are excluded
- [ ] Bucket amounts change to reflect the historical perspective

---

### TC-11.6 — Drill-Down to Transactions

**Steps:**
1. Click on an account row (or a specific amount/cell)

**Expected:**
- [ ] A drill-down view shows individual outstanding transactions for that account
- [ ] Each transaction shows: date, voucher number, amount, days outstanding
- [ ] Transactions match the bucket they were counted in

---

### TC-11.7 — Color Gradient

**Steps:**
1. Observe the visual styling of the aging buckets

**Expected:**
- [ ] Older buckets have more urgent coloring (e.g., green → yellow → red)
- [ ] 120+ bucket is clearly highlighted as high-risk

---

### TC-11.8 — Empty Report (No Outstanding)

**Steps:**
1. Select an account type with no outstanding transactions

**Expected:**
- [ ] Report loads without errors
- [ ] All amounts show 0
- [ ] Empty state or "No outstanding items" message

---

### TC-11.9 — Grand Total Verification

**Steps:**
1. Load the AR aging
2. Sum the "Total" column manually

**Expected:**
- [ ] Grand Total matches the sum of all individual account totals
- [ ] Grand Total matches the sum of all bucket totals (row-wise = column-wise)

---

### TC-11.10 — Print / Export

**Steps:**
1. Load the aging report
2. Click Print or Export

**Expected:**
- [ ] Print layout is clean with all columns visible
- [ ] Export generates a usable file (CSV or Excel)

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-11.1 | ⬜ | |
| TC-11.2 | ⬜ | |
| TC-11.3 | ⬜ | |
| TC-11.4 | ⬜ | |
| TC-11.5 | ⬜ | |
| TC-11.6 | ⬜ | |
| TC-11.7 | ⬜ | |
| TC-11.8 | ⬜ | |
| TC-11.9 | ⬜ | |
| TC-11.10 | ⬜ | |
