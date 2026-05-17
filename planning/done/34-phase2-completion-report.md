# Phase 2 Completion Report — Accounting Consistency

Date: 2026-03-04
Plan: `1-TODO/34b-phase2-accounting-consistency.md`

## Scope Completed
Implemented all requested Phase 2 fixes (D, L, A) in backend only, keeping repository pattern and SQL-migration-ready boundaries intact.

## Changes Implemented

### 1) Fix D — P&L source-of-truth moved to ledger
- Updated `GetProfitAndLossUseCase` to depend on `ILedgerRepository` (not voucher repository).
- Replaced voucher-line aggregation with trial-balance delta logic:
  - opening TB at day-before `fromDate`
  - closing TB at `toDate`
  - period movement = closing cumulative - opening cumulative
- Revenue formula: `periodCredit - periodDebit`
- Expense formula: `periodDebit - periodCredit`
- Preserved `ProfitAndLossOutput` interface shape.

Files:
- `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts`
- `backend/src/api/controllers/accounting/ReportingController.ts` (injects `diContainer.ledgerRepository`)

### 2) Fix L — Account `isUsed()` correctness
- Rewrote `isUsed(companyId, accountId)` in Firestore account repository:
  - Primary guard: indexed lookup in `ledger` collection by `accountId` with `limit(1)`
  - Secondary guard: scan embedded voucher `lines[]` in `vouchers` collection (limited batch)
- Removed broken logic that queried nonexistent voucher `lines` subcollections.

File:
- `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts`

### 3) Fix A — CC-only approval bypass
- In policy config provider, after merging defaults+stored config, `approvalRequired` is now derived as:
  - `financialApprovalEnabled || custodyConfirmationEnabled`
- Added clarifying default-config comment.
- No use-case-level workaround added; fix is centralized in config provider as required.

File:
- `backend/src/infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider.ts`

### 4) Test updates for P&L migration
- Updated P&L use-case test to mock `ILedgerRepository.getTrialBalance()` instead of voucher `findByDateRange()`.
- Assertions now validate opening/closing TB calls and TB-delta output math.

File:
- `backend/src/tests/application/reporting/use-cases/GetProfitAndLossUseCase.test.ts`

### 5) Verification compatibility fix
- Added missing `getForeignBalances` mock in `GetBalanceSheetUseCase.test.ts` to match current `ILedgerRepository` interface so required Jest pattern can run cleanly.

File:
- `backend/src/tests/application/accounting/use-cases/GetBalanceSheetUseCase.test.ts`

## Verification Results

### TypeScript
Command:
```bash
cd backend && npx tsc --noEmit
```
Result: PASS

### Jest (required patterns)
Note: current Jest CLI expects `--testPathPatterns` (plural).

1. Command:
```bash
cd backend && npx jest --testPathPatterns="GetProfitAndLossUseCase" --no-coverage
```
Result: PASS

2. Command:
```bash
cd backend && npx jest --testPathPatterns="GetBalanceSheet|GetCashFlow" --no-coverage
```
Result: PASS

3. Command:
```bash
cd backend && npx jest --testPathPatterns="AccountUseCases" --no-coverage
```
Result: PASS

## Acceptance Criteria Mapping
- `GetProfitAndLossUseCase` uses `ILedgerRepository`: DONE
- P&L uses TB-delta (closing - opening): DONE
- ReportingController passes `ledgerRepository` for P&L: DONE
- `isUsed()` checks ledger first: DONE
- `isUsed()` checks embedded voucher lines second: DONE
- `approvalRequired = FA || CC`: DONE
- CC-only mode no longer qualifies as `approvalRequired=false` in config path: DONE
- `npx tsc --noEmit`: PASS
- Referenced tests: PASS
