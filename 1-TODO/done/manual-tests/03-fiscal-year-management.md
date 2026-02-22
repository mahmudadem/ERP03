# Manual Test — 03: Fiscal Year & Period Management

## Feature Overview

**What it is:** Fiscal Year Management defines formal accounting periods with status tracking (Open/Closed/Locked). It enables year-end closing — the process of zeroing P&L accounts into Retained Earnings and carrying forward balance sheet accounts.

**New in V2:** Introduction of **Period Schemes**. Users can now choose how the fiscal year is divided:
- **Monthly** (Default): 12 periods (e.g., Jan–Dec)
- **Quarterly**: 4 periods (e.g., Q1–Q4)
- **Semi-Annual**: 2 periods (e.g., H1–H2)

**Special Periods (P13-P16):**
Users can now add up to 4 ad-hoc special periods for year-end adjustments, tax filings, or audits.
- **Custom Naming**: Each special period can be given a unique name (e.g., "P13 - Audit Adjustments").
- **Strict Effective Date**: Special periods are strictly bound to the **last day** of the fiscal year.
- **Post on End-Date Only**: Vouchers assigned to special periods MUST have the fiscal year's end date.

**Persistence & Integrity:**
- **Deletion Block**: A fiscal year cannot be deleted if it contains ANY vouchers (regular or special).
- **Auto-Account Creation**: The backend can safely auto-create the "Retained Earnings" account if it doesn't exist during the closing process.
- **Mandatory Audit Trail**: Closing a year now ALWAYS generates a closing voucher, providing a permanent record of the closing event.
- **Zero-Balance Support**: The system supports closing years with no transactions (zero income) by creating a "Zero Audit Voucher" (0.00 entries).

**Year-End Closing Wizard:**
A guided 3-step process for finalizing the fiscal year:
1. **Step 1: Account Selection**: Select or auto-create the Retained Earnings account.
2. **Step 2: Final Review**: Review the impact (P&L calculation and permanent locking) before committing.
3. **Step 3: Success & Summary**: View the financial results (Revenue, Expense, Net Income) and access the generated audit voucher.

**How it works:**
1. Admin creates a Fiscal Year and selects a "Period Scheme" (P13 is NOT created by default).
2. Admin clicks "+ P13" on an open year to add an adjustment period.
3. Admin provides a custom name in the modal.
4. When posting vouchers, the user selects the special period from the dropdown (only valid if the date is the FY end date).

---

## Prerequisites

- [ ] Company with accounting initialized.
- [ ] User has `accounting.settings.write` permissions.

---

## Test Cases

### TC-03.1 — Access Fiscal Year Management

**Steps:**
1. Navigate to **Accounting → Settings** → **Fiscal Years**
2. Observe the list of fiscal years.

**Expected:**
- [x] Fiscal Year management section is accessible.
- [x] "Create Fiscal Year" button is available.

---

### TC-03.2 — Create a Standard Monthly Fiscal Year

**Steps:**
1. Click "Create Fiscal Year".
2. Enter Year: **2026**.
3. Select Start Month: **January**.
4. Select Period Scheme: **Monthly**.
5. Submit.

**Expected:**
- [x] Fiscal Year "FY2026" is created.
- [x] **12 periods** are generated (Jan 2026 – Dec 2026).
- [x] **Note**: No special periods (P13) are created by default.

---

### TC-03.3 — Create a Quarterly Fiscal Year

**Steps:**
1. Click "Create Fiscal Year".
2. Enter Year: **2027**.
3. Select Period Scheme: **Quarterly**.
4. Submit.

**Expected:**
- [x] Fiscal Year "FY2027" is created.
- [x] **4 periods** are generated.
    - Q1 (Jan–Mar)
    - Q2 (Apr–Jun)
    - Q3 (Jul–Sep)
    - Q4 (Oct–Dec)
- [x] Period names reflect quarters (e.g., "Q1 FY2027").

---

### TC-03.4 — Create a Semi-Annual Fiscal Year

**Steps:**
1. Click "Create Fiscal Year".
2. Enter Year: **2028**.
3. Select Period Scheme: **Semi-Annual**.
4. Submit.

**Expected:**
- [x] Fiscal Year "FY2028" is created.
- [x] **2 periods** are generated.
    - H1 (Jan–Jun)
    - H2 (Jul–Dec)
- [x] Period names reflect halves (e.g., "H1 FY2028").

---

### TC-03.5 — Add Named Special Period (P13)

