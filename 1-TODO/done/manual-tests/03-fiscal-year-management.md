# Manual Test — 03: Fiscal Year & Period Management

## Feature Overview

**What it is:** Fiscal Year Management defines formal accounting periods (12 monthly periods per year) with status tracking (Open/Closed/Locked). It enables year-end closing — the process of zeroing P&L accounts into Retained Earnings and carrying forward balance sheet accounts.

**How it works:**
- Admin creates a Fiscal Year (e.g., FY2026, Jan–Dec), and the system auto-generates 12 monthly periods
- Each period has a status: OPEN → CLOSED → LOCKED
- Closing a period blocks new postings for that month
- Year-end close generates a closing journal entry that zeros Revenue/Expense accounts and transfers the net to Retained Earnings
- Integrates with the `PeriodLockPolicy` so voucher posting respects period status

**Workflow impact:**
- Accountants can now formally "cut off" a month, preventing accidental back-dated entries
- Year-end close is automated — no manual closing journal needed
- The period lock policy becomes fiscal-period-aware instead of relying on a raw date

**Benefits:**
- Prevents accidental posting to past periods
- Automates year-end close journal entry
- Enables comparative reporting (FY2025 vs FY2026)
- Audit-friendly: clear period boundaries with who closed what and when

---

## Prerequisites

- [ ] Company with accounting initialized and at least some posted vouchers
- [ ] User has `accounting.settings.read` and `accounting.settings.write` permissions
- [ ] Know which account is designated as "Retained Earnings" (EQUITY account)
- [ ] Have Revenue and Expense accounts with posted transactions (for year-end close test)

---

## Test Cases

### TC-03.1 — Access Fiscal Year Management

**Steps:**
1. Navigate to **Accounting → Settings** (or Accounting → Fiscal Years, depending on routing)
2. Look for a Fiscal Year section/tab

**Expected:**
- [ ] Fiscal Year management section is accessible
- [ ] A list of existing fiscal years is shown (or empty if none created yet)
- [ ] A "Create Fiscal Year" button/form is available

---

### TC-03.2 — Create a Fiscal Year (Calendar Year)

**Steps:**
1. Click "Create Fiscal Year"
2. Enter year: **2026**, start month: **January** (or equivalent parameters)
3. Submit

**Expected:**
- [ ] A fiscal year is created with name like "Fiscal Year 2026"
- [ ] **12 monthly periods** are auto-generated (January through December)
- [ ] Each period shows: name (e.g., "January 2026"), start date, end date
- [ ] All periods have status **OPEN**
- [ ] The fiscal year status is **OPEN**
- [ ] Start date = 2026-01-01, End date = 2026-12-31

---

### TC-03.3 — Create a Non-Calendar Fiscal Year (e.g., Apr–Mar)

**Steps:**
1. Create a fiscal year with start month = **April** for year 2026
2. Submit

**Expected:**
- [ ] Fiscal year spans April 2026 – March 2027
- [ ] 12 periods generated: April 2026, May 2026, ..., March 2027
- [ ] Start and end dates for each period are correct (e.g., April: 2026-04-01 to 2026-04-30)

---

### TC-03.4 — Prevent Duplicate Fiscal Years

**Steps:**
1. Try to create another fiscal year for the same year/start month that already exists
2. Submit

**Expected:**
- [ ] Error message: fiscal year already exists (or overlapping dates detected)
- [ ] Duplicate is not created

---

### TC-03.5 — Close a Monthly Period

**Steps:**
1. Select a fiscal year with OPEN periods
2. Close a specific period (e.g., January 2026) by clicking "Close Period"
3. Note the status change

**Expected:**
- [ ] Period status changes from **OPEN** → **CLOSED**
- [ ] The UI updates to show the CLOSED status (different color/badge)
- [ ] Other periods remain OPEN

---

### TC-03.6 — Posting to a Closed Period is Blocked

**Steps:**
1. After closing a period (e.g., January 2026)
2. Try to create and post a new voucher with a date **within the closed period** (e.g., 2026-01-15)

