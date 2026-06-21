# Task 247e — POS Phase 4: Reports, i18n Sweep & Documentation

**Prereq:** 247a–247d merged. Read [247-pos-module-epic.md](./247-pos-module-epic.md) §2.5 (reports rule) + §6 (DoD).
**Branch:** `feat/247e-pos-reports`
**Estimate:** 3–4 days
**Goal:** All POS reports shipped through `ReportContainer`, full en/ar/tr coverage, and Definition-of-Done docs for the whole module.

---

## Hard rule (CI-enforced by `frontend/scripts/check-reports.mjs`)
Every report page MUST use `<ReportContainer>` (`frontend/src/components/reports/ReportContainer.tsx`) AND its route MUST be in `frontend/src/config/moduleMenuMap.ts` under `pos` → `Reports`. Copy `frontend/src/modules/sales/pages/ArAgingReportPage.tsx` as the template (it shows the `initiator` filter component + `ReportContent` pattern, Excel/PDF/print wiring).

## Step 1 — Backend report use cases (`backend/src/application/pos/use-cases/PosReportingUseCases.ts`)
All read-only, `(companyId,…)`-scoped:
1. `GetPosZReportUseCase(companyId, shiftId)` — finalized close summary: opening float, sales by payment method, cash sales/refunds, pay-ins/outs, expected vs counted, over/short + voucher id, receipt count, gross/tax/net totals. (X report from 247b is the live twin; Z reads a CLOSED shift.)
2. `GetDailyPosSummaryUseCase(companyId, { date | dateFrom,dateTo, registerId? })` — receipts, gross, discount, tax, net, by register.
3. `GetPaymentMethodSummaryUseCase(companyId, { dateFrom,dateTo, registerId? })` — totals per method.
4. `GetCashierSalesSummaryUseCase(companyId, { dateFrom,dateTo })` — totals per cashier (group by shift.cashierUserId).
5. `GetCashOverShortReportUseCase(companyId, { dateFrom,dateTo })` — per closed shift over/short + voucher link.
6. `GetReceiptHistoryUseCase(companyId, { dateFrom,dateTo, customerId?, registerId?, status?, limit })` — paginated.
7. **Unsettled cost report** — POS-origin SIs with unsettled COGS already surface in the inventory **Unsettled Costs** report (`/inventory/reports/unsettled-costs`). Do NOT duplicate it; instead add a POS `Reports` menu link pointing there filtered by `source='pos'` IF that report supports the filter; otherwise add a thin POS view that calls the same data source. Confirm with the inventory report before building.

Data sources: POS receipts/returns/cash-movements repos + the linked SIs (via `salesInvoiceRepository`) for revenue/tax/COGS breakdown. Prefer reading the SI for financial figures (single source of truth) and the receipt for operational counts.

## Step 2 — Controller + routes
Add report methods to `PosController` (or a `PosReportingController`), all `permissionGuard('pos.reports.view')` except Z which may also allow `pos.terminal.access`:
```
router.get('/shifts/:id/z-report',          PosController.getZReport);
router.get('/reports/daily-summary',        PosController.getDailySummary);
router.get('/reports/payment-methods',      PosController.getPaymentMethodSummary);
router.get('/reports/cashier-sales',        PosController.getCashierSalesSummary);
router.get('/reports/cash-over-short',      PosController.getCashOverShort);
router.get('/reports/receipt-history',      PosController.getReceiptHistory);
```

## Step 3 — Frontend report pages (`frontend/src/modules/pos/pages/`)
One page each, all via `ReportContainer`, all accept `isWindow`:
`PosZReportPage`, `PosDailySummaryReportPage`, `PosPaymentMethodReportPage`, `PosCashierSalesReportPage`, `PosCashOverShortReportPage`, `PosReceiptHistoryReportPage`. Plus the X report page may move under Reports too (or stay on the Shift page). Use `DatePicker` for date filters; Excel/PDF/print come free from `ReportContainer`.

Add to `moduleMenuMap.ts`:
```ts
{
  label: 'Reports', icon: 'BarChart3',
  children: [
    { label: 'Z Report (by shift)', path: '/pos/reports/z',            permission: 'pos.reports.view', icon: 'ReceiptText' },
    { label: 'Daily Summary',       path: '/pos/reports/daily',        permission: 'pos.reports.view', icon: 'CalendarDays' },
    { label: 'Payment Methods',     path: '/pos/reports/payments',     permission: 'pos.reports.view', icon: 'CreditCard' },
    { label: 'Cashier Sales',       path: '/pos/reports/cashiers',     permission: 'pos.reports.view', icon: 'Users' },
    { label: 'Cash Over/Short',     path: '/pos/reports/over-short',   permission: 'pos.reports.view', icon: 'Scale' },
    { label: 'Receipt History',     path: '/pos/reports/receipts',     permission: 'pos.reports.view', icon: 'History' },
    { label: 'Unsettled Costs',     path: '/inventory/reports/unsettled-costs', permission: 'pos.reports.view', icon: 'CircleDollarSign' },
  ],
},
```
Register all routes. `posApi` gets the report endpoints.

## Step 4 — i18n sweep
Ensure the full `pos` namespace exists in `frontend/src/i18n/en`, `ar`, `tr` for every page/label across 247a–247e. Verify Arabic RTL on the cashier screen and tender modal. No hardcoded strings (reviewer blocks).

## Step 5 — Documentation (Definition of Done for the whole module)
- `docs/architecture/pos.md` — technical: architecture (Option C), entity map, the SI-integration contract (§4), posting flows, where each effect is created, governance rule, file map. Cross-link `sales.md`, `inventory.md`, `accounting.md`.
- `docs/user-guide/pos/` — plain-language guides: `setup.md` (registers, payment methods, walk-in, enable direct sales), `shifts.md` (open/close, cash drawer, X/Z), `selling.md` (cart, tenders, split, receipt), `returns.md`, `reports.md`.
- `planning/done/247-pos-module.md` — completion report (technical + end-user) consolidating all phases, with the full manual QA script (per Memory `feedback_qa_in_task_files`).
- Append `planning/JOURNAL.md`; set `planning/ACTIVE.md` next task.

## Acceptance criteria
- [ ] All 6 POS report pages render via `ReportContainer`; `npm --prefix frontend run build` passes `check-reports.mjs`.
- [ ] Z report for a closed shift matches its X report at close time + shows over/short voucher link.
- [ ] Payment-method + daily summaries reconcile to the underlying SIs.
- [ ] en/ar/tr complete; RTL verified.
- [ ] All DoD docs exist.

## Tests
`backend/src/tests/application/pos/PosReporting.test.ts`: Z totals = sum of receipts for the shift; payment-method grouping; cash over/short rows match closed shifts.
