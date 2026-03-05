# 36 - Report Enhancements Completion Report

## Scope Implemented
Implemented all plan parts from `1-TODO/36-report-enhancements.md` in order (A -> B -> C -> D -> E), including backend + frontend updates.

## Part A - Added `equitySubgroup` End-to-End

### Backend entity and contracts
- Added `EquitySubgroup` type and field lifecycle to Account entity:
  - `backend/src/domain/accounting/entities/Account.ts`
  - Added to `AccountProps`, class fields, constructor defaulting, `toJSON()`, `fromJSON()`, `getMutableFields()`, and validation (`equitySubgroup` only valid for `EQUITY`).
- Re-exported `EquitySubgroup`:
  - `backend/src/domain/accounting/models/Account.ts`
- Extended repository input contracts:
  - `backend/src/repository/interfaces/accounting/IAccountRepository.ts`
  - Added `equitySubgroup?: EquitySubgroup | null` to `NewAccountInput` and `UpdateAccountInput`.
- Wired create/update use cases:
  - `backend/src/application/accounting/use-cases/accounts/CreateAccountUseCase.ts`
  - `backend/src/application/accounting/use-cases/accounts/UpdateAccountUseCase.ts`
- Exposed in API DTOs + mapper:
  - `backend/src/api/dtos/AccountingDTOs.ts`
- Persisted in Firestore create/update paths:
  - `backend/src/infrastructure/firestore/repositories/accounting/FirestoreAccountRepository.ts`

### Frontend
- Added `EquitySubgroup` type and field support:
  - `frontend/src/api/accounting/index.ts`
- Added Equity Subgroup UI in account form:
  - `frontend/src/modules/accounting/components/AccountForm.tsx`
  - Added options/state/payload mapping, EQUITY-only dropdown, and auto-clear when classification is not EQUITY.

## Part B - COA Template Equity Tagging
- Tagged equity subgroup in Standard/Simplified templates:
  - `backend/src/application/accounting/templates/COATemplates.ts`
  - `301`, `30101` -> `CONTRIBUTED_CAPITAL`
  - `302`, `30201` -> `RETAINED_EARNINGS`
  - Simplified `301` -> `CONTRIBUTED_CAPITAL`, `302` -> `RETAINED_EARNINGS`
- Tagged equity subgroup in all industry templates:
  - `backend/src/application/accounting/templates/IndustryCOATemplates.ts`
  - Manufacturing/Services/Retail: `301` -> `CONTRIBUTED_CAPITAL`, `302` -> `RETAINED_EARNINGS`

## Part C - Balance Sheet Retained Earnings Fix
- Replaced name-only retained earnings detection with field-first logic while preserving fallback:
  - `backend/src/application/accounting/use-cases/LedgerUseCases.ts`
  - `isRetainedEarningsAccount` now checks `acc.equitySubgroup === 'RETAINED_EARNINGS'` first, then falls back to legacy hints (`retained earnings`, `retained earning`, `accumulated profit`).

## Part D - Enhanced P&L (Backward-Compatible)
- Extended output with optional additive field:
  - `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts`
  - Added optional `structured` object without changing existing fields.
- Implemented subgroup-driven structured totals and breakdown arrays:
  - `netSales`, `costOfSales`, `grossProfit`, `operatingExpenses`, `operatingProfit`, `otherRevenue`, `otherExpenses`
  - account breakdown arrays for SALES/COGS/OPEX/OTHER/unclassified.
- `structured` is only populated when at least one P&L account has non-null `plSubgroup`.

## Part E - Trading Account Use Case + API
- Added new standalone use case:
  - `backend/src/application/reporting/use-cases/GetTradingAccountUseCase.ts` (NEW)
  - Uses TB-delta pattern, permission check, date normalization.
  - Returns `hasData: false` with zeroed output when no SALES/COGS tagged accounts exist.
- Added controller endpoint:
  - `backend/src/api/controllers/accounting/ReportingController.ts`
  - New `tradingAccount` method.
- Added route:
  - `backend/src/api/routes/accounting.routes.ts`
  - `GET /reports/trading-account`
- Added permission:
  - `backend/src/config/PermissionCatalog.ts`
  - `accounting.reports.tradingAccount.view`

## Verification Results
All required checks passed:

1. `cd backend && npx tsc --noEmit` -> PASS
2. `cd frontend && npx tsc --noEmit` -> PASS
3. `cd backend && npx jest --testPathPatterns="Account.test|AccountUseCases" --no-coverage` -> PASS (2 suites, 47 tests)
4. `cd backend && npx jest --testPathPatterns="GetBalanceSheet" --no-coverage` -> PASS (1 suite, 1 test)
5. `cd backend && npx jest --testPathPatterns="GetProfitAndLossUseCase" --no-coverage` -> PASS (1 suite, 2 tests)

## Notes
- Maintained SQL-migration-ready layering: no Firestore-specific logic was introduced in domain/application layers.
- Existing `ProfitAndLossOutput` fields were preserved; `structured` is additive and optional.
- Project route file in this repository is `backend/src/api/routes/accounting.routes.ts` (no separate `tenant.accounting.routes.ts` file present).
