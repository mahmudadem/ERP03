# 11 — Aging Reports (Completed)

## Scope
Delivered AR/AP aging reports with backend computation and frontend UI, including drill-down to transactions and “as of” date control.

## What was built
- **Use case**: `AgingReportUseCase` buckets ledger entries into Current, 1–30, 31–60, 61–90, 91–120, 120+ based on as-of date; supports AR (receivable) and AP (payable) modes.
- **API**: `GET /accounting/reports/aging?type=AR|AP&asOfDate=YYYY-MM-DD&accountId=optional`.
- **Selection logic**: Accounts filtered by role/classification (RECEIVABLE/ASSET for AR, PAYABLE/LIABILITY for AP).
- **Drill-down**: Each account row returns its aged transactions (amount, days outstanding).
- **Frontend**: New Aging Report page with AR/AP toggle, date picker, bucketed table, totals row, expandable transaction detail; route added.
- **Tests**: Jest unit test validates bucket assignment for sample entries.

## How to use
1) Go to **Accounting → Aging**.
2) Choose AR or AP and set the **As of** date, click **Load**.
3) Table shows bucketed amounts per account with totals; click a row to see underlying transactions.

## Notes & assumptions
- Outstanding amount derived from ledger entries; AR uses debit-positive, credit-negative; AP uses credit-positive, debit-negative.
- Buckets are inclusive of boundaries (1–30, 31–60, etc.). Zero/negative balances per account are skipped.
- Export/print not implemented yet; can be added by hooking into existing UI export patterns.

## Verification
- Automated: `npm test -- --runTestsByPath src/tests/application/accounting/use-cases/AgingReportUseCase.test.ts`
- Manual (suggested): Post sample receivable/payable vouchers, set an as-of date in the future, verify bucketed totals and drill-down match expectations.
