# Manual Test — 15: Export to Excel / PDF

## Feature Overview

**What it is:** Reusable export utilities integrated into all major accounting reports, enabling professional Excel (XLSX) and PDF output for auditors, management, and regulatory submissions.

**How it works:**
- Frontend `exportUtils.ts` provides `exportToExcel()` and `exportElementToPDF()` functions
- Each report page has "Export Excel" and "Export PDF" buttons
- Excel generation uses `exceljs` for formatted spreadsheets (headers, number formatting, auto-widths)
- PDF generation captures the on-screen DOM element as a styled PDF document

**Reports with export integration:**
- Trial Balance, P&L, Balance Sheet, Account Statement, Cash Flow, Journal, Aging Reports, Budget vs Actual

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] At least one report with data (e.g., Trial Balance with accounts)
- [ ] Ability to open Excel (.xlsx) and PDF files

---

## Test Cases

### TC-15.1 — Balance Sheet — Export Excel

**Steps:**
1. Open the **Balance Sheet** report with data
2. Click **Export Excel**

**Expected:**
- [ ] An `.xlsx` file downloads
- [ ] Filename includes the report name and date (e.g., `Balance-Sheet-2026-02-10.xlsx`)
- [ ] Columns: Section, Code, Account, Balance
- [ ] Numbers are formatted as numbers (not text)
- [ ] Report header/subtitle included (company name, date)

---

### TC-15.2 — Balance Sheet — Export PDF

**Steps:**
1. Open the Balance Sheet with data
2. Click **Export PDF**

**Expected:**
- [ ] A PDF file downloads
- [ ] Content matches the on-screen layout
- [ ] All three sections (Assets, Liabilities, Equity) are visible
- [ ] Totals and balanced indicator are included

---

### TC-15.3 — Trial Balance — Export Excel

**Steps:**
1. Open the **Trial Balance** report
2. Click **Export Excel**

**Expected:**
- [ ] Excel file with columns: Account Code, Account Name, Debit, Credit
- [ ] Totals row at the bottom
- [ ] Debit total = Credit total

---

### TC-15.4 — P&L / Income Statement — Export Excel

**Steps:**
1. Open the **P&L** report
2. Click **Export Excel**

**Expected:**
- [ ] Revenue and Expense accounts with their balances
- [ ] Net Income/Loss summary
- [ ] Date range in the header

---

### TC-15.5 — Account Statement — Export

**Steps:**
1. Open an Account Statement with entries
2. Export to Excel and/or PDF

**Expected:**
- [ ] All entries with Date, Voucher No, Description, Debit, Credit, Running Balance
- [ ] Opening and Closing Balance included
- [ ] Account header info in the export

---

### TC-15.6 — Excel Formatting Quality

**Steps:**
1. Open any exported Excel file
2. Check formatting details

**Expected:**
- [ ] **Bold header row** with column names
- [ ] Numbers formatted with **2 decimal places** and commas (accounting format)
- [ ] **Auto-fitted column widths** (no truncated text)
- [ ] Report title in a merged cell at the top
- [ ] Date range or "As of" date in subtitle

---

### TC-15.7 — PDF Layout Quality

**Steps:**
1. Open any exported PDF
2. Check layout

**Expected:**
- [ ] Professional, readable layout
- [ ] Company name and report title visible
- [ ] Consistent fonts and spacing
- [ ] Page is not cut off or overlapping

---

### TC-15.8 — Large Report Export

**Steps:**
1. Open a report with many rows (50+ accounts or entries)
2. Export to Excel and PDF

**Expected:**
- [ ] Export completes without browser freezing
- [ ] All rows are included in the export (no data truncation)
- [ ] PDF handles multiple pages gracefully

---

### TC-15.9 — Empty Report Export

**Steps:**
1. Open a report with **no data** (e.g., a new company with no transactions)
2. Click Export Excel

**Expected:**
- [ ] Export completes without errors
- [ ] Excel file has headers but no data rows (or a "No data" message)

---

### TC-15.10 — Export Multiple Reports

**Steps:**
1. Export Excel from 3 different reports back-to-back
2. Open all three files

**Expected:**
- [ ] Each file is correctly generated
- [ ] Filenames are unique (different report names/dates)
- [ ] No file corruption or mixing of data between reports

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-15.1 | ⬜ | |
| TC-15.2 | ⬜ | |
| TC-15.3 | ⬜ | |
| TC-15.4 | ⬜ | |
| TC-15.5 | ⬜ | |
| TC-15.6 | ⬜ | |
| TC-15.7 | ⬜ | |
| TC-15.8 | ⬜ | |
| TC-15.9 | ⬜ | |
| TC-15.10 | ⬜ | |
