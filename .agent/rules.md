# Voucher Governance Rules

Current high-priority guidance for managing voucher immutability and policy synchronization.

## 1. Governance Modes
- **STRICT MODE**: All posted vouchers are **read-only**. Corrections must be handled via **Reversal** or **Reverse & Replace**.
- **FLEXIBLE MODE**: Posted vouchers may be editable IF the `allowEditDeletePosted` policy is enabled.

## 2. Immutability Invariants (STRICT FOREVER)
- Vouchers created and posted while the system was in **Strict Mode** are marked with `postingLockPolicy: STRICT_LOCKED`.
- **CRITICAL**: A `STRICT_LOCKED` voucher **must remain read-only forever**, even if the system is later switched to Flexible Mode. This is a non-negotiable audit requirement.

## 3. Dynamic Locking (FLEXIBLE_LOCKED)
- Vouchers posted in Flexible Mode are marked with `postingLockPolicy: FLEXIBLE_LOCKED`.
- These vouchers lock and unlock dynamically based on the current `allowEditDeletePosted` setting and the system's active mode.

## 4. Audit Metadata
- Every voucher save/submission must log the `creationMode` (`STRICT` or `FLEXIBLE`) in the `metadata` object.
- This allows auditors to understand the governance context at the time of creation, regardless of current settings.

## 5. Cross-Tab Policy Synchronization
- System-wide policy changes (e.g., switching modes) must be broadcast to all open sessions using the **Broadcast Channel API** (`erp_company_settings_sync`).
- Logic must ensure that UI states (buttons, read-only status) refresh immediately across all tabs to prevent stale-state data corruption.

## 6. Development Workflow
- **Frontend Source of Truth**: `VoucherWindow.tsx` must fetch the latest accounting policy from `/tenant/accounting/policy-config` to verify read-only status.
- **Backend Source of Truth**: All use cases (`UpdateVoucherUseCase`, `DeleteVoucherUseCase`) must perform a real-time policy check against the database before executing mutations on posted vouchers.


## 7. Voucher Lifecycle Scenarios

### Scenario A: The "Strict Governance" Lifecycle (Audit-Ready)
*Targeting regulated environments or complex teams.*

1. **Drafting**: Voucher is saved as `DRAFT`. Fully editable.
2. **Review**: User `Submits for Approval`. Status -> `PENDING`. Voucher becomes **Read-only** to prevent tampering during audit.
3. **Decision**:
   - **Reject**: Approver sends back. Status -> `REJECTED/DRAFT`. Becomes **Editable** again.
   - **Approve**: Approver confirms. Status -> `APPROVED`. Remains **Read-only**.
4. **Finalization**: Voucher is `POSTED` to the ledger.
   - **Policy Tag**: `postingLockPolicy: STRICT_LOCKED`.
   - **Immutability**: Becomes **Permanently Read-only**. No direct edits or deletions allowed.
5. **Correction**: User must use `Reverse` or `Reverse & Replace`.
   - Creating a reversal generates a NEW draft voucher that negates the original. The new voucher follows steps 1-4.

### Scenario B: The "Flexible Ledger" Lifecycle (High-Speed)
*Targeting small teams or initial setup phases.*

1. **Drafting**: Voucher is saved as `DRAFT`. Fully editable.
2. **Posting**: User triggers `Save & Post`. Status -> `POSTED`.
   - **Policy Tag**: `postingLockPolicy: FLEXIBLE_LOCKED`.
   - **Immutability**: **Conditionally Editable**.
3. **Correction**: Direct modification via `Update & Post`.
   - The ledger entry is updated in place. No reversal trail is required.

### Scenario C: System Policy Transitions (The "Immutability Guard")

| Original State (At Posting) | New System Policy | Resulting Behavior | Rationale |
| :--- | :--- | :--- | :--- |
| **STRICT_LOCKED** | Switching to Flexible | **STILL READ-ONLY** | Strict-born vouchers are audited as immutable. This status must persist for the life of the record. |
| **FLEXIBLE_LOCKED** | Switching to Strict | **BECOMES READ-ONLY** | To ensure compliance, Flexible vouchers are locked whenever the system is in Strict mode. |
| **FLEXIBLE_LOCKED** | Flexible Mode | **EDITABLE** | Standard flexible behavior. |

## 8. Terminal States (Non-Actionable)
1. **CANCELLED**: Vouchers that were voided before posting.
2. **REVERSED**: Posted vouchers that have already been negated by a reversal.
*Both states are terminal. The UI must hide `Edit`, `Save`, and `Reverse` actions for these records.*
