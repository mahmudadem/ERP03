# Manual Test — 01: Balance Sheet Report

## Feature Overview

**What it is:** The Balance Sheet (Statement of Financial Position) is the most critical financial statement. It presents a snapshot of the company's financial position at a specific point in time, showing what the company owns (Assets), owes (Liabilities), and the residual interest (Equity).

**How it works:**
- Reads all posted ledger entries up to the chosen "As of" date
- Groups accounts by their classification: ASSET, LIABILITY, EQUITY
- Computes Retained Earnings automatically (Revenue − Expenses) and adds it to the Equity section
- Displays a hierarchical tree (parent/child accounts) with totals per section
- Shows a "Balanced" / "Out of Balance" indicator comparing Total Assets vs Total L+E

**Workflow impact:**
- Auditors, regulators, and investors rely on this report as the first document
- It surfaces immediately if the accounting entries don't balance (double-entry integrity check)
- Retained Earnings line bridges the P&L to the Balance Sheet — without it, Equity would be understated

**Benefits:**
- Instant visibility into the company's financial health
- Automatic Retained Earnings calculation before year-end close
- Export to Excel/PDF for external reporting
- Print-friendly layout for physical filing

---

## Prerequisites

Before running these tests, ensure:
- [ ] You have at least **one company** with accounting initialized
- [ ] The company has a **Chart of Accounts** with accounts in all 5 classifications: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- [ ] There are at least **3-5 posted vouchers** creating ledger entries across different account types
- [ ] Your user has the `accounting.reports.balanceSheet.view` permission

---

## Test Cases

### TC-01.1 — Basic Page Load and Navigation

**Steps:**
1. Log in and navigate to the Accounting module
2. Go to **Reports → Balance Sheet** (or use the sidebar link)
3. Wait for the page to load

**Expected:**
- [ ] Page title shows "Balance Sheet"
- [ ] Subtitle shows "Statement of Financial Position — As of [today's date]"
- [ ] Three sections are visible: **Assets**, **Liabilities**, **Equity**
- [ ] A date picker is visible with today's date pre-filled
- [ ] Buttons visible: **Refresh**, **Print**, **Export Excel**, **Export PDF**
- [ ] The page loaded data automatically (no need to click Refresh)

---

### TC-01.2 — Three Sections Display Correct Accounts

**Steps:**
1. Open the Balance Sheet page
2. Examine each section and cross-reference with your Chart of Accounts

**Expected:**
- [ ] **Assets** section contains ONLY accounts with classification = `ASSET`
- [ ] **Liabilities** section contains ONLY accounts with classification = `LIABILITY`
- [ ] **Equity** section contains ONLY accounts with classification = `EQUITY`
- [ ] **No REVENUE or EXPENSE accounts** appear in any section
- [ ] If there are no accounts for a section, it shows "No accounts for this section"

---

### TC-01.3 — Retained Earnings Auto-Computation

**Steps:**
1. Note the current Revenue and Expense account balances (check Trial Balance or General Ledger)
2. Manually calculate: Retained Earnings = Total Revenue credits − Total Expense debits
3. Open the Balance Sheet
4. Look in the **Equity** section for a "Retained Earnings" line

**Expected:**
- [ ] A **Retained Earnings** line appears in the Equity section
- [ ] Its value matches your manual calculation: Revenue net − Expense net
- [ ] If no Revenue/Expense transactions exist, Retained Earnings = 0

**Edge case:** If you have a net loss (Expenses > Revenue), Retained Earnings should be negative.

---

### TC-01.4 — Account Tree Hierarchy (Parent/Child)

**Steps:**
1. Ensure your COA has at least one **parent account** with child accounts (e.g., "Current Assets" parent → "Cash", "Bank" children)
2. Open the Balance Sheet

**Expected:**
- [ ] Parent accounts show with a **chevron icon** (▶ or ▼)
- [ ] Child accounts are **indented** under their parent
- [ ] Click the chevron on a parent → children **collapse** (hidden)
- [ ] Click again → children **expand** (visible again)
- [ ] Parent accounts without any children show a **bullet dot** instead of a chevron

---

### TC-01.5 — Nested Hierarchy Collapse (Multi-Level)

**Steps:**
1. If you have a 3-level hierarchy (Grandparent → Parent → Child), test this
2. Collapse the Grandparent account
3. Expand the Grandparent
4. Collapse the Parent

**Expected:**
- [ ] Collapsing Grandparent hides **all descendants** (Parent + Child)
- [ ] Expanding Grandparent shows Parent (and Child, unless Parent was separately collapsed)
- [ ] Each level's collapse state is independent

---

### TC-01.6 — Balanced / Unbalanced Indicator

**Steps:**
1. Open the Balance Sheet with normal data (properly entered double-entry vouchers)
2. Check the footer area showing Total Assets and Total Liabilities + Equity

**Expected (balanced case):**
- [ ] Green badge shows **"Balanced"** with a checkmark icon
- [ ] Total Assets = Total Liabilities + Equity (within rounding tolerance of 0.01)
- [ ] Base Currency label is displayed

**Expected (unbalanced case — if applicable):**
- [ ] Amber/yellow badge shows **"Out of Balance"** with a warning icon
- [ ] Message shows the difference amount and direction (e.g., "Out of balance by 100.00 USD (Assets higher)")

---

### TC-01.7 — "As of Date" Filter

**Steps:**
1. Open the Balance Sheet (default: today)
2. Note the totals
3. Change the date to a **past date** (e.g., 3 months ago)
4. Observe if numbers change
5. Change to a **very old date** (before any transactions existed)
6. Change to a **future date**