**Expected:**
- [ ] The voucher creation/posting is **blocked** with a clear error message
- [ ] Error mentions the period is closed (e.g., "Period 'January 2026' is CLOSED")
- [ ] Voucher for an OPEN period (e.g., February 2026) still works normally

---

### TC-03.7 — Reopen a Closed Period

**Steps:**
1. Select a CLOSED period
2. Click "Reopen Period"

**Expected:**
- [ ] Period status changes from **CLOSED** → **OPEN**
- [ ] You can now post vouchers to that period again
- [ ] An audit trail entry may be created (reopen event)

---

### TC-03.8 — Cannot Reopen a Locked Period

**Steps:**
1. If there is a LOCKED period (or if year-end close locks periods), try to reopen it

**Expected:**
- [ ] The reopen action is **disabled** or returns an error
- [ ] LOCKED periods cannot be reverted to OPEN

---

### TC-03.9 — Year-End Close

**Steps:**
1. Ensure you have Revenue accounts with credit balances and Expense accounts with debit balances
2. Note the total Revenue balance and total Expense balance
3. Manually calculate: Net Income = Revenue − Expenses
4. Initiate "Close Year" for the fiscal year
5. If prompted, select the **Retained Earnings account**
6. Confirm

**Expected:**
- [ ] A **closing journal entry** is auto-generated
- [ ] The closing JE debits all Revenue accounts (zeroing them)
- [ ] The closing JE credits all Expense accounts (zeroing them)
- [ ] The net difference goes to the **Retained Earnings** account
- [ ] The fiscal year status changes to **CLOSED**
- [ ] The closing voucher ID is stored on the fiscal year record
- [ ] After close, Revenue and Expense accounts for that year have **zero balance**

---

### TC-03.10 — Year-End Close Prerequisites

**Steps:**
1. Try to close a year with some periods still OPEN
2. Observe the response

**Expected:**
- [ ] Year-end close either requires all periods to be closed first, or automatically closes them
- [ ] A clear error message is shown if prerequisites are not met

---

### TC-03.11 — Verify Closing JE in Reports

**Steps:**
1. After year-end close, open the **General Ledger**
2. Filter to Revenue and Expense accounts
3. Open the **Balance Sheet** as of year-end date

**Expected:**
- [ ] The closing journal entry appears as the last entry for Revenue/Expense accounts
- [ ] Revenue and Expense accounts show zero net balance for the closed period
- [ ] The Balance Sheet shows the Retained Earnings amount updated

---

### TC-03.12 — Fiscal Year List View

**Steps:**
1. Navigate to Fiscal Years list
2. Observe multiple fiscal years (if you've created more than one)

**Expected:**
- [ ] Each fiscal year shows: name, date range, status (OPEN/CLOSED)
- [ ] Closed years are visually distinct from open years
- [ ] Period breakdown is visible (expandable or inline)

---

### TC-03.13 — Backward Compatibility

**Steps:**
1. Check vouchers that were posted **before** any fiscal year was created
2. Ensure they are still accessible and editable (if in DRAFT status)

**Expected:**
- [ ] Existing vouchers are unaffected by fiscal year creation
- [ ] No data migration errors or missing data
- [ ] Historical vouchers still appear in reports correctly

---

### TC-03.14 — Permission Check

**Steps:**
1. Log in as a user with only `accounting.settings.read` (not write)
2. Try to create or close a fiscal year/period

**Expected:**
- [ ] The user can **view** fiscal years but cannot create, close, or reopen
- [ ] Write actions are blocked with a permission error

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-03.1 | ⬜ | |
| TC-03.2 | ⬜ | |
| TC-03.3 | ⬜ | |
| TC-03.4 | ⬜ | |
| TC-03.5 | ⬜ | |
| TC-03.6 | ⬜ | |
| TC-03.7 | ⬜ | |
| TC-03.8 | ⬜ | |
| TC-03.9 | ⬜ | |
| TC-03.10 | ⬜ | |
| TC-03.11 | ⬜ | |
| TC-03.12 | ⬜ | |
| TC-03.13 | ⬜ | |
| TC-03.14 | ⬜ | |
