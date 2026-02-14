# Manual Test — 16: Trial Balance Report

## Feature Overview

**What it is:** The Trial Balance is the foundational accounting report that lists all accounts with their closing debit and credit balances as of a specific date. It verifies the double-entry bookkeeping invariant: total debits must equal total credits.

**How it works:**
- Reads all **posted** General Ledger entries up to the chosen "As of" date
- Groups accounts by classification: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE with subtotals
- Displays a hierarchical tree (parent/child accounts) with roll-up totals for group accounts
- Shows a "Balanced" / "Unbalanced" indicator comparing Grand Total Debit vs Grand Total Credit
- Report does NOT auto-generate on page load — user must click "Generate Report"

**Workflow impact:**
- This is the first report auditors check to verify that books are in balance
- It bridges all other reports — Trial Balance totals must be consistent with Balance Sheet and P&L
- Parent (HEADER) accounts are non-postable and show rolled-up balances from their children

**Benefits:**
- Instant double-entry integrity check
- Hierarchical COA view with expand/collapse
- Drill-down: click any account → navigate to Account Statement
- As-of-date filtering for point-in-time snapshots
- Export to Excel/PDF for external reporting

---

## Prerequisites

Before running these tests, ensure:
- [ ] You have at least **one company** with accounting initialized
- [ ] The company has a **Chart of Accounts** with accounts in all 5 classifications: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- [ ] There are at least **3-5 posted vouchers** creating ledger entries across different account types
- [ ] Your COA has **at least one parent (GROUP/HEADER) account** with child accounts under it
- [ ] Your user has the `accounting.reports.trialBalance.view` permission

---

## Test Cases

### TC-16.1 — Page Load: No Auto-Generate

**Steps:**
1. Navigate to **Reports → Trial Balance**
2. Observe the initial page state

**Expected:**
- [x] Page title shows "Trial Balance" (localized)
- [x] The **Parameters toolbar** is visible and expanded by default
- [x] "As of Date" field is pre-filled with today's company date
- [x] "Include Zero Balances" checkbox is unchecked
- [x] "Generate Report" button is visible
- [x] The table area shows a **placeholder icon** with message "Select parameters and click Generate Report"
- [x] **No API call is made** — the report does NOT auto-load

---

### TC-16.2 — Generate Report: Basic Data

**Steps:**
1. Click **Generate Report** with default parameters
2. Wait for the report to load

**Expected:**
- [x] A loading spinner appears while data is being fetched
- [x] Once loaded, the table displays accounts grouped by classification sections
- [x] Section headers appear in this order: **Assets, Liabilities, Equity, Revenue, Expenses**
- [x] Each section has a **subtotal row** at the bottom (e.g., "Total Assets")
- [x] A **Grand Total** row appears in the sticky footer
- [x] The **Balanced / Unbalanced** badge is shown in the footer
- [x] The "As of" date is shown in the footer

---

### TC-16.3 — Classification Grouping and Subtotals

**Steps:**
1. Generate the Trial Balance
2. Verify each classification section

**Expected:**
- [x] **Assets** section contains ONLY accounts with classification = `ASSET`
- [x] **Liabilities** section contains ONLY accounts with classification = `LIABILITY`
- [x] **Equity** section contains ONLY accounts with classification = `EQUITY`
- [x] **Revenue** section contains ONLY accounts with classification = `REVENUE`
- [x] **Expenses** section contains ONLY accounts with classification = `EXPENSE`
- [x] Each section's subtotal matches the sum of closing debits/credits within that section
- [x] Sections with no accounts are not shown

---

### TC-16.4 — Closing Column Math

**Steps:**
1. Pick any account in the TB and note its Closing Debit and Closing Credit values
2. Cross-reference with the General Ledger for that account
3. Manually calculate: totalDebit = sum of all debit entries, totalCredit = sum of all credit entries

**Expected:**
- [?] `Closing Debit = max(0, totalDebit − totalCredit)` — only non-zero if debits exceed credits
- [?] `Closing Credit = max(0, totalCredit − totalDebit)` — only non-zero if credits exceed debits
- [?] An account can NEVER have both Closing Debit AND Closing Credit as non-zero simultaneously
- [x] Accounts with zero closing balance show `-` instead of `0.00`

---

### TC-16.5 — Double-Entry Invariant (Grand Totals)

