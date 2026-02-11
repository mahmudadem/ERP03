# 06 - Cash Flow Statement

- Added account cashFlowCategory field (placeholder) in Account entity for future tagging.
- Implemented Cash Flow (indirect) use case: computes net income from revenue/expense deltas, working capital change, cash movement (opening/closing from cash/bank accounts), net cash change; returns structured sections.
- Added `/tenant/accounting/reports/cash-flow` API with permission guard.
- Frontend: new CashFlowPage with date filters, sections, live data; router entry; API client call.
- Dashboard unaffected; prints basic layout; investing/financing placeholders at 0 for now.
- Tests: existing suites rerun (CostCenter, FiscalYear, CloseYearUseCase) — pass.
