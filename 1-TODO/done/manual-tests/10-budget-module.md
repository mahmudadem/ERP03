# Manual Test — 10: Budget Module

## Feature Overview

**What it is:** The Budget Module enables financial planning by defining revenue and expense targets per account per fiscal year, with monthly breakdowns. Managers can compare actual performance against the budget in real-time to track variance and spending.

**How it works:**
- Admin creates a budget linked to a fiscal year
- Budget lines define monthly amounts per account (optionally per cost center)
- "Budget vs Actual" report compares budgeted amounts against actual ledger data
- Status workflow: DRAFT → APPROVED → CLOSED

**Workflow impact:**
- Department heads submit budget proposals; management approves
- Finance team monitors spending against approved budgets
- Alerts or visual indicators when actuals exceed budget thresholds

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] At least one fiscal year defined (Plan 03)
- [ ] Revenue and Expense accounts with posted transactions
- [ ] (Optional) Cost centers enabled for departmental budgeting

---

## Test Cases

### TC-10.1 — Access Budget Management

**Steps:**
1. Navigate to **Accounting → Budgets**

**Expected:**
- [ ] Budget list page loads
- [ ] Option to create a new budget
- [ ] Existing budgets (if any) are listed with fiscal year, name, version, status

---

### TC-10.2 — Create a New Budget

**Steps:**
1. Click "Create Budget"
2. Select a fiscal year (e.g., FY2026)
3. Enter name: "FY2026 Annual Budget"
4. Save

**Expected:**
- [ ] Budget is created with status **DRAFT**
- [ ] A budget editor opens (spreadsheet-like grid or form)
- [ ] Accounts are listed (at least expense accounts)

---

### TC-10.3 — Enter Monthly Budget Amounts

**Steps:**
1. Open the budget editor
2. For an expense account (e.g., "Rent Expense"), enter monthly amounts: 2000 × 12
3. For a revenue account (e.g., "Sales Revenue"), enter monthly amounts: 10000 × 12
4. Save

**Expected:**
- [ ] Monthly values are saved for each account
- [ ] **Annual total** is auto-computed (e.g., 24,000 for rent, 120,000 for sales)
- [ ] The grid is navigable (tab between cells, keyboard-friendly)

---

### TC-10.4 — Annual Distribution Entry

**Steps:**
1. If available, use the "Annual" entry method
2. Enter an annual total (e.g., 12,000)
3. Confirm auto-distribution

**Expected:**
- [ ] The annual amount is evenly distributed across 12 months (e.g., 1,000/month)
- [ ] Monthly amounts update automatically

---

### TC-10.5 — Approve a Budget

**Steps:**
1. From the budget list, select a DRAFT budget
2. Click "Approve"

**Expected:**
- [ ] Budget status changes to **APPROVED**
- [ ] The budget is now the active reference for Budget vs Actual comparisons
- [ ] Editing may be restricted after approval (or a new version is required)

---

### TC-10.6 — Budget vs Actual Report

**Steps:**
1. Navigate to **Reports → Budget vs Actual**
2. Select the approved budget
3. Set a period (e.g., current month or year-to-date)

**Expected:**
- [ ] Table shows columns: **Account | Budget | Actual | Variance | Variance %**
- [ ] Budget column reflects the approved budget amounts for the period
- [ ] Actual column shows real ledger data
- [ ] Variance = Budget − Actual (positive = under budget, negative = over budget)
- [ ] Variance % = (Variance / Budget) × 100

---

### TC-10.7 — Over/Under Budget Indicators

**Steps:**
1. In the Budget vs Actual report, look for accounts that are over budget

**Expected:**
- [ ] Over-budget accounts are highlighted in **red**
- [ ] Under-budget accounts are highlighted in **green**
- [ ] Visual distinction is clear and intuitive

---

### TC-10.8 — Monthly Breakdown Toggle

**Steps:**
1. In the Budget vs Actual report, toggle the monthly breakdown view (if available)

