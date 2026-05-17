# 12 — Multi-Company Consolidation (Completed)

## Scope
Enabled consolidation across multiple companies via company groups, consolidated trial balance computation with FX conversion, and a basic UI to view group totals.

## What was built
- **CompanyGroup** entity + Firestore repository; DI wiring.
- **Use case**: `GetConsolidatedTrialBalanceUseCase` sums member trial balances into a reporting currency (per group), using most recent FX rate per company if base currencies differ.
- **API**: Manage groups (`POST/GET /accounting/company-groups`) and fetch consolidated trial balance (`GET /accounting/reports/consolidated-trial-balance?groupId=&asOfDate=`).
- **Frontend**: Consolidated Trial Balance page with group selector and as-of date, plus routing; API client support for groups and consolidated TB.
- **Tests**: Jest unit test covers FX conversion and summation across two subsidiaries.

## How to use
1) Create a company group: POST `/tenant/accounting/company-groups` with `{ name, reportingCurrency, members:[{companyId}] }`.
2) Open **Accounting → Consolidated TB**, pick the group and date, click Load to view consolidated debit/credit/balance totals in the reporting currency.

## Notes & assumptions
- Only consolidated trial balance is provided; P&L/Balance Sheet can reuse the same pattern later.
- Inter-company eliminations and COA mapping are not yet implemented—this is a first iteration for summed balances.
- Uses latest available FX rate before as-of date for each subsidiary’s base currency → reporting currency.

## Verification
- Automated: `npm test -- --runTestsByPath src/tests/application/accounting/use-cases/GetConsolidatedTrialBalanceUseCase.test.ts`
- Manual (suggested): Create a group with USD reporting currency, add a EUR subsidiary with a rate, run consolidated TB and verify converted totals.
