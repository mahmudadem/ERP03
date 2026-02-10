# 02 - Account Statement Report

- Added ledger repository account statement query with opening balance and running balance computation (Firestore implementation + interface).
- Added GetAccountStatement use case, API endpoint, and route guarded by `accounting.reports.generalLedger.view`.
- Added backend unit tests for account statement calculations and refreshed balance sheet test compatibility.
- Exposed frontend API, built Account Statement page with account/date filters, running balance, voucher links, totals/print, and navigation link.
- Tests: `cd backend && npm test -- --testPathPatterns GetAccountStatementUseCase`, `cd backend && npm test -- --testPathPatterns GetBalanceSheetUseCase`.
