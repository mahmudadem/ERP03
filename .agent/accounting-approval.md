# Accounting Approval & Governance

This document defines the dual-gate approval architecture for financial transactions in ERP03.

## 1. Approval Gates
ERP03 uses two distinct validation gates that can be enabled or disabled per company:

### 1.1 Financial Approval (FA)
*   **Gatekeeper**: Finance Manager / Authorized Approver.
*   **Purpose**: Validates accounting correctness, cost center allocation, and business justification.
*   **Logic (FA Apply Mode)**:
    - **ALL**: Every voucher requires management approval.
    - **MARKED_ONLY**: Only vouchers touching specific accounts (marked with `requiresApproval` in COA) require the FA gate.

### 1.2 Custody Confirmation (CC)
*   **Gatekeeper**: The specific User assigned as **Custodian** to an account.
*   **Purpose**: Primarily for Cash/Bank or Restricted Inventory. The person holding the physical assets must "confirm" that the transaction actually occurred.
*   **Logic**: Triggered automatically if ANY account in the voucher has `requiresCustodyConfirmation: true`.
*   **Satisfaction**: Every unique custodian involved in the voucher must perform a "Confirm" action.

## 2. Operating Modes (A-D)
The `ApprovalPolicyService` evaluates company settings to determine the operating mode:

| Mode | FA Enabled | CC Enabled | Result |
| :--- | :--- | :--- | :--- |
| **Mode A** | OFF | OFF | **Auto-Post**. No gates required. |
| **Mode B** | OFF | ON | Awaiting **Custody** only. |
| **Mode C** | ON | OFF | Awaiting **Management** only. |
| **Mode D** | ON | ON | **Dual-Gate**. Requires both FA and CC. |

## 3. Workflow & Status Succession
Vouchers follow a strict status progression to ensure data integrity:

1.  **DRAFT**: Voucher is being edited. No financial impact.
2.  **SUBMITTED (PENDING)**: Voucher is locked for editing. Approval gates are evaluated and requirements are "frozen" in metadata.
3.  **PENDING (FA/CC)**: The voucher remains in `PENDING` status as long as any gate is unsatisfied. 
    - `pendingFinancialApproval: boolean`
    - `pendingCustodyConfirmations: string[]` (User IDs)
4.  **APPROVED**: All gates satisfied. Ready for posting.
5.  **POSTED**: Financial impact recorded in Ledger. Balance nature enforced. Lines frozen forever.

## 4. Policy Enforcement (Posting Guard)
The `PostVoucherUseCase` acts as the final guard:
*   **Invariant**: Status must be `APPROVED`.
*   **Mode A (Fast-Track)**: In Simple Mode, the system auto-approves and auto-posts in a single atomic transaction.
*   **Mode B-D (Strict)**: Manual approval/confirmation actions are recorded in metadata. The status transition to `APPROVED` only happens when the `ApprovalPolicyService.canFinalize()` returns true.

## 5. Custodian Dashboard
Designated custodians see a "Custody Pending" card on their main dashboard and a dedicated tab in the Accounting module to quickly process confirmations for accounts they manage.
