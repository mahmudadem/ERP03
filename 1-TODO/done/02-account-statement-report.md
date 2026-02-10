# 02 - Account Statement Report

- Added ledger repository account statement query with opening balance + running balances and base/account currency columns (Firestore implementation + interface).
- Added GetAccountStatement use case, API endpoint, and route guarded by `accounting.reports.generalLedger.view`.
- Fixed currency handling to prefer stored amount/baseAmount, avoid double conversion, and surface exchange rate per line; optional include-unposted support.
- Exposed frontend API and Account Statement page with filters, FX rate column, account/base columns, voucher links, totals/print, and navigation link.
- Tests: `cd backend && npm test -- --runTestsByPath src/tests/application/accounting/use-cases/GetAccountStatementUseCase.test.ts`, `cd backend && npm test -- --runTestsByPath src/tests/application/accounting/use-cases/GetBalanceSheetUseCase.test.ts`.
