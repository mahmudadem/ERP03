# Manual Test — 07: Voucher Numbering Sequences

## Feature Overview

**What it is:** Professional voucher numbering with atomic sequential counters, preventing gaps and duplicates. Each voucher type (JE, PV, RV) has its own sequence with configurable format, optional annual reset, and admin override.

**How it works:**
- Firestore transactions ensure atomic increment — even under concurrent voucher creation
- Each prefix (voucher type) has an independent counter tracked in a `voucherSequences` collection
- Format: `{PREFIX}-{COUNTER:4}` (e.g., JE-0001) or `{PREFIX}-{YYYY}-{COUNTER:4}` (e.g., JE-2026-0001)
- Admin can view current counters and set the next number (for migration from legacy systems)

**Workflow impact:**
- Audit compliance: sequential, gap-free numbers are required by auditors and regulators
- Each voucher type gets its own independent sequence
- Year-end can optionally reset counters for the new fiscal year

**Benefits:**
- No duplicate voucher numbers under concurrent usage
- Gap detection for audit trail integrity
- Configurable format supports different business conventions
- Migration-friendly: admin can set starting number

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] Ability to create vouchers of different types (JE, PV, RV)
- [ ] Access to Settings page for viewing/editing sequences
- [ ] (Optional) Two browser sessions/tabs for concurrency testing

---

## Test Cases

### TC-07.1 — Sequential Number Assignment

**Steps:**
1. Create and save 5 vouchers of the same type (e.g., Journal Entry) one after another
2. Note the voucher numbers assigned

**Expected:**
- [ ] Numbers are strictly sequential (e.g., JE-0001, JE-0002, JE-0003, JE-0004, JE-0005)
- [ ] No gaps between consecutive vouchers
- [ ] Numbers are zero-padded (at least 4 digits)

---

### TC-07.2 — Independent Sequences Per Type

**Steps:**
1. Create a Journal Entry → note its number (e.g., JE-0006)
2. Create a Payment Voucher → note its number (e.g., PV-0001)
3. Create another Journal Entry → note its number (e.g., JE-0007)

**Expected:**
- [ ] JE and PV have **independent** counters
- [ ] Creating a PV does not increment the JE counter
- [ ] Each type maintains its own sequence

---

### TC-07.3 — Concurrent Voucher Creation (No Duplicates)

**Steps:**
1. Open **two browser tabs** with the voucher creation form
2. Fill out both forms completely
3. Click Save/Submit on **both simultaneously** (as close to same time as possible)
4. Check the assigned voucher numbers

**Expected:**
- [ ] Both vouchers get **different** numbers (no duplicates)
- [ ] Numbers are sequential (e.g., JE-0008 and JE-0009)
- [ ] No errors or data corruption

---

### TC-07.4 — View Sequences in Settings

**Steps:**
1. Navigate to **Accounting → Settings** (or wherever voucher numbering config is)
2. Look for a "Voucher Numbering" or "Sequences" section

**Expected:**
- [ ] A list of current sequences is shown (JE, PV, RV, etc.)
- [ ] Each sequence shows: prefix, current counter (last number), format
- [ ] The counter reflects the actual last number used

---

### TC-07.5 — Set Next Number (Admin Override)

**Steps:**
1. In the sequence settings, set the next JE number to **100**
2. Save
3. Create a new Journal Entry

**Expected:**
- [ ] The new JE gets number **JE-0100** (or the format equivalent)
- [ ] Subsequent JEs continue from 101, 102, etc.
- [ ] The setting persists after page reload

---

### TC-07.6 — Format Display

**Steps:**
1. Check various voucher numbers created with the system

**Expected:**
- [ ] Numbers follow the configured format: `PREFIX-NNNN` or `PREFIX-YYYY-NNNN`
- [ ] Zero-padding is consistent (e.g., 0001 not 1)
- [ ] The format preview in settings matches actual output

---

### TC-07.7 — Backward Compatibility

**Steps:**
1. Check vouchers that were created **before** the numbering system was implemented
2. View these vouchers in the list

**Expected:**
- [ ] Old vouchers retain their original numbers (not renumbered)
- [ ] Old voucher numbers are displayed correctly
- [ ] No errors when viewing or editing old vouchers

---

### TC-07.8 — Delete/Cancel Voucher and Number Gap

**Steps:**
1. Note the current counter (e.g., JE last = 10)
2. Create a new JE → gets JE-0011
3. Cancel or delete that voucher
4. Create another JE → note the number

**Expected:**
- [ ] The next JE gets JE-0012 (counter does NOT re-use cancelled numbers)
- [ ] This is expected behavior — gap-free in assignment, gaps may occur from deletions
- [ ] The number is consumed on creation, not posting

---

### TC-07.9 — Year-Based Reset (If Configured)

**Steps:**
1. If annual reset is enabled, check sequences for the current vs previous year
2. Create a voucher in the current year

**Expected:**
- [ ] Counters are tracked per year (e.g., JE-2026-0001 vs JE-2025-0001)
- [ ] New year starts from 0001 again
- [ ] Previous year's counter is preserved

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-07.1 | ⬜ | |
| TC-07.2 | ⬜ | |
| TC-07.3 | ⬜ | |
| TC-07.4 | ⬜ | |
| TC-07.5 | ⬜ | |
| TC-07.6 | ⬜ | |
| TC-07.7 | ⬜ | |
| TC-07.8 | ⬜ | |
| TC-07.9 | ⬜ | |
