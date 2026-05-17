# 10 — Budget Module (Completed)

## Scope
Added end-to-end budgeting: create/approve budgets with monthly breakdowns, compute budget vs actual variance, and basic UI to manage and compare budgets.

## What was built
- **Domain**: Budget entity with validation and BudgetLine structure.
- **Persistence**: FirestoreBudgetRepository; DI wired.
- **Use cases**: Create/Update/Approve budget; GetBudgetVsActual (pulls ledger actuals within fiscal year range).
- **API**: `GET/POST/PUT /accounting/budgets`, `POST /accounting/budgets/:id/approve`, `GET /accounting/reports/budget-vs-actual`.
- **Frontend**: Budget page (grid editor, totals, approve), Budget vs Actual report (variance and % with color cues), routes added.
- **Tests**: Unit tests for budget auto-match (existing) and new variance computation (`GetBudgetVsActualUseCase`).

## How to use
1) Go to Accounting → Budgets. Enter fiscalYearId, name, version, lines (accountId, optional costCenterId, monthly amounts). Save.
2) Approve when ready (status changes to APPROVED).
3) Budget vs Actual: open Accounting → Budget vs Actual, pick a budget. See budget/actual/variance per account; over-budget shown in red.

## Notes & assumptions
- Actuals summed from general ledger for the fiscal year date range; variance = actual − budget.
- No posting lock/blocks; this is planning only.
- CSV import not yet implemented on UI; grid entry supported.
- Alerts are visual (color) only; no notifications.

## Verification
- Automated: `npm test -- --runTestsByPath src/tests/application/accounting/use-cases/GetBudgetVsActualUseCase.test.ts`
- Manual (suggested): create a budget with two accounts, approve, post vouchers for those accounts within the fiscal year, then view Budget vs Actual to confirm variance calculations and coloring.
