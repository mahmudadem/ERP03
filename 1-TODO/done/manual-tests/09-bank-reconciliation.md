# Manual Test — 09: Bank Reconciliation

## Feature Overview

**What it is:** Bank reconciliation matches your ledger entries against actual bank statement data to detect errors, fraud, unrecorded bank fees, and ensure the book balance matches the bank balance.

**How it works:**
- Import a bank statement (CSV or OFX format) for a specific bank account
- Auto-matching engine matches bank lines to ledger entries by amount, date proximity, and reference
- Unmatched items are presented for manual matching
- Adjustment entries (e.g., bank fees) can be auto-created
- Reconciliation is finalized and ledger entries are marked as "reconciled"

**Workflow impact:**
- Monthly reconciliation is an audit requirement for every company
- Identifies discrepancies between the company's books and the bank's records
- Unrecorded bank charges/interest get properly recorded

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] At least one bank/cash account with **10+ posted ledger entries**
- [ ] A **bank statement file** (CSV or OFX) matching some of those transactions
- [ ] Ideally, some transactions in the book but NOT in the bank, and vice versa

---

## Test Cases

### TC-09.1 — Access Reconciliation Page

**Steps:**
1. Navigate to **Accounting → Bank Reconciliation**

**Expected:**
- [ ] Reconciliation page loads
- [ ] A bank account selector is visible
- [ ] An option to import a bank statement is available

---

### TC-09.2 — Import CSV Bank Statement

**Steps:**
1. Click Import/Upload
2. Select a CSV file with bank transactions (columns: date, description, reference, amount, balance)
3. Map the columns if required
4. Submit

**Expected:**
- [ ] The CSV is parsed successfully
- [ ] Bank statement lines appear in the reconciliation view
- [ ] Deposits show as positive, withdrawals as negative
- [ ] The statement date and bank name are recorded

---

### TC-09.3 — Import OFX Bank Statement

**Steps:**
1. If OFX import is supported, upload an OFX file

**Expected:**
- [ ] OFX file is parsed correctly
- [ ] Transactions appear with proper dates, amounts, and descriptions

---

### TC-09.4 — Auto-Matching

**Steps:**
1. After import, observe the auto-matching results
2. Check which items were automatically matched

**Expected:**
- [ ] Items with exact amount match and close dates (within 3 days) are auto-matched
- [ ] Items with matching reference numbers are auto-matched
- [ ] Auto-matched items are color-coded (e.g., green or yellow)
- [ ] The match status shows "AUTO_MATCHED"

---

### TC-09.5 — Manual Matching

**Steps:**
1. Find an unmatched bank line
2. Find the corresponding unmatched ledger entry
3. Click to manually match them

**Expected:**
- [ ] The two items are linked together
- [ ] Their status changes to "MANUAL_MATCHED"
- [ ] They move from the unmatched list to the matched list

---

### TC-09.6 — Unmatched Items Display

**Steps:**
1. Review items that remain unmatched after auto-matching

**Expected:**
- [ ] **In Book, Not in Bank** — Items posted in the ledger but not on the statement (e.g., outstanding checks)
- [ ] **In Bank, Not in Book** — Items on the statement but not in the ledger (e.g., bank fees, interest)
- [ ] Both sides are clearly displayed and visually distinct

---

### TC-09.7 — Create Adjustment Entry

**Steps:**
1. Find a bank fee or interest payment that's in the bank statement but not in the books
2. Use the "Create Adjustment" feature to record it

**Expected:**
- [ ] A journal entry is created for the bank charge/interest
- [ ] The new entry appears in the ledger
- [ ] The bank line is now matched to the new entry

---

### TC-09.8 — Reconciliation Summary

**Steps:**
1. Review the reconciliation summary/footer

**Expected:**
- [ ] Book Balance is shown
- [ ] Bank Balance (from statement) is shown
- [ ] Adjustments are listed
- [ ] Book Balance ± adjustments = Bank Balance (or clear difference shown)

---

### TC-09.9 — Complete Reconciliation

**Steps:**
1. Match all items (or accept remaining as outstanding)
2. Click "Complete" / "Finalize"

**Expected:**
- [ ] Reconciliation status changes to COMPLETED
- [ ] Ledger entries are marked as "Reconciled"
- [ ] The reconciliation is saved for historical reference
- [ ] Completed timestamp and user are recorded

---

### TC-09.10 — Historical Reconciliations

**Steps:**
1. After completing a reconciliation, navigate to the history/list view
2. Look for past reconciliations

**Expected:**
- [ ] Past reconciliations are listed with date, account, status
- [ ] Completed ones are viewable (read-only)
- [ ] The detail view shows the matched/unmatched items from that period

---

### TC-09.11 — Permission Check

**Steps:**
1. Log in as a user without reconciliation permissions
2. Try to access the reconciliation page

**Expected:**
- [ ] Access is denied or read-only

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-09.1 | ⬜ | |
| TC-09.2 | ⬜ | |
| TC-09.3 | ⬜ | |
| TC-09.4 | ⬜ | |
| TC-09.5 | ⬜ | |
| TC-09.6 | ⬜ | |
| TC-09.7 | ⬜ | |
| TC-09.8 | ⬜ | |
| TC-09.9 | ⬜ | |
| TC-09.10 | ⬜ | |
| TC-09.11 | ⬜ | |
