# Manual Test — 13: Recurring Vouchers

## Feature Overview

**What it is:** Recurring Vouchers automate repetitive accounting entries (rent, salaries, depreciation, loan payments) by defining a template that generates draft vouchers on a schedule (monthly, quarterly, annually).

**How it works:**
- User creates a recurring template from an existing voucher, specifying frequency, start/end date, and day of month
- System generates draft vouchers when the scheduled date arrives (via manual trigger or cron job)
- Generated vouchers land in DRAFT status for review before posting
- Templates can be paused, resumed, or completed

**Workflow impact:**
- Eliminates manual creation of repetitive entries (30+ vouchers/year saved per template)
- Generated vouchers follow the normal workflow (Draft → Submit → Approve → Post)
- Templates track how many occurrences have been generated

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] At least one **posted voucher** to use as a source template (e.g., a rent payment)
- [ ] User has permissions for recurring voucher management

---

## Test Cases

### TC-13.1 — Access Recurring Vouchers Page

**Steps:**
1. Navigate to **Accounting → Recurring Vouchers**

**Expected:**
- [ ] Page loads with a list of recurring templates (or empty if none exist)
- [ ] A "Create" button is available

---

### TC-13.2 — Create a Recurring Template

**Steps:**
1. Click Create
2. Select a source voucher (or enter template details: name, accounts, amounts)
3. Set frequency: **Monthly**
4. Set day of month: **1** (1st of each month)
5. Set start date and optionally end date
6. Save

**Expected:**
- [ ] Template is created with status **ACTIVE**
- [ ] Next generation date is calculated correctly
- [ ] Template shows: name, frequency, next date, status, occurrences generated (0)

---

### TC-13.3 — Generate Vouchers (Manual Trigger)

**Steps:**
1. If "Generate Now" or similar trigger exists, click it
2. Or wait for the generation to trigger automatically

**Expected:**
- [ ] A new **DRAFT** voucher is created based on the template
- [ ] The voucher's date matches the scheduled date
- [ ] The voucher's lines (accounts, amounts) match the template's source voucher
- [ ] The template's `nextGenerationDate` advances to the next occurrence
- [ ] The template's `occurrencesGenerated` increments

---

### TC-13.4 — Generated Voucher Follows Normal Workflow

**Steps:**
1. Open a voucher that was auto-generated from a recurring template
2. Submit it for approval, then approve and post it

**Expected:**
- [ ] The generated voucher behaves exactly like a manually created voucher
- [ ] It can be edited, submitted, approved, and posted
- [ ] After posting, ledger entries are created normally

---

### TC-13.5 — Pause a Template

**Steps:**
1. Select an ACTIVE recurring template
2. Click **Pause**

**Expected:**
- [ ] Status changes to **PAUSED**
- [ ] No new vouchers are generated while paused
- [ ] The next generation date is preserved (not lost)

---

### TC-13.6 — Resume a Paused Template

**Steps:**
1. Select a PAUSED template
2. Click **Resume**

**Expected:**
- [ ] Status changes back to **ACTIVE**
- [ ] Next generation date may need recalculation (if past dates were missed)
- [ ] Generation resumes normally

---

### TC-13.7 — End Date / Max Occurrences

**Steps:**
1. Create a template with an end date (e.g., 6 months from now) or max occurrences (e.g., 6)
2. Generate vouchers until the limit is reached

**Expected:**
- [ ] After reaching the end date or max occurrences, status changes to **COMPLETED**
- [ ] No further vouchers are generated
- [ ] The template remains for reference

---

### TC-13.8 — Different Frequencies

**Steps:**
1. Create a **Quarterly** recurring template → verify next date jumps 3 months
2. Create an **Annually** recurring template → verify next date jumps 1 year

**Expected:**
- [ ] Monthly: next date is 1 month later
- [ ] Quarterly: next date is 3 months later
- [ ] Annually: next date is 1 year later

---

### TC-13.9 — History / Generated Vouchers List

**Steps:**
1. Select a recurring template
2. Look for a "History" or "Generated Vouchers" section

**Expected:**
- [ ] All vouchers generated from this template are listed
- [ ] Each entry shows: date, voucher number, status (draft/posted)
- [ ] Clicking an entry opens the voucher

---

### TC-13.10 — Empty State

**Steps:**
1. Access the recurring vouchers page when no templates exist

**Expected:**
- [ ] Clean empty state with prompt to create first template
- [ ] No errors

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-13.1 | ⬜ | |
| TC-13.2 | ⬜ | |
| TC-13.3 | ⬜ | |
| TC-13.4 | ⬜ | |
| TC-13.5 | ⬜ | |
| TC-13.6 | ⬜ | |
| TC-13.7 | ⬜ | |
| TC-13.8 | ⬜ | |
| TC-13.9 | ⬜ | |
| TC-13.10 | ⬜ | |
