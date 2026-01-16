# Chart of Accounts (COA) Design & Rules

This document defines the structural and validation rules for the Chart of Accounts in the ERP03 Accounting module.

## 1. Hierarchical Integrity
*   **Classification Consistency**: A child account *must* share the same classification (Asset, Liability, Equity, Revenue, Expense) as its parent.
*   **No Circular References**: An account cannot point to itself or any of its descendants as its parent.
*   **Orphan Management**: Any account without a valid parent is automatically displayed at the root level in the UI to prevent data loss.

## 2. Account Roles
*   **HEADER (Structural)**: 
    - Used for consolidation and grouping.
    - **Cannot** accept ledger postings (vouchers).
    - Represented by Blue/Indigo tags in the UI.
*   **POSTING (Transactional)**: 
    - Used for actual journal entries.
    - Represented by Emerald/Green tags in the UI.
    - **Constraint**: If a POSTING account becomes a parent (receives children), it is effectively treated as a HEADER by the `AccountValidationService`.

## 3. Currency Policies
Defines which currencies are allowed for transactions on a specific account:
*   **INHERIT**: Child accounts follow the currency policy of their parent.
*   **FIXED**: The account is locked to a specific currency (e.g., a "Bank of America - USD" account). All voucher lines must match this currency.
*   **RESTRICTED**: Allows only a specific list of currencies.
*   **OPEN**: The account can accept postings in any system-supported currency.

## 4. Smart Suggestions & Automation
*   **Code Induction**: When creating a child account, the system suggests a `userCode` based on the parent's prefix and the next available sequence (e.g., `101` -> `10101`).
*   **Policy Inheritance**: New child accounts automatically inherit `Classification`, `Balance Nature`, and `Currency Policy` from their parent.

## 5. Approval & Custody Gates (Governance)
Accounts can be configured with specific validation gates:
*   **Verification Gate (`requiresApproval`)**: Forces a voucher into `PENDING` status if it touches this account, regardless of other settings (triggers `MARKED_ONLY` mode).
*   **Custody Gate (`requiresCustodyConfirmation`)**: Requires a specific user (Custodian) to acknowledge the transaction before it can be posted to the ledger.
*   **Custodian Mapping**: Each "Custody-Enabled" account must be assigned to a `custodianUserId`.

## 6. Validation & Safety (Technical)
*   **Circular Protection**: UI components MUST filter out an account's own descendants from the parent-selector dropdown.
*   **Infinite Loop Protection**: All tree-building algorithms must use a `Visited` set to break recursion if legacy circular data is encountered.
*   **Idempotency**: Initialization services (like `InitializeAccountingUseCase`) must be idempotent, checking for existing codes before creation.
