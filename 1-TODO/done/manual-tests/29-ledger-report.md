![alt text](image.png)# Ledger Report - Manual Test Plan

## Objective
Verify the functionality of the new **Ledger Report** and the underlying **Report Container**.

## Prerequisites
- User logged in with accounting permissions.
- Vouchers exist in the system.

## Test Cases

### TC-01: Navigation to Ledger Report
1. Login to the application.
2. Navigate to **Accounting > Reports**.
3. Verify "Ledger Report" link is visible.
4. Click "Ledger Report".
5. Verify Ledger Report page loads with empty state or prompt to select account.

### TC-02: Report Container Layout
1. Verify Header contains Title ("Ledger Report") and Subtitle.
2. Verify Actions toolbar exists (Print, Export, Refresh).
3. Verify Filter area exists (Account, Date Range).

### TC-03: Generate Ledger Report
1. Select an Account (e.g. "Cash").
2. Select a Date Range (e.g. This Month).
3. Click "Refresh" (or verify auto-load).
4. Verify table loads with columns: Date, Voucher No, Type, Description, Debit, Credit, Balance.
5. Verify Running Balance calculation is correct.
6. Verify Footer totals match sum of columns.

### TC-04: Export/Print
1. Click "Print". Verify browser print dialog opens.
2. Click "Export PDF" (if available). Verify PDF downloads.
3. Click "Export Excel" (if available). Verify Excel downloads.

### TC-05: Empty State
1. Select an Account with no transactions in range.
2. Verify "No transactions found" message is displayed clearly.
