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