**Steps:**
1. Locate FY2026 (Open).
2. Click the **+ P13** button (visible only for open years with < 4 special periods).
3. In the modal, enter Name: **Year-End Audit Adjustments**.
4. Submit.

**Expected:**
- [x] Special period P13 is added to the list.
- [x] Name matches exactly "Year-End Audit Adjustments".
- [x] Dates for P13 are both **Dec 31, 2026**.

---

### TC-03.6 — Post to Special Period (Strict Date Rule)

**Steps:**
1. Close the Settings and go to **Accounting → Vouchers**.
2. Click "New Voucher". Set Date: **Dec 31, 2026**.
3. In Period Selector, choose **Year-End Audit Adjustments (P13)**.
4. Add lines and submit.
5. Create another voucher. Set Date: **Dec 30, 2026**.
6. Try to select **P13** or submit with P13 selected.

**Expected:**
- [x] Voucher at Dec 31 posts successfully to P13.
- [x] Voucher at Dec 30 is **BLOCKED**. Error: "Special Period can only be used on the fiscal year end date."

---

### TC-03.7 — Add Multiple Special Periods

**Steps:**
1. Go back to Settings → Fiscal Years.
2. Click **+ P14** for FY2026. Name it **Tax Adjustments**.
3. Verify P14 is added.
4. Verify you can add up to P16.
5. Verify the "+ Pxx" button disappears after P16 is reached.

**Expected:**
- [x] Multiple ad-hoc periods exist with their unique names.
- [x] Limit of 4 special periods (P13-P16) is enforced in UI.

---

### TC-03.8 — Delete Fiscal Year (Integrity Block)

**Steps:**
1. Identify FY2026 which now contains at least one voucher.
2. Click the **Delete** (Trash) icon for FY2026.
3. Confirm the deletion.

**Expected:**
- [x] Deletion is **REJECTED**.
- [x] Toast/Error message: "Cannot delete Fiscal Year. It contains vouchers."

---

### TC-03.9 — Auto-Create Retained Earnings Account

**Steps:**
1. Select an Open Fiscal Year (e.g. FY2027).
2. Click **Close Year** (Lock icon).
3. In the "Retained Earnings Account" selector, click the link **"Auto-create account"**.
4. Save the account creation.

**Expected:**
- [x] Account "Retained Earnings" is created with code 30200 (or next).
- [x] The selector is automatically populated with the new account.
- [x] No manual COA navigation required.

---

### TC-03.10 — Backward Compatibility

**Steps:**
1. View a fiscal year created *before* the update.
2. Verify it is still functional and defaults to Monthly scheme in UI.

**Expected:**
- [x] Existing data remains intact.
- [x] You can add new special periods to legacy fiscal years.

---

### TC-03.11 — Year-End Closing Wizard & Audit Trail

**Steps:**
1. Identify an Open Fiscal Year (e.g., FY2027).
2. Click the **Close Year** (Lock icon) to launch the **Wizard**.
3. **Step 1**: Select the Retained Earnings account and click **Next**.
4. **Step 2**: Review the P&L summary and disclaimer, then click **Finalize & Lock Year**.
5. **Step 3**: Verify the success screen appears with correct Revenue/Expense/Net Income totals.
6. Click **View Entry** to navigate to the generated voucher.
7. Repeat for a year with **zero balances**.

**Expected:**
- [x] Wizard follows the 3-step flow (Select → Review → Success).
- [x] Financial summary correctly calculates Net Income (Revenue - Expense).
- [x] Closing voucher (ID: `CLOSE-XXXX`) is created and linked.
- [x] **Zero-Balance Scenario**: Wizard completes successfully and generates a voucher with balancing `0.00` lines.

---

## Test Results

| Test ID | Status | Notes |
|---|---|---|
| TC-03.1 | ⬜ | Access |
| TC-03.2 | ⬜ | Standard FY |
| TC-03.3 | ⬜ | Quarterly FY |
| TC-03.4 | ⬜ | Semi-Annual FY |
| TC-03.5 | ⬜ | Named P13 |
| TC-03.6 | ⬜ | Strict Date Rule |
| TC-03.7 | ⬜ | Multi Special Periods |
| TC-03.8 | ⬜ | Deletion Block |
| TC-03.9 | ⬜ | Auto-Create Account |
| TC-03.10| ⬜ | Compatibility |
| TC-03.11| ⬜ | Closing Wizard & Audit |