**Expected:**
- [ ] Changing date immediately triggers a data refresh (no need to click Refresh)
- [ ] Past date: totals reflect only transactions posted on or before that date
- [ ] Very old date (no transactions): all accounts show 0 balance, or sections show "No accounts"
- [ ] Future date: totals should be same as today (since future transactions don't exist yet)
- [ ] The subtitle updates to show the selected date

---

### TC-01.8 — Refresh Button

**Steps:**
1. Open the Balance Sheet
2. Post a new voucher in another tab/window
3. Return to the Balance Sheet and click **Refresh**

**Expected:**
- [ ] The refresh icon **spins** while loading
- [ ] Data updates to reflect the newly posted voucher
- [ ] Tree collapse state **resets** (all sections expanded again)

---

### TC-01.9 — Export to Excel

**Steps:**
1. Open the Balance Sheet with data
2. Click **Export Excel**

**Expected:**
- [ ] An `.xlsx` file downloads with filename `Balance-Sheet-YYYY-MM-DD.xlsx`
- [ ] Open the file and verify it contains columns: Section, Code, Account, Balance
- [ ] Data is grouped by Assets/Liabilities/Equity with section totals
- [ ] All account balances match what's shown on screen
- [ ] Numeric values are formatted as numbers (not text)

---

### TC-01.10 — Export to PDF

**Steps:**
1. Open the Balance Sheet with data
2. Click **Export PDF**

**Expected:**
- [ ] A PDF file downloads
- [ ] The PDF contains the Balance Sheet layout readable and clean
- [ ] Sections, account names, codes, and balances are visible
- [ ] The report title and date are shown in the PDF

---

### TC-01.11 — Print Layout

**Steps:**
1. Open the Balance Sheet with data
2. Click **Print**
3. In the print dialog, check the preview

**Expected:**
- [ ] The toolbar/buttons are **hidden** in print mode
- [ ] A clean print-specific header shows the title and date
- [ ] The three-column grid renders properly on paper
- [ ] All accounts and totals are visible and legible

---

### TC-01.12 — Negative Balances

**Steps:**
1. Ensure at least one account has a negative net balance (e.g., an Asset account with more credits than debits — like an overdrawn bank account)
2. Open the Balance Sheet

**Expected:**
- [ ] Negative amounts are displayed in **red text**
- [ ] Positive amounts are in normal text color
- [ ] Negative values still show correct sign (with minus prefix)

---

### TC-01.13 — Empty Company (No Transactions)

**Steps:**
1. Switch to a company that has accounting initialized but **no posted vouchers**
2. Open the Balance Sheet

**Expected:**
- [ ] Page loads without errors
- [ ] All three sections show "No accounts for this section" or show accounts with 0 balance
- [ ] Totals area shows 0 for both sides
- [ ] "Balanced" indicator shows (since 0 = 0)
- [ ] Export/Print buttons still function without crashing

---

### TC-01.14 — Multi-Currency Company

**Steps:**
1. If your company has multi-currency enabled (transactions in USD, EUR, etc.)
2. Open the Balance Sheet

**Expected:**
- [ ] All amounts are displayed in the **base currency** (converted)
- [ ] The badge shows "Base Currency: [XYZ]"
- [ ] Totals match the Trial Balance when viewed in base currency

---

### TC-01.15 — Permission Check

**Steps:**
1. Log in as a user who does **NOT** have `accounting.reports.balanceSheet.view` permission
2. Try to navigate to the Balance Sheet page

**Expected:**
- [ ] The page is either **not accessible** (redirected or blocked) or
- [ ] The API returns an error and the page shows an error message
- [ ] The sidebar menu should ideally **not show** the Balance Sheet link for this user

---

### TC-01.16 — Large Dataset Performance

**Steps:**
1. If possible, test with a company that has **100+ accounts** and **1000+ posted vouchers**
2. Open the Balance Sheet

**Expected:**
- [ ] Page loads within a reasonable time (under 5 seconds)
- [ ] Scrolling through accounts is smooth
- [ ] Collapse/expand is instant
- [ ] No browser freezing or memory issues

---

### TC-01.17 — Consistency with Trial Balance

**Steps:**
1. Open the **Trial Balance** report and note the totals per account
2. Open the **Balance Sheet** at the same date
3. Cross-reference

**Expected:**
- [ ] Every ASSET account's balance in the BS matches its Trial Balance net balance
- [ ] Every LIABILITY account's balance in the BS matches its Trial Balance net balance
- [ ] Every EQUITY account's balance in the BS matches its Trial Balance net balance
- [ ] Retained Earnings = sum of all REVENUE accounts' net − sum of all EXPENSE accounts' net from the TB

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-01.1 | ⬜ | |
| TC-01.2 | ⬜ | |
| TC-01.3 | ⬜ | |
| TC-01.4 | ⬜ | |
| TC-01.5 | ⬜ | |
| TC-01.6 | ⬜ | |
| TC-01.7 | ⬜ | |
| TC-01.8 | ⬜ | |
| TC-01.9 | ⬜ | |
| TC-01.10 | ⬜ | |
| TC-01.11 | ⬜ | |
| TC-01.12 | ⬜ | |
| TC-01.13 | ⬜ | |
| TC-01.14 | ⬜ | |
| TC-01.15 | ⬜ | |
| TC-01.16 | ⬜ | |
| TC-01.17 | ⬜ | |
