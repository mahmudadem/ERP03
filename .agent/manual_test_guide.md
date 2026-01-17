# ERP03 Accounting Approval & Governance - Manual Test Guide

This document is a comprehensive "Master Script" for manually verifying the end-to-end functionality of the ERP03 Accounting Approval System. It covers Design Migration, User Setup, and Dual-Gate Workflow verification.

---

## 📋 Phase 1: Environment Setup & Design Migration

**Objective:** Verify that work can be transferred to a clean environment to ensure strict test validity.

### 1.1 Create Clean Company
1.  Log in as **Super Admin**.
2.  Navigate to **Company Management**.
3.  Create a new company: `Test Corp (Approvals)`.
4.  Switch to this new company context.

### 1.2 Import Voucher Design
1.  Navigate to **Accounting > Configuration > Voucher Designer**.
2.  Verify the list is empty (or contains only defaults).
3.  Click the **Import** button (header).
4.  Select your exported JSON file (`voucher_form_....json`).
5.  **Verify:** The form appears in the "Custom Forms" section.
6.  **Verify:** Click "Edit" (pencil icon) to ensure the layout/fields match your original design.

### 1.3 User Setup
**CRITICAL:** Since email invitation workflow is not enabled, you must **Register** these users first (Sign Up from the login page) so they have valid accounts, **THEN** invite them to the company using their registered email.

Create/Register these three users:
*   **User A (Manager)**: `manager@test.com` (or similar). Assign Role: `Finance Manager`.
*   **User B (Custodian)**: `cashier@test.com`. Assign Role: `Cashier` (or `Cashier / Custodian`).
*   **User C (Accountant)**: `accountant@test.com`. Role: `Bookkeeper` (or basic Member).

---

## 📋 Phase 2: Configuration & Gates

**Objective:** Verify that the system correctly enforces the 4 Operating Modes (A-D).

### 2.1 Configure "Mode D" (Dual-Gate)
1.  Navigate to **Accounting > Settings > Policies**.
2.  Set **Financial Approval**: `Enabled` (Apply: `ALL`).
3.  Set **Custody Confirmation**: `Enabled`.
4.  **Save**.

### 2.2 Configure COA (Custody)
1.  Navigate to **Chart of Accounts**.
2.  Select a Cash/Bank account (e.g., `1101-01 Main Cashier`).
3.  Edit Account $\rightarrow$ **Security/Governance**.
4.  Check **Requires Custody Confirmation**.
5.  Assign **User B (Custodian)** as the custodian.

---

## 📋 Phase 3: Execution Cases

### 🧪 Case 1: The "Happy Path" (Dual-Gate)
**Scenario:** A legitimate cash expense that passes all checks.

1.  **Submit (User C)**:
    *   Create a Payment Voucher using your **Imported Design**.
    *   Debit: `General Expense`. Credit: `1101-01 Main Cashier`.
    *   **Action:** Submit for Approval.
    *   **Verify:** Toast says "Submitted". Status is `PENDING (Approval)`.
2.  **Approve (User A)**:
    *   Go to **Approvals Center**.
    *   Find the voucher in **Financial Approvals** tab.
    *   **Action:** Click **Approve**.
    *   **Verify:** Status changes to `PENDING (Custody)`. It does **NOT** post yet.
3.  **Confirm (User B)**:
    *   Go to **Approvals Center** (or Dashboard Widget).
    *   Find the voucher in **Custody Pending** tab.
    *   **Action:** Click **Confirm**.
    *   **Verify:** Status changes to `APPROVED`.
    *   **Verify:** System auto-posts (if auto-post is enabled), status becomes `POSTED`.

### 🧪 Case 2: Rejection Flow
**Scenario:** Manager rejects a voucher due to missing info.

1.  **Submit (User C)**: Create and submit a similar voucher.
2.  **Reject (User A)**:
    *   Go to **Financial Approvals**.
    *   **Action:** Click **Reject**.
    *   **Verify:** **Rejection Modal** appears.
    *   **Action:** Click "Reject" without reason (Should fail/block).
    *   **Action:** Enter reason: "Missing receipt attachment". Click **Reject**.
    *   **Verify:** Voucher status becomes `DRAFT` or `REJECTED`.
    *   **Verify:** History/Audit log shows the rejection reason.

### 🧪 Case 3: Mixed Custodians (Complex)
**Scenario:** Verification of precise routing.

1.  **Setup**: Configure a second cash account (`1101-02 Petty Cash`) with a **different custodian**.
2.  **Submit**: Create a voucher involving **BOTH** cash accounts.
3.  **Verify**:
    *   After Financial Approval, the voucher should appear in **BOTH** custodians' queues.
    *   The voucher should **NOT** post until **BOTH** confirm.
    *   One confirming should not prematurely release the voucher.

---

## 📋 Phase 4: Mode Regression (Quick Check)

### 4.1 Mode A (Simple)
1.  **Settings**: Disable FA and CC in Policy Settings.
2.  **Submit**: User C submits a voucher.
3.  **Verify**: Instant transition to `APPROVED/POSTED`. No gates.

### 4.2 Mode C (Finance Only)
1.  **Settings**: Enable FA, Disable CC.
2.  **Submit**: User C submits.
3.  **Verify**: Status `PENDING (Approval)`.
4.  **Action**: Manager Approves.
5.  **Verify**: Instant transition to `APPROVED/POSTED`. No custody step.
