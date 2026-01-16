# Voucher & Ledger Governance

This document defines the lifecycle, validation, and governance rules for financial documents (Vouchers) and their impact on the Ledger.

## 1. The "Triple-Link" Architecture
1.  **COA (Structure)**: Defines the *What* (e.g., Cash, Rent Expense).
2.  **Voucher (Document)**: The *Source* of a transaction (e.g., Invoice #123). An aggregate of multiple lines.
3.  **Ledger (History)**: The *Financial Impact*. Each voucher line becomes one or more ledger entries upon posting.

## 2. Financial Invariants
*   **Double-Entry Balancing**: A voucher MUST be balanced in the **Base Currency** (`sum(debit) == sum(credit)`) before it can be posted.
*   **Currency Consistency**: For non-Journal entries, all lines must typically match the header currency. Journal Entries allow mixed currencies but must balance in the base currency.

## 3. The Posting Lifecycle
1.  **DRAFT**: Initial entry. Non-validating.
2.  **PENDING**: Submitted for review. Typically becomes read-only in the UI.
3.  **APPROVED**: Validated and ready for the ledger.
4.  **POSTED**: Financial effect recorded. Ledger entries generated.

## 4. Governance Modes (Immutability)
The system operates in one of two governance modes which dictate how **POSTED** data is handled:

### 4.1 STRICT MODE (Audit-Ready)
*   All posted vouchers are **Unconditionally Read-Only**.
*   Corrections must be handled via **Reversal** (`Reverse` or `Reverse & Replace`).
*   **Tag**: `postingLockPolicy: STRICT_LOCKED`. These records remain read-only even if the system switches to Flexible mode.

### 4.2 FLEXIBLE MODE (High-Speed)
*   Posted vouchers are **Conditionally Editable** based on the `allowEditDeletePosted` setting.
*   **Tag**: `postingLockPolicy: FLEXIBLE_LOCKED`. These records unlock dynamically when settings allow.

## 5. Correction & Audit Rules
*   **Reversals (RV)**: Generates a new voucher with inverted sides (Debit becomes Credit) targeting the exact amount of the original ledger lines.
*   **Terminal States**:
    - **CANCELLED**: Vouchers voided before posting.
    - **REVERSED**: Posted vouchers negated by a reversal.
    - *Both states are terminal (Read-Only).*

## 6. Implementation Guards
*   **Policy Synchronization**: Changes to governance modes must be broadcast to all open browser tabs (using Broadcast Channel API) to prevent stale-state data corruption.
*   **Backend Validation**: All mutation use cases (`UpdateVoucherUseCase`, `DeleteVoucherUseCase`) must perform a real-time policy check against the database before executing.
