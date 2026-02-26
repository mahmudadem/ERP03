# Manual Test — 08: Journal / Day Book Report

## Feature Overview

**What it is:** The Journal (Day Book) shows all financial transactions in chronological order, with each voucher displayed as a block showing its complete debit/credit lines. Unlike the General Ledger (organized by account), the Journal is organized by date/voucher — it's the fundamental chronological record.

**How it works:**
- Backend queries vouchers for a date range and groups them with their lines
- Frontend renders each voucher as a card/block with its debit/credit lines inside
- Date range and voucher type filters
- Grand totals (total debits = total credits) at the bottom

**Workflow impact:**
- Primary audit document: shows the complete record of all entries in date order
- Used to trace the sequence of events ("what happened on January 5th?")
- Replaces the old implementation that was just an alias from the General Ledger

**Benefits:**
- Voucher-centric view (grouped lines) vs account-centric (General Ledger)
- Voucher type filter enables viewing just JEs, just PVs, etc.
- Voucher numbers link to detail for drill-through
- Grand totals verify double-entry integrity

---

## Prerequisites

- [ ] Company with at least **5-10 posted vouchers** of various types (JE, PV, RV)
- [ ] Vouchers with **multiple lines** each (2+ debit/credit lines)
- [ ] Transactions spread across different dates
- [ ] Permission `accounting.reports.generalLedger.view`

---

## Test Cases

### TC-08.1 — Basic Page Load

**Steps:**
1. Navigate to **Accounting → Reports → Journal**
2. Observe the page layout

**Expected:**
- [x] Page title shows "Journal" or "Day Book"
- [x] Date range inputs (From / To) are visible
- [x] A voucher type filter is available (All, JE, PV, RV, etc.)
- [x] Load/Refresh button or auto-load on parameters change

---

### TC-08.2 — Voucher Block Display

**Steps:**
1. Load the journal for a date range with known vouchers
2. Examine how vouchers are displayed

**Expected:**
- [x] Each voucher appears as a **distinct block/card**
- [x] Each block shows: **Voucher No**, **Date**, **Type**, **Description**
- [x] Inside each block: a table with lines showing **Account**, **Description**, **Debit**, **Credit**
- [x] Lines are properly formatted (amounts right-aligned, accounts left-aligned)

---

### TC-08.3 — Chronological Order

**Steps:**
1. Load the journal for a wide date range
2. Check the order of vouchers

**Expected:**
- [x] Vouchers appear in **date order** (oldest first)
- [x] Within the same date, vouchers are ordered by voucher number or creation time

---

### TC-08.4 — Date Range Filter

**Steps:**
1. Load the journal for all dates → note the count
2. Narrow the date range to cover only a subset
3. Verify

**Expected:**
- [x] Only vouchers within the selected date range appear
- [x] Narrowing the range reduces the number of vouchers shown
- [x] Boundaries are inclusive (vouchers on the from/to dates are shown)

---

### TC-08.5 — Voucher Type Filter

**Steps:**
1. Load the journal with "All" type selected → note the total
2. Switch to "JE" (Journal Entry) only
3. Switch to "PV" (Payment Voucher) only

**Expected:**
- [x] "All" shows all voucher types
- [x] Filtering by JE shows only Journal Entry vouchers
- [x] Filtering by PV shows only Payment Vouchers
- [x] Counts reduce appropriately

---

### TC-08.6 — Grand Totals

**Steps:**
1. Load the journal with data
2. Look at the grand totals footer

**Expected:**
- [x] **Total Debits** and **Total Credits** are shown
- [x] Total Debits = Total Credits (double-entry check)
- [x] A "Balanced" indicator may be shown

---

### TC-08.7 — Voucher Number Links (Drill-Through)

**Steps:**
1. Click on a voucher number in the journal

**Expected:**
- [ ] The voucher opens in a detail view (modal, window, or separate page)
- [ ] Full voucher details are shown
- [ ] You can navigate back to the journal

---

### TC-08.8 — Multi-Line Voucher Display

**Steps:**
1. Find a voucher with 3+ lines (e.g., a split entry)
2. Verify all lines are shown

**Expected:**
- [ ] All lines of the voucher appear within its block
- [ ] Debit total per voucher = Credit total per voucher
- [ ] Lines are properly indented/formatted

---

### TC-08.9 — Empty Date Range

**Steps:**
1. Set a date range where no vouchers exist (e.g., future dates)

**Expected:**
- [ ] Page loads without errors
- [ ] Empty state message or "No journal entries found"
- [ ] Grand totals show 0/0

---

### TC-08.10 — Print Layout

**Steps:**
1. Load the journal with several vouchers
2. Click Print
3. Check the preview

**Expected:**
- [ ] Each voucher block stays together (no page break splitting a voucher)
- [ ] Clean, readable format
- [ ] Headers, totals, and date range shown

---

### TC-08.11 — Consistency with General Ledger

**Steps:**
1. Load the Journal for a date range
2. Sum up all the debit amounts for a specific account
3. Check the General Ledger for the same account and date range

**Expected:**
- [ ] The total debits for that account in the Journal match the GL entry debits
- [ ] Both reports show the same underlying data, just organized differently

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-08.1 | ⬜ | |
| TC-08.2 | ⬜ | |
| TC-08.3 | ⬜ | |
| TC-08.4 | ⬜ | |
| TC-08.5 | ⬜ | |
| TC-08.6 | ⬜ | |
| TC-08.7 | ⬜ | |
| TC-08.8 | ⬜ | |
| TC-08.9 | ⬜ | |
| TC-08.10 | ⬜ | |
| TC-08.11 | ⬜ | |
