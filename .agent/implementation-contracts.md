# Accounting Technical Implementation Contracts

This document defines the technical guardrails and service contracts for developers (and AI agents) working on the Accounting module.

## 1. Validation Contracts
### 1.1 Server-Side Validation
*   **Central Gate**: All use cases that mutate financial data (Vouchers, Ledger) MUST use the `VoucherValidationService.validateCore`.
*   **Account Checks**: Every ledger-impacting operation MUST validate account eligibility via `AccountValidationService.validateAccountById`.

### 1.2 UI Persistence Safety
*   **Dirty State Guard**: Any form with unsaved changes MUST trigger the `useUnsavedChanges` hook or equivalent window-level guard.
*   **Policy Refresh**: The UI MUST NOT assume a voucher is editable based on a local flag. It must periodically sync with `/tenant/accounting/policy-config`.

## 2. Data Consistency Guards
### 2.1 Hierarchy Integrity
*   **Circular Protection**: The `AccountRepository` and tree-building logic MUST implement infinite-loop protection using `Visited` sets.
*   **Deletion Policy**: Accounts with ledger entries (transactions) MUST be blocked from deletion. They should instead be marked `INACTIVE`.

### 2.2 Currency Precision
*   **Rounding Standard**: All currency calculations MUST use `roundMoney` or equivalent utility to ensure `MONEY_EPS` (0.000001) precision consistency.
*   **Invariant Check**: Debits and Credits must be checked for equality using a tolerance-based `moneyEquals` function, never strict `===`.

## 3. Audit Trail Requirements
*   **Metadata Tagging**: All vouchers must store `companyId`, `userId`, and `correlationId` in their metadata upon posting.
*   **Status Immutability**: Transitions to terminal states (`POSTED`, `CANCELLED`, `REVERSED`) must be one-way (immutable).

## 4. UI Rendering Conventions
*   **Classification Tags**: Use Indigo for `HEADER` and Emerald for `POSTING` accounts.
*   **Number Formatting**: Currency amounts in tables must be right-aligned and mono-spaced.
