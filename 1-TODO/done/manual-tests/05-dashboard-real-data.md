# Manual Test — 05: Dashboard with Real Data

## Feature Overview

**What it is:** The accounting dashboard is the first screen users see in the Accounting module. Previously it showed hardcoded placeholder numbers. This plan replaces all fake data with live API calls showing real voucher counts, cash positions, and recent journal entries.

**How it works:**
- Dashboard calls a `/reports/dashboard-summary` API on load
- Backend runs parallel queries for voucher counts, trial balance (for cash position), and recent vouchers
- Frontend renders KPI cards, recent entries table, and quick navigation links
- Auto-refreshes periodically (every 60 seconds or on tab focus)

**Workflow impact:**
- Users get immediate visibility into the accounting module's health
- Quick access to pending approvals, recent entries, and key reports
- Builds trust — real numbers instead of "coming soon" placeholders

**Benefits:**
- Real-time KPI visibility (total vouchers, cash position, drafts, pending approvals)
- Recent journal entries with clickable voucher links
- Financial reports navigation shortcuts
- Skeleton loading states for better UX

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] At least **5-10 posted vouchers** of different types
- [ ] At least one cash/bank account with a balance
- [ ] Some draft and pending-approval vouchers for status card testing

---

## Test Cases

### TC-05.1 — Dashboard Loads with Real Data

**Steps:**
1. Navigate to **Accounting** (dashboard is the default view)
2. Wait for data to load

**Expected:**
- [ ] **No hardcoded numbers** — all cards show data from the API
- [ ] Total Vouchers card shows a real count (verify by counting on the Vouchers List page)
- [ ] Cash Position card shows the sum of cash/bank account balances
- [ ] Recent journal entries section shows actual recent vouchers (not "coming soon")
- [ ] Loading skeletons appeared briefly while data was loading

---

### TC-05.2 — Total Vouchers Card Accuracy

**Steps:**
1. Note the Total Vouchers count on the dashboard
2. Navigate to the Vouchers List page and count the total
3. Compare

**Expected:**
- [ ] The dashboard count matches the vouchers list total
- [ ] If there's a "this month" filter, verify it matches the monthly count

---

### TC-05.3 — Cash Position Accuracy

**Steps:**
1. Note the Cash Position amount on the dashboard
2. Open the Trial Balance and sum up all accounts classified as Cash/Bank (ASSET role CASH or BANK)
3. Compare

**Expected:**
- [ ] Cash Position matches the sum of cash/bank account balances
- [ ] Currency is displayed correctly (base currency)

---

### TC-05.4 — Recent Journal Entries

**Steps:**
1. Look at the Recent Entries section
2. Compare with the Vouchers List (sorted by date, most recent first)

**Expected:**
- [ ] Shows the last 10 posted vouchers
- [ ] Each entry displays: date, voucher number, type, amount, status
- [ ] Entries are in reverse chronological order (most recent first)
- [ ] Voucher numbers are clickable (navigate to detail)

---

### TC-05.5 — Quick Stats Accuracy

**Steps:**
1. Check Draft count, Pending Approval count, Posted This Month count
2. Verify each against the Vouchers List by filtering

**Expected:**
- [ ] Draft count matches vouchers with status DRAFT
- [ ] Pending count matches vouchers with status PENDING_APPROVAL
- [ ] Posted This Month count matches vouchers posted within the current month

---

### TC-05.6 — Financial Reports Navigation

**Steps:**
1. Look for Financial Reports links/cards on the dashboard
2. Click each one (Trial Balance, Balance Sheet, P&L, etc.)

**Expected:**
- [ ] Each link navigates to the correct report page
- [ ] No broken links or "coming soon" placeholders remain

---

### TC-05.7 — Empty Company (No Data)

**Steps:**
1. Switch to a company with no posted vouchers
2. Load the dashboard

**Expected:**
- [ ] Page loads without errors
- [ ] All counts show 0
- [ ] Cash Position shows 0
- [ ] Recent Entries shows empty state (no entries message)
- [ ] No hardcoded fallback numbers

---

### TC-05.8 — Performance

**Steps:**
1. Load the dashboard and measure load time

**Expected:**
- [ ] Dashboard loads within **2 seconds**
- [ ] No visible lag or stutter
- [ ] Skeleton loading states appear during loading (not blank screen)

---

### TC-05.9 — Data Refresh After Changes

**Steps:**
1. Open the dashboard
2. In a new tab, create and post a new voucher
3. Return to the dashboard and wait for refresh (or click refresh if available)

**Expected:**
- [ ] Dashboard updates to reflect the new voucher
- [ ] Total Vouchers count increments
- [ ] Recent Entries shows the new voucher at the top

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-05.1 | ⬜ | |
| TC-05.2 | ⬜ | |
| TC-05.3 | ⬜ | |
| TC-05.4 | ⬜ | |
| TC-05.5 | ⬜ | |
| TC-05.6 | ⬜ | |
| TC-05.7 | ⬜ | |
| TC-05.8 | ⬜ | |
| TC-05.9 | ⬜ | |