**Expected:**
- [ ] Expanded view shows month-by-month comparison
- [ ] Each month shows Budget, Actual, Variance separately
- [ ] Totals at the bottom match the summary

---

### TC-10.9 — Budget Versions

**Steps:**
1. Create a revised budget for the same fiscal year
2. Compare with the original

**Expected:**
- [ ] Multiple budget versions can coexist for the same fiscal year
- [ ] Each version is labeled (version 1, 2, etc.)
- [ ] Latest approved version is marked as the default active reference for reporting

---

### TC-10.10 — Empty Budget (No Actuals)

**Steps:**
1. Create a budget for a fiscal year with no transactions yet

**Expected:**
- [ ] Budget amounts show correctly
- [ ] Actual column shows 0 for all accounts
- [ ] Variance = full budget amount (100% under budget)

---

### TC-10.11 — Cost Center Budgeting (If Enabled)

**Steps:**
1. If cost centers are available, create a budget with cost center breakdown

**Expected:**
- [ ] Budget lines can be tagged per cost center
- [ ] Budget vs Actual can be filtered by cost center

---

### TC-10.12 — Permission Check

**Steps:**
1. Log in as a user without budget write permissions
2. Try to create or modify a budget

**Expected:**
- [ ] User can view budgets and reports but cannot create or edit

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-10.1 | ✅ | Sidebar now includes **Budgets** under Accounting, and route `/accounting/budgets` remains accessible directly. |
| TC-10.2 | ✅ | Create flow implemented: fiscal year selector, name/version inputs, create/save handler, editor stays open after save. |
| TC-10.3 | ✅ | Monthly line entry, annual total auto-sum, and per-cell numeric editing are implemented in budget grid. |
| TC-10.4 | ✅ | Annual auto-distribute implemented (`distributeAnnualEvenly`) with final-month rounding adjustment. |
| TC-10.5 | ✅ | Approve action implemented; approved budgets become read-only in editor and revision flow is provided. |
| TC-10.6 | ✅ | Sidebar now includes **Reports → Budget vs Actual**; report renders expected columns and period-driven values. |
| TC-10.7 | ✅ | Over/under indicators implemented via variance color class (`red` for negative variance, `green` for positive). |
| TC-10.8 | ✅ | Monthly breakdown toggle implemented with month-wise Budget/Actual/Variance and totals footer. |
| TC-10.9 | ✅ | Version coexistence supported; latest approved per fiscal year is marked as active/default in budget list logic. |
| TC-10.10 | ⚠️ | Logic supports no-actuals scenario (actuals default to 0); needs live-data manual run to confirm full UX wording/output. |
| TC-10.11 | ✅ | Cost center tagging exists per budget line and report supports optional cost center filter. |
| TC-10.12 | ✅ | Permission model enforced: backend write guards on create/update/approve and frontend read-only behavior when write permission is missing. |

---

## Retest Focus (2026-02-24)

Use this quick pass after UI updates before full regression:

- [ ] Budget editor uses **selectors** (fiscal year, account, cost center) instead of free-text IDs
- [ ] Annual entry in a row auto-distributes evenly into the 12 monthly cells
- [ ] Approved budgets are read-only in editor; **Create Revision** creates editable next version
- [ ] Budget vs Actual uses **Variance = Budget - Actual**
- [ ] Over budget (negative variance) shows **red**, under budget (positive variance) shows **green**
- [ ] Budget vs Actual supports **date range** and respects selected period totals
- [ ] Budget vs Actual supports optional **cost center filter**
- [ ] Monthly breakdown toggle shows month-wise Budget/Actual/Variance with totals matching summary
- [ ] Users without `accounting.settings.write` can view but cannot create/edit/approve budgets

---

## Assisted Verification Notes (2026-02-25)

- Frontend verification command: `npm run build` (in `frontend`) -> PASSED
- Backend targeted budget test command: `npm test -- GetBudgetVsActualUseCase` (in `backend`) -> PASSED
