# 06 - Cash Flow Statement

- Implemented full Cash Flow Statement (indirect) with non-placeholder sections:
  - `operating`: net income + working capital + non-cash adjustments + residual reconciliation item (when needed).
  - `investing`: account-level movements inferred from explicit category or investing heuristics.
  - `financing`: account-level movements inferred from explicit category or financing heuristics.
- Added strict reconciliation so:
  - `openingCash + netCashChange = closingCash`
  - `operating.total + investing.total + financing.total = netCashChange`
- Added and wired account-level `cashFlowCategory` (`OPERATING | INVESTING | FINANCING`) across:
  - backend create/update use cases and Firestore repository persistence,
  - backend accounting DTO contracts,
  - frontend account API types and Account form UI selector.
- Added Cash Flow report link in accounting sidebar (`Reports > Cash Flow`) and translation keys.
- API endpoint remains:
  - `/tenant/accounting/reports/cash-flow` with `accounting.reports.cashFlow.view`.
- Added backend tests:
  - `GetCashFlowUseCase.test.ts` verifies section construction, reconciliation, and explicit category override.
