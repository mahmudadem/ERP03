# 35 - Trading Account Readiness Completion Report

## Scope Completed
Implemented the `plSubgroup` readiness feature described in `1-TODO/35-trading-account-readiness.md` using the same end-to-end pattern as `cashFlowCategory`, across backend and frontend.

## What Was Changed

### Backend
- Added `PlSubgroup` union type and `plSubgroup` field support in Account domain entity lifecycle:
  - `backend/src/domain/accounting/entities/Account.ts`
  - Added to props, class field, constructor defaulting, `toJSON`, `fromJSON`, mutable-fields list, and classification-aware validation.
- Re-exported `PlSubgroup` in model barrel:
  - `backend/src/domain/accounting/models/Account.ts`
- Extended repository contract inputs:
  - `backend/src/repository/interfaces/accounting/IAccountRepository.ts`
  - Added `plSubgroup?: PlSubgroup | null` to `NewAccountInput` and `UpdateAccountInput`.
- Wired use cases to accept/persist `plSubgroup`:
  - `backend/src/application/accounting/use-cases/accounts/CreateAccountUseCase.ts`
  - `backend/src/application/accounting/use-cases/accounts/UpdateAccountUseCase.ts`
- Exposed field in API DTO/request mapping:
  - `backend/src/api/dtos/AccountingDTOs.ts`
- Persisted field in Firestore account repository create/update flow:
  - `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts`
- Added `plSubgroup` annotations to obvious Revenue/Expense COA template accounts:
  - `backend/src/application/accounting/templates/COATemplates.ts`
  - `backend/src/application/accounting/templates/IndustryCOATemplates.ts`

### Frontend
- Added `PlSubgroup` type and field support:
  - `frontend/src/api/accounting/index.ts`
  - Added to `Account`, `NewAccountInput`, `UpdateAccountInput`.
- Updated Account form to manage/display `plSubgroup`:
  - `frontend/src/modules/accounting/components/AccountForm.tsx`
  - Added subgroup options, state, payload mapping, conditional dropdown (Revenue/Expense only), and auto-clear when classification becomes non-P&L.

## Validation/Acceptance Alignment
- `PlSubgroup` values implemented:
  - `SALES | COST_OF_SALES | OPERATING_EXPENSES | OTHER_REVENUE | OTHER_EXPENSES`
- Validation rules implemented in Account entity:
  - Revenue allows only `SALES`/`OTHER_REVENUE`
  - Expense allows only `COST_OF_SALES`/`OPERATING_EXPENSES`/`OTHER_EXPENSES`
  - Asset/Liability/Equity reject any `plSubgroup`
- Field is optional and defaults to `null` when not provided.

## Required Verification Results
All required checks passed:

1. `cd backend && npx tsc --noEmit` -> PASS
2. `cd frontend && npx tsc --noEmit` -> PASS
3. `cd backend && npx jest --testPathPatterns="Account.test|AccountUseCases" --no-coverage` -> PASS
   - Test suites: 2 passed
   - Tests: 47 passed

## Notes
- Implementation followed SQL-migration-ready layering constraints:
  - No Firestore-specific behavior added outside infrastructure layer.
- Trading Account report itself was not implemented in this task (data-readiness only), as intended by the plan.
