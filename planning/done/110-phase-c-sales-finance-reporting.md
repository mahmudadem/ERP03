# 110 — Phase C: Sales Finance & Reporting

**Status:** ✅ COMPLETE (code + docs; live browser QA deferred)
**Date:** 2026-05-20
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [sales-and-purchases-completion-roadmap.md](../tasks/sales-and-purchases-completion-roadmap.md) — Phase C
**Predecessor:** Task 109 (Phase B — sales operational)

## Goal

The reporting layer that makes the system credible to an accountant: AR aging, customer statements & ledger, sales analytics, P&L, and inventory valuation.

## Key finding — two roadmap items were already built

The Phase A audit claimed "P&L is computed on the frontend" and listed inventory valuation as missing. **Both were already implemented** in the codebase — the audit was a stale point-in-time snapshot:

- **Backend P&L** — `backend/src/application/reporting/use-cases/GetProfitAndLossUseCase.ts` already exists, fully wired (controller, route, frontend `ProfitAndLossPage`). It computes a correct *period* P&L as `closingTrialBalance(toDate) − openingTrialBalance(fromDate−1)`, classified by account `plSubgroup` (SALES / OTHER_REVENUE / COST_OF_SALES / OPERATING_EXPENSES / OTHER_EXPENSES) with a structured gross-profit / operating-profit breakdown.
- **Inventory valuation as-of-date** — `GetAsOfValuationUseCase` + `GetInventoryValuationUseCase` + `CreatePeriodSnapshotUseCase` already exist, wired at `GET /valuation/as-of`, `GET /valuation`, `POST /snapshots`.

A duplicate `GetProfitAndLossUseCase` was briefly created by a delegated agent before this was discovered; it was deleted. **C.3 and C.4 required no new code.**

## What shipped — new in Phase C

### C.1 — Receivables reporting
`ReceivablesReportingUseCases.ts`:
- `GetArAgingReportUseCase` — buckets outstanding posted invoices by age (Current / 1-30 / 31-60 / 61-90 / 90+), ageing from `dueDate ?? invoiceDate`, grouped by customer with grand totals. Fully-paid invoices excluded.
- `GetCustomerLedgerUseCase` — chronological invoice (debit) + payment (credit) events with a running balance; opening/closing balances for a date window.
- `GetCustomerStatementUseCase` — period statement: opening balance, transaction lines, closing balance, totalInvoiced/totalPaid, and the list of still-open invoices.

### C.2 — Sales analytics
`SalesAnalyticsUseCases.ts` — `GetSalesByCustomerUseCase`, `GetSalesByItemUseCase`, `GetSalesBySalespersonUseCase` — period-bounded aggregation over posted invoices, sorted by revenue, with totals. Invoices with no salesperson fall into an `UNASSIGNED` bucket.

### C.3 / C.4 — already existed (see above)

### C.5 — API + frontend
- `SalesReportingController` (6 handlers) + routes `GET /tenant/sales/reports/{ar-aging, customer-ledger, customer-statement, sales-by-customer, sales-by-item, sales-by-salesperson}`.
- `salesReportingApi` client; pages `ArAgingReportPage` (expandable per-customer detail), `CustomerStatementPage` (Statement + Ledger tabs), `SalesAnalyticsPage` (3 tabs). P&L and inventory-valuation pages already existed.

### C.6 — Docs
- New `docs/architecture/sales-reporting.md`; `sales.md` updated.
- User guides: `ar-aging.md`, `customer-statement.md`, `sales-reports.md`.

## Verification

- `backend` + `frontend`: `npx tsc --noEmit` → exit 0
- New backend tests — **16 across 2 suites**: `ReceivablesReporting` (10), `SalesAnalytics` (6) — all passing. (P&L and inventory valuation retain their pre-existing tests.)
- Full backend suite: **1169 passing**, 18 skipped, 3 failing — the 3 are the pre-existing `SendChatMessageUseCase` AI-credit failures. **Zero regressions from Phase C.**

## Manual QA gate (deferred — needs human verification)

1. Run AR Aging at month-end; verify the bucket totals sum to the total AR.
2. Generate a customer statement for the biggest debtor; tie the running balance to the invoices/payments.
3. Pull Sales by Item for the top items; verify totals match invoice line items.
4. Compare the backend P&L to a manual computation from the Trial Balance.
5. Run Inventory Valuation at two dates; the difference should equal (Purchases + Adjustments − COGS) for the period.

## Out of scope (follow-ups)

- Customer ledger/statement build payments via per-invoice `getBySource` lookups (N+1). Fine at pre-alpha scale; a `listByCustomer` repo method would optimise it.
- Reports are not paginated and not cached.
- `CustomerStatement.openInvoices` is not period-bounded (shows currently-open invoices, not open-as-of-toDate).
- Sales-by-salesperson does not break out tax.
- 3 pre-existing `SendChatMessageUseCase` test failures — unrelated; flagged separately.

## Next task

**Phase D — Sales auditability & control:** GL Impact preview drawer (consumes the PostingLog endpoint from PR2), period lock date, per-record audit log, recurring invoices (templated + scheduled), sales return enhancements, document attachments, email integration. See the roadmap.