**Steps:**
1. Generate the Trial Balance
2. Check the Grand Total row in the sticky footer

**Expected:**
- [x] **Grand Total Closing Debit = Grand Total Closing Credit** (within rounding tolerance of 0.01)
- [x] Green **"Balanced"** badge appears with a checkmark icon
- [not tested] If there is a difference (data issue), a red **"Unbalanced"** badge appears showing the difference amount

---

### TC-16.6 — Hierarchy: Parent/Group Accounts

**Steps:**
1. Generate the TB (ensure your COA has parent accounts with children)
2. Examine the hierarchy display

**Expected:**
- [x] Parent (HEADER/GROUP) accounts appear in the list with a **chevron icon** (▶) to the left of the name
- [x] Parent accounts show a **"GROUP"** badge next to their name
- [x] Parent accounts display **rolled-up totals** (sum of all descendants' closing debits/credits) — shown in bold
- [x] Child accounts are **indented** under their parent
- [x] Leaf accounts (no children) have no chevron, just a spacer
- [x] **"Hierarchy: Expand All | Collapse All"** controls appear above the table

---

### TC-16.7 — Hierarchy: Expand / Collapse

**Steps:**
1. After generating the report, observe that root-level parents are **auto-expanded**
2. Click the chevron on a parent account to **collapse** it
3. Click again to **expand** it
4. Click **Collapse All**
5. Click **Expand All**

**Expected:**
- [x] Initially, root-level parent accounts are expanded (children visible)
- [x] Collapsing a parent hides all its direct children
- [x] If a child is also a parent, collapsing the grandparent hides the entire subtree
- [x] "Collapse All" hides all children at every level
- [x] "Expand All" reveals all children at every level
- [x] **Rolled-up totals on parents remain correct regardless of expand/collapse state**

---

### TC-16.8 — Hierarchy: Multi-Level Nesting

**Steps:**
1. If your COA has 3+ levels (e.g., "Current Assets" → "Cash & Bank" → "Cash in Hand"), test this
2. Generate the TB and examine indentation

**Expected:**
- [x] Each level is **progressively indented** (deeper = more indent)
- [x] Account codes are also indented to match
- [x] Rolled-up totals at each level aggregate correctly from all descendants
- [x] Expand/collapse at each level is independent

---

### TC-16.9 — Drill-Down: Navigate to Account Statement

**Steps:**
1. Generate the Trial Balance
2. **Hover** over an account name — observe cursor change
3. **Click** on any account name

**Expected:**
- [x] Account names are styled as **clickable links** (underline on hover, color change)
- [x] Hovering shows a tooltip: "View Account Statement for [code] — [name]"
- [x] Clicking navigates to the **Account Statement** page
- [x] The account is **pre-selected** in the Account Statement's account selector
- [x] The Account Statement auto-loads data for that account

---

### TC-16.10 — "As of Date" Filtering

**Steps:**
1. Generate the TB with today's date and note the totals
2. Change the date to a **past date** (e.g., before some vouchers were posted) and click Generate
3. Change to a **very old date** (before any transactions) and click Generate
4. Change to a **future date** and click Generate

**Expected:**
- [x] Past date: totals reflect only posted ledger entries on or before that date
- [x] Very old date (no transactions): shows empty report or placeholder message
- [x] Future date: same as today (no future entries exist)
- [x] Each Generate fetches fresh data — changing the date alone does NOT refresh automatically

---

### TC-16.11 — Include Zero Balances Toggle

**Steps:**
1. Generate TB with "Include Zero Balances" **unchecked** — note the account count
2. Check the "Include Zero Balances" checkbox and click **Generate** again

**Expected:**
- [x] With zero balances **excluded**: only accounts with non-zero closing balance appear (plus their parent hierarchy)
- [x] With zero balances **included**: all accounts from the COA appear, even those with `-` in both columns
- [x] Subtotals and Grand Totals **remain the same** regardless of this toggle (zero accounts don't change sums)

---

### TC-16.12 — Sticky Header and Footer

**Steps:**
1. Generate the TB with enough accounts to cause vertical scrolling
2. Scroll down through the table body

**Expected:**
- [x] The **column headers** (Code, Account Name, Closing Debit, Closing Credit) remain **pinned at the top**
- [x] The **Grand Total footer** (totals + balanced badge) remains **pinned at the bottom**
- [x] Only the **table body** scrolls between header and footer
- [x] No visual overlap or flickering during scroll

---

### TC-16.13 — Parameters Toolbar Collapse

**Steps:**
1. Click the **Parameters toolbar** header to collapse it
2. Click again to expand it

**Expected:**
- [x] Clicking the header toggles the toolbar open/closed
- [x] A chevron icon **rotates** on toggle
- [x] When collapsed, only the header bar is visible (date picker and checkbox hidden)
- [x] Useful for reclaiming vertical space after setting parameters

---

### TC-16.14 — Export to Excel

**Steps:**
1. Generate the TB with data
2. Click **Export Excel**

**Expected:**
- [x] An `.xlsx` file downloads with filename `Trial-Balance-YYYY-MM-DD.xlsx`
- [x] File contains columns: Code, Account Name, Classification, Closing Debit, Closing Credit, Debit, Credit, Net Balance
- [x] All account balances match what's shown on screen
- [x] Numeric values are formatted as numbers (not text)

---

### TC-16.15 — Export to PDF / Print

**Steps:**
1. Generate the TB with data
2. Click **Export PDF** and check the output
3. Click **Print** and check the print preview

**Expected:**
- [?] PDF: report is cleanly rendered with title and date
- [x] Print preview: toolbar/buttons are **hidden**; clean print header shows title + "As of" date
- [x] All accounts, subtotals, and grand totals are visible and legible

---

### TC-16.16 — Consistency with Balance Sheet

**Steps:**
1. Generate the **Trial Balance** as of today
2. Open the **Balance Sheet** at the same date
3. Cross-reference:

**Expected:**
- [x] TB **Total Assets** subtotal (Closing Debit − Closing Credit across ASSET accounts) = BS **Total Assets**
- [x] TB **Total Liabilities** subtotal (net) = BS **Total Liabilities**
- [x] TB **Total Equity** subtotal (net) + (TB Revenue net − TB Expense net) = BS **Total Equity** (including Retained Earnings)
- [x] Green "Balanced" badge on both reports

---

### TC-16.17 — Empty Company (No Posted Transactions)

**Steps:**
1. Switch to a company with no posted vouchers
2. Navigate to Trial Balance, click **Generate Report**

**Expected:**
- [ ] Page loads without errors
- [ ] If "Include Zero Balances" is checked: shows all accounts with `-` balances
- [ ] If unchecked: shows empty state / "No data" message
- [ ] Grand totals = 0, Balanced badge shows

---

### TC-16.18 — Localization (Multi-Language)

**Steps:**
1. Switch the app language (e.g., from English to Arabic or Turkish)
2. Navigate to Trial Balance
3. Generate the report

**Expected:**
- [x] Page title, subtitle, button labels are **fully translated**
- [x] Classification section headers (Assets, Liabilities, etc.) are translated
- [x] Toolbar labels (As of Date, Include Zero Balances, Generate Report) are translated
- [x] Hierarchy controls (Expand All / Collapse All) are translated
- [x] Footer labels (Grand Total, Balanced/Unbalanced) are translated
- [x] "GROUP" badge is translated

---

### TC-16.19 — Posted-Only Data Source

**Steps:**
1. Create and save a voucher as **Draft** (do NOT post it)
2. Generate the Trial Balance

**Expected:**
- [ ] The draft voucher's amounts are **NOT reflected** in the TB
- [ ] Post the voucher, then re-generate the TB
- [ ] Now the amounts **ARE reflected** in the TB
- [ ] This confirms the TB uses only POSTED General Ledger entries

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-16.1 | ⬜ | |
| TC-16.2 | ⬜ | |
| TC-16.3 | ⬜ | |
| TC-16.4 | ⬜ | |
| TC-16.5 | ⬜ | |
| TC-16.6 | ⬜ | |
| TC-16.7 | ⬜ | |
| TC-16.8 | ⬜ | |
| TC-16.9 | ⬜ | |
| TC-16.10 | ⬜ | |
| TC-16.11 | ⬜ | |
| TC-16.12 | ⬜ | |
| TC-16.13 | ⬜ | |
| TC-16.14 | ⬜ | |
| TC-16.15 | ⬜ | |
| TC-16.16 | ⬜ | |
| TC-16.17 | ⬜ | |
| TC-16.18 | ⬜ | |
| TC-16.19 | ⬜ | |
