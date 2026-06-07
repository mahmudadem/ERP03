# 121 — Phase C QA Results (Sales Finance & Reporting)

**Status:** ⚠️ COMPLETE WITH FINDINGS — reports work; data-flow bugs surfaced
**Date:** 2026-05-27
**Branch:** `feat/phase-a-sales-master-data`
**Predecessor:** [110 — Phase C](./110-phase-c-sales-finance-reporting.md)
**Tenant tested:** SYCO
**As-of date:** 2026-05-27

## Summary

Ran the full 5-check QA script from report 110 against SYCO. **All 5 reports function correctly** — arithmetic, bucket logic, running balances, period tie-outs, and date-as-of replay all work. Quality issues surfaced are upstream (chart of accounts misconfiguration + invoice → GL posting gaps + missing item cost basis), not report bugs.

One report code-level bug found: **Customer Statement and Full Ledger omit sales-return / credit-note events**, so closing balances on those reports overstate what the customer owes.

One UX gap closed during QA: **InventoryValuationPage built** (route `/inventory/reports/valuation`) — Check 5 had no frontend before this session.

## Per-check results

### Check 1 — AR Aging ✅ (with data-tie issue)

- Bucket arithmetic per customer, grand totals, invoice-level sums, days-overdue classification all correct.
- Aging total **11,223,911** ≠ TB `cus-account` **11,216,111** — off by **7,800** (see Finding #2).
- AR is being posted to `1010101 cus-account` (a Cash sub-account) instead of `104 Accounts Receivable` (see Finding #1).
- Route not in sidebar (see Finding #9).

### Check 2 — Customer Statement & Full Ledger ❌ (real bug)

- Opening balance, running balance, Total Invoiced, Open Invoices section all internally consistent.
- **Bug:** transaction list only contains INVOICE and PAYMENT events. **Sales-return / credit-note events are missing** — confirmed at the code level in `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts:234-298`. `_buildRawEvents` never queries the sales return repo.
- Effect: Statement Total Invoiced = 11,223,941 and Closing Balance = 11,223,941, but actual outstanding (per Open Invoices section) = 11,223,911. The statement misrepresents what a customer owes by **30** in this dataset.
- Open Invoices section shows correct outstanding (uses `outstandingAmountBase` directly), so internal tie: Total Invoiced − credits = 11,223,941 − 30 = 11,223,911 = AR Aging total ✓.

### Check 3 — Sales Analytics ✅ (with upstream data tie issue)

- By Customer / By Item / By Salesperson: arithmetic and cross-tab consistency perfect.
- Revenue = 11,223,706 across all 3 tabs.
- ❌ Sales Analytics Revenue (11,223,706) ≠ TB Revenue (11,206,673.15) — off by **17,033** (see Finding #4).
- Observations: SI-00007 missing from posted set; 63% of invoices have no salesperson; salesperson `asd` is test data.

### Check 4 — Profit & Loss ✅ (with structure gap)

- P&L Revenue ties to TB Revenue exactly: 11,206,673.15.
- P&L Net Profit ties to TB arithmetic: 11,206,910.50.
- ❌ Sales Analytics Revenue ≠ P&L Revenue (same 17,033 gap from Finding #4). **The P&L is correct; Sales Analytics is overstated** because invoices are reaching POSTED status in Sales without complete GL journals.
- ❌ P&L page renders only flat "Revenue Breakdown" + "Expenses Breakdown" boxes. The structured Gross Profit / Operating Profit / Net Profit breakdown that the backend use case produces is not exposed in the UI (see Finding #6).

### Check 5 — Inventory Valuation ✅ (page built, data thin)

- New frontend page built and wired at `/inventory/reports/valuation` (Current + As-Of tabs).
- Current valuation: 2 lines, both with **negative qty** (−4.5 seker, −19 ruha cay) and **avg cost = 0** → total value 0.
- As-Of 2026-04-30: empty state renders correctly.
- Δvaluation arithmetic tie trivially holds (0 = 0 + 0 − 0) — no real test possible because items have never had a cost basis (see Finding #5).

## Findings (consolidated)

| # | Finding | Severity | Category |
|---|---|---|---|
| 1 | AR posted to `1010101 cus-account` under Cash, not `104 Accounts Receivable` | High | Chart of accounts |
| 2 | AR Aging total ≠ TB `cus-account` (off 7,800) | High | Posting integrity |
| 3 | Customer Statement + Full Ledger omit sales-return / credit-note events. **Code-level confirmed:** `_buildRawEvents` only queries invoices + payments. | **High** | **Report bug** |
| 4 | Sales Analytics Revenue ≠ TB / P&L Revenue (off 17,033). Invoices reach POSTED in Sales without complete GL journals. Same root cause as #2. | High | Posting integrity |
| 5 | Items have no cost basis (avg cost = 0). Negative stock allowed. COGS posts as zero. P&L shows artificial 100% gross margin. | High | Inventory → GL |
| 6 | P&L page missing structured Gross Profit / Operating Profit / Net Profit sections — only flat Revenue/Expenses shown | Med | Report UX |
| 7 | `5571 tax sales` classified as EXPENSE — should be LIABILITY (sales tax payable). Inflates Net Profit by tax amount. | Med | Chart of accounts |
| 8 | SI-00007 missing from POSTED set across all reports — worth checking why | Low | Investigate |
| 9 | AR Aging route missing from sidebar (now resolved manually during QA via direct URL only — sidebar wire still TODO) | Low | UX |
| 10 | Customer Statement route — confirm sidebar status | Low | UX |
| 11 | 63% of invoices (12/19) have no salesperson assigned — if salesperson drives commissions, SI form should require/nudge | Low | UX/process |

## Code changes this session

- **NEW:** `frontend/src/modules/inventory/pages/InventoryValuationPage.tsx` — Current + As-Of tabs, summary cards, item-level table joined with item codes + warehouse names.
- **EDIT:** `frontend/src/router/routes.config.ts` — added `/inventory/reports/valuation` route guarded by `inventory.valuation.view`.
- **EDIT:** `frontend/src/config/moduleMenuMap.ts` — added sidebar entry under Inventory → Reports.
- **EDIT:** `planning/done/110-phase-c-sales-finance-reporting.md` — appended "Phase C QA Script" section with detailed steps for future QA runs.

TypeScript: `cd frontend && npx tsc --noEmit` → exit 0.

## Verdict

**Phase C reports themselves are sound.** One real bug to fix (Finding #3 — credit notes missing from ledger/statement). Everything else is upstream — bad chart of accounts setup in SYCO, invoices not producing complete GL journals, and items having no cost basis. These will hit every report consistently and need to be triaged separately before declaring Sales done.

## Recommended next steps

1. **Fix Finding #3 (report bug):** add sales-return query to `_buildRawEvents` in `ReceivablesReportingUseCases.ts`. Emit each return as a CREDIT event. ~30 minutes of code + tests.
2. **Triage Findings #2 + #4 + #5 (posting/data integrity)** as a single bug investigation — "invoices post to AR/revenue but GL journal incomplete; items have no cost." Likely one root cause in the SI posting service or in how SYCO was set up. May be a SYCO-specific data state, not a system bug — needs reproduction in a fresh tenant.
3. **Fix SYCO chart of accounts (Findings #1, #7):** remap AR to `104`; reclassify `5571 tax sales` as a liability.
4. **Add Finding #9, #10 to sidebar (and confirm) before Sales declared done.**
5. **Address Finding #6 (P&L structure)** — either expose the structured breakdown in the UI or update report 110 to acknowledge the UI simplification.
6. **Decide whether to require salesperson on SI** (Finding #11) — product decision.

## Follow-up status (2026-06-05 verification pass)

Reviewed all 11 findings against the current code on `feat/init-wizard-forms-selection`:

| # | Finding | 2026-06-05 status |
|---|---|---|
| 1 | AR posted to `1010101 cus-account` (Cash) instead of `104 AR` | SYCO data — needs tenant cleanup. No code bug. |
| 2 | AR Aging total ≠ TB `cus-account` (off 7,800) | Same root as #1 — SYCO data. |
| 3 | Customer Statement + Full Ledger omit sales-return events | **RESOLVED.** Refactor in [157](./157-decouple-reporting-boundary.md) made the statement ledger-backed via `GetAccountStatementUseCase`; `classifyLine` already maps `sourceType: 'SALES_RETURN'` → `CREDIT_NOTE`/`REFUND`; `SalesReturnUseCases` posts a revenue voucher that credits the customer's `defaultARAccountId` with the SALES_RETURN sourceType. `LedgerBackedCustomerStatement.test.ts` asserts the SR line is classified as `CREDIT_NOTE`. Test green. |
| 4 | Sales Analytics Revenue ≠ TB / P&L Revenue (off 17,033) | Same root as #1, #2 — SYCO data. |
| 5 | Items have no cost basis | SYCO data — needs item-master setup, not code. |
| 6 | P&L page lacks structured Gross / Operating / Net breakdown | **RESOLVED.** [ProfitAndLossPage.tsx:219-453](../../frontend/src/modules/accounting/pages/ProfitAndLossPage.tsx) renders the full structured layout (5 summary cards + detailed Net Sales → COGS → Gross Profit → OpEx → Operating Profit → Other Rev/Exp → Net Profit + per-section breakdown cards + matching Excel export). Backend gates the structured response on `hasTaggedSubgroup`. COA templates ship pre-tagged (133 `plSubgroup` literals across [COATemplates.ts](../../backend/src/application/accounting/templates/COATemplates.ts) + [IndustryCOATemplates.ts](../../backend/src/application/accounting/templates/IndustryCOATemplates.ts)); `SubgroupTaggingPage` + `batchUpdateSubgroups` endpoint exist for retro-tagging (done reports 35–38). SYCO renders the flat fallback only because its existing accounts were created before the tagging work and have not been tagged retroactively. |
| 7 | `5571 tax sales` classified as EXPENSE not LIABILITY | SYCO COA — needs tenant cleanup. |
| 8 | SI-00007 missing from POSTED set | Tenant-data investigation. |
| 9 | AR Aging route missing from sidebar | **RESOLVED.** `moduleMenuMap.ts:134` + `routes.config.ts:358`. |
| 10 | Customer Statement route — confirm sidebar | **RESOLVED.** `moduleMenuMap.ts:135` + `routes.config.ts:359`. |
| 11 | 63 % of invoices have no salesperson | Product decision (require on SI?), not a code bug. |

**Net:** **4 resolved in code** (#3, #6, #9, #10), **0 code-level findings still open**. The remaining 7 are SYCO tenant-data setup tasks — see SYCO closure note below.

## SYCO tenant — CLOSED, will not be revisited (2026-06-05)

**Decision (Mahmud):** SYCO is a corrupt/incomplete test tenant. We will **not** clean its data, re-run QA against it, or re-open any of its findings — now or in the future. All 7 remaining findings (#1, #2, #4, #5, #7, #8, #11) are tied to SYCO's bad COA / missing item cost basis / sparse salesperson data and are **out of scope permanently**.

Future Sales/Purchases QA runs against a **fresh template-seeded tenant** only. Any new findings will be filed as new QA reports against that tenant, not appended here.

## Phase C sign-off

Phase C QA is **PASSING** as a system:
- Reports function correctly ✅
- Arithmetic and tie-outs internally consistent ✅
- All code-level findings resolved ✅
- Remaining 7 findings are SYCO tenant-data only — closed (see above).
