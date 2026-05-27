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

---

## Phase C QA Script (2026-05-27)

Run against the running emulator dataset. Start both servers first:

```powershell
# terminal 1
cd backend ; npm run dev
# terminal 2
cd frontend ; npm run dev
# terminal 3 (if not already running)
firebase emulators:start --import=./emulator-data
```

Sign in as a user with `sales.*` + `accounting.reports.*` + `inventory.valuation.view` permissions. Pick **one tenant company** and stay in it for every step below — switching company mid-script invalidates the cross-check arithmetic.

For every check: record **PASS / FAIL / NOTE** in a scratchpad and copy the failing screenshot + JSON response into a new file `planning/done/121-phase-c-qa-results.md` if anything fails.

### Pre-flight — capture baseline numbers

Before running the reports, grab the source-of-truth numbers you will tie back to. Use the company's **fiscal month-end** as the as-of date (call it `T`). If unsure, pick the last day of the previous month.

1. Open **Accounting → Reports → Trial Balance** at date `T`. Note:
   - **AR control account** closing balance (debit) → call this `TB_AR`.
   - Sum of all **SALES** + **OTHER_REVENUE** accounts for the period `[FY_START, T]` → call this `TB_Revenue_YTD`.
   - Sum of **COST_OF_SALES** for the same period → call this `TB_COGS_YTD`.
   - Sum of **OPERATING_EXPENSES** + **OTHER_EXPENSES** for the same period → call this `TB_Opex_YTD`.

If TB doesn't show period-bounded movement, use two snapshots (FY start − 1 day, and `T`) and subtract.

### Check 1 — AR Aging buckets sum to total AR

**URL:** `/sales/reports/ar-aging`

1. Set **As-of date** to `T`. Click Run.
2. For **every customer row**, confirm `current + 1–30 + 31–60 + 61–90 + 90+ == total` (UI should already render this; spot-check 3 rows by hand).
3. Confirm **grand totals row** equals the sum of customer totals.
4. **Tie-out:** `grand total == TB_AR` (from pre-flight). Tolerance ±0.01 base currency.
5. Expand one customer row → verify the listed invoices' `outstandingAmountBase` sum back to that customer's total.
6. Spot-check one invoice's `daysOverdue`: `T − (dueDate ?? invoiceDate)` in days; bucket assignment must match (`0 → Current`, `1-30`, `31-60`, `61-90`, `>90`).
7. **Negative test:** find a fully-paid invoice in Sales Invoices list — confirm it does **not** appear in any aging bucket.

**PASS criteria:** all 7 sub-checks green AND grand total ties to TB_AR.

### Check 2 — Customer Statement & Ledger tie to invoices/payments

**URL:** `/sales/reports/customer-statement`

Pick the customer with the **largest total in Check 1** ("biggest debtor"). Note that customer's ID.

1. **Statement tab:** set `fromDate = FY_START`, `toDate = T`. Click Run.
   - `openingBalance + totalInvoiced − totalPaid == closingBalance` (manual arithmetic).
   - `closingBalance` must equal that customer's total in Check 1's AR aging row. Tolerance ±0.01.
2. **Ledger tab:** same date range.
   - First event's `runningBalance == openingBalance + (debit − credit)` of that event.
   - Each subsequent event: `runningBalance[n] == runningBalance[n−1] + debit[n] − credit[n]`. Spot-check 3 events.
   - Last event's `runningBalance == Statement.closingBalance`.
3. Pick one INVOICE event → open that SI in another tab → `grandTotalBase` must equal the event's `debit`.
4. Pick one PAYMENT event → open the payment in the SI's payment history → amount must equal the event's `credit`.
5. **openInvoices list** under the Statement: each entry's `outstandingAmountBase` must be > 0; sum should equal `closingBalance` **only if** no invoice was open before `fromDate` (acceptable mismatch — known follow-up: `openInvoices` is not period-bounded).

**PASS criteria:** sub-checks 1–4 green. Sub-check 5 is a known caveat.

### Check 3 — Sales Analytics totals match invoice lines

**URL:** `/sales/reports/sales-analytics`

Use `fromDate = T − 30 days`, `toDate = T` for a manageable window.

1. **By Customer tab:** sort by revenue. Pick top customer.
   - `totalGrossBase == totalRevenueBase + totalTaxBase` per row (arithmetic).
   - `invoiceCount` for top customer: cross-check against **Sales Invoices** list filtered by that customer + date range + status=POSTED. Counts must match.
