# Manual Test — 06: Cash Flow Statement

## Feature Overview

**What it is:** The Cash Flow Statement is the third mandatory financial statement (alongside Balance Sheet and P&L). It shows how cash moves in and out of the business, categorized into Operating, Investing, and Financing activities.

**How it works:**
- Uses the **Indirect Method**: starts with Net Income from P&L, then adjusts for non-cash items and working capital changes
- Automatically categorizes account changes based on account classification (ASSET → Investing, LIABILITY → Operating/Financing, etc.)
- Shows opening cash balance, net change, and closing cash balance — which must reconcile
- Date range filter to generate for any period

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
  - Revenue/Expense vouchers (Operating)
  - Fixed asset purchases (Investing — if applicable)
  - Loan/equity transactions (Financing — if applicable)
- [ ] Cash/bank accounts with transactions
- [ ] Permission `accounting.reports.cashFlow.view`

---

## Test Cases

### TC-06.1 — Basic Page Load

**Steps:**
1. Navigate to **Accounting → Reports → Cash Flow**
2. Observe the page layout

**Expected:**
- [ ] Page title shows "Cash Flow Statement"
- [ ] Date range inputs (From / To) are visible
- [ ] Three sections are visible: **Operating**, **Investing**, **Financing**
- [ ] Net Income is shown at the top
- [ ] Net Change in Cash, Opening Balance, and Closing Balance are shown at the bottom

---

### TC-06.2 — Net Income Matches P&L

**Steps:**
1. Set the date range to match a period where you know the P&L
2. Open the P&L report for the same period and note the Net Income
3. Compare with the Cash Flow's Net Income line

**Expected:**
- [ ] Net Income on Cash Flow matches Net Income on P&L for the same period

---

### TC-06.3 — Operating Activities Section

**Steps:**
1. Review the Operating Activities section

**Expected:**
- [ ] Contains adjustments for non-cash items (depreciation if applicable)
- [ ] Shows working capital changes:
  - Changes in Accounts Receivable (increase = cash used, decrease = cash gained)
  - Changes in Accounts Payable (increase = cash gained, decrease = cash used)
  - Changes in Inventory (if applicable)
- [ ] Operating section total = Net Income + adjustments + working capital changes

---

### TC-06.4 — Investing Activities Section

**Steps:**
1. Review the Investing section (may be empty if no fixed asset transactions)

**Expected:**
- [ ] Shows changes in fixed assets, long-term investments
- [ ] Asset purchases show as negative (cash outflow)
- [ ] Asset sales show as positive (cash inflow)
- [ ] If no investing transactions, section shows 0 total or "No items"

---

### TC-06.5 — Financing Activities Section

**Steps:**
1. Review the Financing section

**Expected:**
- [ ] Shows changes in loans, equity (capital contributions, dividends)
- [ ] Loan proceeds show as positive (cash inflow)
- [ ] Loan repayments show as negative (cash outflow)
- [ ] If no financing transactions, section shows 0 total

---

### TC-06.6 — Cash Reconciliation

**Steps:**
1. Look at the footer/summary area
2. Verify: Opening Cash Balance + Net Change in Cash = Closing Cash Balance

**Expected:**
- [ ] Opening Cash Balance = cash/bank account balances at start of period
- [ ] Net Change in Cash = Operating + Investing + Financing totals
- [ ] Closing Cash Balance = Opening + Net Change
- [ ] Closing Balance matches cash/bank account balances from the Balance Sheet at end of period

---

### TC-06.7 — Date Range Filter

**Steps:**
1. Change the date range to a narrow period (e.g., one month)
2. Note the values
3. Widen the range to 6 months
4. Compare

**Expected:**
- [ ] Values change based on date range
- [ ] A wider range includes more transactions and potentially different net cash change

---

### TC-06.8 — Empty Period (No Transactions)

**Steps:**
1. Set a date range where no transactions exist (e.g., future dates)

**Expected:**
- [ ] Page loads without errors
- [ ] Net Income = 0
- [ ] All sections show 0 or empty
- [ ] Cash balances still show the carry-forward amounts

---

### TC-06.9 — Print/Export

**Steps:**
1. Load the Cash Flow with data
2. Click Print (or Export if available)

**Expected:**
- [ ] Print layout is clean and professional
- [ ] All three sections and the reconciliation footer are visible
- [ ] Numbers are properly formatted

---

### TC-06.10 — Cross-Validation with Balance Sheet

**Steps:**
1. Generate Cash Flow for a period ending at date X
2. Open Balance Sheet as of date X
3. Sum all cash/bank account balances from the BS

**Expected:**
- [ ] Cash Flow's Closing Cash Balance matches the BS's total cash/bank accounts

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
