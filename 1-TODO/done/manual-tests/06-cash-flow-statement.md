# Manual Test — 06: Cash Flow Statement

## Feature Overview

**What it is:** The Cash Flow Statement is the third mandatory financial statement (alongside Balance Sheet and P&L). It shows how cash moves in and out of the business, categorized into Operating, Investing, and Financing activities.

**How it works:**
- Uses the **Indirect Method**: starts with Net Income from P&L, then adjusts for non-cash items and working capital changes
- Automatically categorizes account changes using account classification + name/code heuristics
- Supports explicit account override via `cashFlowCategory` on Chart of Accounts
- Shows opening cash balance, net change, and closing cash balance — which must reconcile
- Date range filter with Apply action

**Workflow impact:**
- Enables cash flow analysis which is critical for business health assessment
- Completes the trio of mandatory financial statements (Balance Sheet, P&L, Cash Flow)
- Investors and banks always request this alongside the Balance Sheet

**Benefits:**
- Auto-generated from existing ledger data — no extra data entry
- Tells the story of where the cash went (operations, investments, financing)
- Net Change reconciliation provides data integrity check

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] **Multiple types of transactions** for comprehensive testing:
  - Revenue/Expense vouchers
  - Working capital movement (AR/AP/inventory where available)
  - Fixed asset or long-term asset movement (for Investing)
  - Loan/equity movement (for Financing)
- [ ] Cash/bank accounts with transactions
- [ ] At least one account editable from Chart of Accounts to test `cashFlowCategory` override
- [ ] Permission `accounting.reports.cashFlow.view`

---

## Test Cases

### TC-06.1 — Sidebar Navigation and Route Access

**Steps:**
1. Navigate to **Accounting → Reports → Cash Flow**
2. Confirm URL path is `/accounting/reports/cash-flow`
3. Hard refresh and open directly via URL

**Expected:**
- [ ] Sidebar contains **Cash Flow** under Reports
- [ ] Route opens successfully from sidebar and direct URL
- [ ] No 404 / permission error for authorized user

---

### TC-06.2 — Basic Page Layout and Defaults

**Steps:**
1. Open Cash Flow page
2. Observe initial layout before and after loading

**Expected:**
- [ ] Page title is visible
- [ ] Date range inputs (`from`, `to`) and **Apply** button are visible
- [ ] KPI cards are shown for Net Income, Opening Cash, Closing Cash
- [ ] Three sections are shown: Operating, Investing, Financing
- [ ] Net Change in Cash row is visible
- [ ] No UI crash when sections have zero items

---

### TC-06.3 — Date Range Filter Behavior

**Steps:**
1. Set a narrow range (example: one month) and click **Apply**
2. Note values
3. Set wider range (example: six months) and click **Apply**

**Expected:**
- [ ] Values update after Apply click
- [ ] Wider range includes more data and can change all section totals
- [ ] Period label reflects selected dates

---

### TC-06.4 — Net Income Matches P&L

**Steps:**
1. Set the date range to match a period where you know the P&L
2. Open the P&L report for the same period and note the Net Income
3. Compare with the Cash Flow's Net Income line

**Expected:**
- [ ] Net Income on Cash Flow matches Net Income on P&L for the same period

---

### TC-06.5 — Operating Section Semantics

**Steps:**
1. Review the Operating Activities section

**Expected:**
- [ ] Includes `Net Income` item
- [ ] Includes `Working Capital Changes` item when applicable
- [ ] Includes `Non-Cash Adjustments` when depreciation/amortization-like accounts exist
- [ ] May include `Other Operating Movements` for reconciliation balancing
- [ ] Operating total is numeric and consistent with section items

---

### TC-06.6 — Investing Section Semantics

**Steps:**
1. Review Investing section for period with long-term asset movement

**Expected:**
- [ ] Section shows account-level items for investing accounts
- [ ] Asset increase appears as cash outflow (negative)
- [ ] Asset decrease appears as cash inflow (positive)
- [ ] If none, section total is `0` and list can be empty

---

### TC-06.7 — Financing Section Semantics

**Steps:**
1. Review Financing section for period with loan/equity movement

**Expected:**
- [ ] Section shows account-level items for financing accounts
- [ ] Loan/liability increase appears as cash inflow (positive)
- [ ] Loan/liability decrease appears as cash outflow (negative)
- [ ] If none, section total is `0`

---

### TC-06.8 — Reconciliation Integrity

**Steps:**
1. Record Operating, Investing, Financing totals
2. Record Opening Cash, Net Change, Closing Cash
3. Verify both reconciliation equations

**Expected:**
- [ ] `Operating + Investing + Financing = Net Change in Cash`
- [ ] `Opening Cash + Net Change in Cash = Closing Cash`

---

### TC-06.9 — Cross-Validation with Balance Sheet

**Steps:**
1. Generate Cash Flow for period ending on date `X`
2. Open Balance Sheet as-of date `X`
3. Sum balances of cash/bank accounts

**Expected:**
- [ ] Cash Flow Closing Cash equals Balance Sheet cash/bank total

---

### TC-06.10 — `cashFlowCategory` Override (Critical)

**Steps:**
1. Open **Chart of Accounts**
2. Edit an account that normally appears in Operating by heuristic
3. Set **Cash Flow Category = INVESTING** (or FINANCING), save
4. Reload Cash Flow for a period where this account changed

**Expected:**
- [ ] Account appears under the explicit section you set
- [ ] Section totals update accordingly
- [ ] Reconciliation equations remain valid

---

### TC-06.11 — Empty/Low-Activity Period

**Steps:**
1. Set a date range where there is no movement (or near-zero movement)

**Expected:**
- [ ] Page loads without errors
- [ ] Sections can be empty with zero totals
- [ ] Net change should be 0 when no movement exists
- [ ] Opening/Closing cash still display valid values

---

### TC-06.12 — Permission Guard

**Steps:**
1. Test with a user missing `accounting.reports.cashFlow.view`
2. Try opening Cash Flow via sidebar and direct URL

**Expected:**
- [ ] Access is blocked (no unauthorized data leak)
- [ ] Sidebar item is hidden/blocked based on permission model

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-06.1 | ⬜ | |
| TC-06.2 | ⬜ | |
| TC-06.3 | ⬜ | |
| TC-06.4 | ⬜ | |
| TC-06.5 | ⬜ | |
| TC-06.6 | ⬜ | |
| TC-06.7 | ⬜ | |
| TC-06.8 | ⬜ | |
| TC-06.9 | ⬜ | |
| TC-06.10 | ⬜ | |
| TC-06.11 | ⬜ | |
| TC-06.12 | ⬜ | |