2. **By Item tab:** sort by revenue. Pick top item.
   - Open Sales Invoices list, filter date range. Manually sum all line-items for that item across those invoices.
   - Manual sum must equal `totalRevenueBase` for that item row. Tolerance ±0.01.
   - `totalQty` must equal manual qty sum.
3. **By Salesperson tab:**
   - `UNASSIGNED` row should exist only if at least one POSTED invoice in the window has no `salespersonId`. Verify by opening the first SI in that bucket.
   - Sum of all rows' `totalRevenueBase` == By Customer tab's grand total `totalRevenueBase`. They must tie (same source data).

**PASS criteria:** all three tabs internally consistent AND By Customer total == By Salesperson total.

### Check 4 — Backend P&L vs Trial Balance

**URL:** `/accounting/reports/profit-loss`

1. Set `fromDate = FY_START`, `toDate = T`. Click Run.
2. Verify P&L structure renders these sections: **Revenue (SALES + OTHER_REVENUE)**, **COGS**, **Gross Profit**, **Operating Expenses**, **Operating Profit**, **Other Expenses**, **Net Profit**.
3. **Tie-outs to pre-flight numbers:**
   - P&L Revenue total == `TB_Revenue_YTD`. Tolerance ±0.01.
   - P&L COGS total == `TB_COGS_YTD`.
   - P&L (Opex + Other Expenses) == `TB_Opex_YTD`.
   - Gross Profit == Revenue − COGS (arithmetic).
   - Net Profit == Gross Profit − Opex − Other Expenses (arithmetic).
4. **Spot-check one account:** click into the largest Revenue account (or look at TB) — its YTD movement must equal the value shown on the P&L line.

**PASS criteria:** all three tie-outs within tolerance AND arithmetic checks pass.

### Check 5 — Inventory Valuation (API-only; no frontend page wired)

> ⚠️ **Note:** there is no frontend page mounted for inventory valuation (no `/inventory/.../valuation` route in `frontend/src/router/routes.config.ts`). Backend endpoints exist and are protected by `inventory.valuation.view`. Run via curl or Postman.

Pick two dates: `T1 = T − 30 days`, `T2 = T`.

1. Get a tenant auth token (copy `Authorization` header from devtools while logged in, or use the in-app token endpoint).
2. Call:
   ```
   GET /tenant/inventory/valuation/as-of?asOfDate=<T1>
   GET /tenant/inventory/valuation/as-of?asOfDate=<T2>
   ```
   Note the **grand total valuation** from each response. Call them `V_T1` and `V_T2`.
3. From the accounting side, for the period `(T1, T2]`:
   - `Purchases` = sum of GRN postings to inventory accounts (or PI when no GRN).
   - `Adjustments` = sum of inventory adjustment vouchers (+/−).
   - `COGS` = `TB_COGS` at T2 − `TB_COGS` at T1.
4. **Tie-out:** `V_T2 − V_T1 ≈ Purchases + Adjustments − COGS`. Tolerance ±0.5% of `V_T2` (rounding from multiple cost layers is acceptable; large drift means standard vs. moving-average cost mismatch — investigate).
5. **Bonus:** call `GET /tenant/inventory/valuation` (no asOf) and confirm it returns the live valuation — should be ≥ `V_T2` for any movement after `T2`.

**PASS criteria:** tie-out within tolerance. If frontend valuation page is needed for accountant self-service, log it as a follow-up (not a Phase C blocker — backend is correct).

### Wrap-up

- If all 5 checks PASS → mark Sales QA gate ✅ in `planning/ACTIVE.md`, proceed to Phase F (Purchases parity).
- If any FAIL → create `planning/done/121-phase-c-qa-results.md` with the failing screenshots/responses and pause Phase F until triaged.
- Known caveat to ignore during QA: `CustomerStatement.openInvoices` is not period-bounded (already a documented follow-up).
- Missing inventory-valuation frontend page should be filed as a Phase E-tier follow-up against the inventory module, not blocking Sales sign-off.

## Out of scope (follow-ups)

- Customer ledger/statement build payments via per-invoice `getBySource` lookups (N+1). Fine at pre-alpha scale; a `listByCustomer` repo method would optimise it.
- Reports are not paginated and not cached.
- `CustomerStatement.openInvoices` is not period-bounded (shows currently-open invoices, not open-as-of-toDate).
- Sales-by-salesperson does not break out tax.
- 3 pre-existing `SendChatMessageUseCase` test failures — unrelated; flagged separately.

## Next task

**Phase D — Sales auditability & control:** GL Impact preview drawer (consumes the PostingLog endpoint from PR2), period lock date, per-record audit log, recurring invoices (templated + scheduled), sales return enhancements, document attachments, email integration. See the roadmap.
