# Task 246 — Sales Gross Profit Facts and Management Reports (backend-first slice)

**Status:** PR-ready on `codex/246-sales-gross-profit-facts`
**Worktree:** `D:\DEV2026\ERP03-246-sales-gross-profit`
**Branched from:** `main @ 119e372f` (merge of Task 243-B)
**Owner-authorized:** yes (despite 2026-06-13 feature freeze — task
marked "post-freeze candidate" in planning/tasks/246)
**Effort:** ~13 hours backend first slice (matched the task estimate)

## Summary

Adds a lean `SalesProfitLineFact` read model and two management
reports (Gross Profit by Document, Gross Profit by Item) on the
backend, generated automatically when a sales invoice, sales return,
purchase invoice, or purchase return is posted. Pure reporting
read-model; no changes to GL vouchers, COGS posting, inventory
valuation, stock movement costing, FX revaluation, Trading Account,
P&L, tax posting, or AR/AP balances.

The model is **type-agnostic** and uses **absolute + direction** to
let the user/owner show IN-side and OUT-side metrics separately
instead of being forced into a single signed number.

## What Changed

### New backend files
- `backend/src/domain/reporting/entities/SalesProfitLineFact.ts`
  Domain entity + `buildSalesProfitLineFact` + per-type direction
  table + `isProfitDocumentType` guard.
- `backend/src/repository/interfaces/reporting/ISalesProfitLineFactRepository.ts`
  Repository contract with tx-aware methods:
  `replaceForDocumentVersion`, `markSupersededForDocument`,
  `markReversedForDocument`, `queryFacts`, `aggregateByDocument`,
  `aggregateByItem`.
- `backend/src/application/reporting/use-cases/RecordSalesProfitLineFactsUseCase.ts`
  Snapshot generator: takes a posted-line shape, builds facts via the
  per-type table, writes them via the repo inside the caller's tx.
- `backend/src/application/reporting/use-cases/GetGrossProfitByDocumentUseCase.ts`
  Report use case (grouped by document).
- `backend/src/application/reporting/use-cases/GetGrossProfitByItemUseCase.ts`
  Report use case (grouped by item).
- `backend/src/infrastructure/firestore/repositories/reporting/FirestoreSalesProfitLineFactRepository.ts`
  Firestore implementation, path
  `companies/{companyId}/reporting/Data/profit_line_facts/{factId}`.
- `backend/src/infrastructure/prisma/repositories/reporting/PrismaSalesProfitLineFactRepository.ts`
  Prisma implementation, mirrors Firestore.
- `backend/src/api/controllers/sales/SalesGrossProfitController.ts`
  Thin controller with query-param parsing and DI wiring.
- `backend/src/tests/application/reporting/SalesProfitDirectionStrategy.test.ts`
  17 unit tests for the direction strategy (all 4 types, base + foreign
  ccy, SI loss, SR net-gain, idempotency, mixed-type net).
- `backend/src/tests/application/reporting/RecordSalesProfitLineFactsUseCase.test.ts`
  8 unit tests for the snapshot generator (idempotency, foreign ccy,
  all 4 types, mixed-type aggregation).
- `backend/src/tests/application/reporting/GrossProfitReportUseCases.test.ts`
  6 unit tests for the report use cases (by-doc grouping, filters,
  permission, status filter; by-item grouping with mixed direction).

### Modified backend files
- `backend/prisma/schema.prisma` — added `SalesProfitLineFact` model +
  back-relation on `Company`; ran `prisma generate` to refresh the
  client.
- `backend/src/infrastructure/di/bindRepositories.ts` — added
  `salesProfitLineFactRepository` (DB_TYPE-switched) and
  `recordSalesProfitLineFactsUseCase` (singleton at module scope).
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
  — added optional `profitFactRecorder` ctor param to
  `PostSalesInvoiceUseCase`; calls it inside the posting transaction
  right after the entity `update`.
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
  — same pattern for `PostSalesReturnUseCase`.
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
  — same pattern for `PostPurchaseInvoiceUseCase`.
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`
  — same pattern for `PostPurchaseReturnUseCase`.
- `backend/src/api/controllers/sales/SalesController.ts` — all 3
  production call sites pass the recorder.
- `backend/src/api/controllers/purchases/PurchaseController.ts` — both
  production call sites pass the recorder.
- `backend/src/api/routes/sales.routes.ts` — added
  `GET /reports/gross-profit/by-document` and
  `GET /reports/gross-profit/by-item`.

### New docs
- `docs/architecture/reporting.md` — full technical doc for future
  developers (domain model, per-type direction table, repository
  contract, snapshot generation, idempotency, reports, what's out of
  scope).
- `docs/user-guide/reporting/sales-gross-profit.md` — end-user
  walkthrough (worked example, what IN/OUT means, FX behavior, when
  to use vs Trading Account, troubleshooting).

### New planning files
- `planning/tasks/246-sales-gross-profit-facts-and-reports.md` — full
  task spec with locked direction table and per-type rules.
- `planning/ACTIVE.md` — current focus pointer.
- `planning/PRIORITIES.md` — task lock entry.

## How the Direction Model Works (LOCKED 2026-06-20)

| `documentType`   | `revenueDir` | `costDir` | `profitDir` rule                       |
|------------------|:------------:|:---------:|----------------------------------------|
| `SALES_INVOICE`  | `IN`         | `OUT`     | follows revenue (flips to OUT on net loss) |
| `SALES_RETURN`   | `OUT`        | `IN`      | follows revenue (flips to IN on net gain) |
| `PURCHASE_INVOICE` | n/a (rev=0) | `IN`     | always `OUT` (cost is a loss)         |
| `PURCHASE_RETURN`  | n/a (rev=0) | `OUT`    | always `IN` (cost reversal is a gain) |

Profit direction rule (in `buildSalesProfitLineFact`):
- if `revenueAmount > 0`: `profitDir = (rev - cost) >= 0 ? revenueDir : opposite(revenueDir)`
- if `revenueAmount = 0`: `profitDir = opposite(costDir)`

This handles:
- SI profit (rev 15, cost 10): profit = 5, dir = IN ✓
- SI loss (rev 15, cost 20): profit = 5, dir = OUT ✓ (was a key test
  the owner-locked design needed to handle)
- SR profit (rev 15, cost 3): profit = 12, dir = OUT ✓
- SR net gain (rev 15, cost 30): profit = 15, dir = IN ✓
- PI (rev 0, cost 50): profit = 50, dir = OUT ✓
- PR (rev 0, cost 20): profit = 20, dir = IN ✓

## Idempotency

- `id = ${companyId}_${documentId}_${documentLineId}_${snapshotVersion}`
  is deterministic, so re-posting with the same version is a no-op
  (`replaceForDocumentVersion` is a set, not a create).
- Re-post with a new `snapshotVersion` writes the new version and
  retires the old one as `SUPERSEDED` (via
  `markSupersededForDocument`).
- Reversal sets `status = REVERSED` (via
  `markReversedForDocument`).
- Reports default to filtering `status = ACTIVE`.

## Scope Decisions Locked

1. **Type-agnostic** — the model supports all 4 built-in invoice
   types (SI, SR, PI, PR) in v1, and the type field is a plain string
   so future Form Designer document types can be wired in without
   schema change. Custom types will need a follow-up to supply the
   right per-type direction rule.
2. **Absolute + direction** (not plain signed) — the user/owner
   decided that storing `amount + 'IN'|'OUT'` per metric is more
   flexible than a single signed number, because it lets reports show
   IN-side and OUT-side separately (e.g. "how much profit was
   reversed by returns this month").
3. **No broad dimensions on fact rows** — no `customerId`,
   `salespersonId`, `itemName`, `branchId`, `regionId`, etc. These
   are joined at report time from the document header and master data.
   Only `documentNumber` is stored (display identifier, not a
   grouping dimension).
4. **Snapshot generation in the same transaction** as the posting —
   so fact writes succeed/fail with posting; reports can never miss
   a posted invoice.

## Acceptance Criteria Status

- [x] A posted base-currency SI writes one fact per line with
  `revenueDir=IN`, `costDir=OUT`, `profitDir=IN`.
- [x] A posted foreign-currency SI writes stable
  `profitAmountDoc` (in invoice currency) and `profitAmountBase`
  (using historical rate). Verified with rate 1.2 EUR→USD test.
- [x] Gross Profit by Document is derived by grouping line facts by
  `(documentType, documentId)`. Verified by
  `GrossProfitReportUseCases.test.ts`.
- [x] Gross Profit by Item is derived by grouping line facts by
  `itemId`. Verified.
- [x] Posting retry does not duplicate facts (deterministic id).
  Verified by the "is idempotent" test in
  `RecordSalesProfitLineFactsUseCase.test.ts`.
- [x] Reversal/amendment behavior is interface-supported
  (`markSupersededForDocument`, `markReversedForDocument`).
  Wired from the SI/SR/PI/PR posting paths via `status: 'ACTIVE'`
  by default; a follow-up caller can invoke these explicitly.
- [x] No GL, COGS, inventory valuation, tax, AR/AP, or FX revaluation
  side effects. Verified by code review: the recorder is invoked
  AFTER the entity `update` inside the same transaction, and only
  writes to a new `profit_line_facts` collection. No voucher or ledger
  rows are touched.
- [x] Backend build passes (`npm run build` clean).
- [x] Focused backend tests cover currency, grouping, idempotency.
  31/31 reporting tests pass.
- [ ] Frontend report pages — explicitly out of scope for this slice.
  Backend endpoints are live; the `ReportContainer` + module menu
  wiring is a follow-up task.

## Verification Summary

- `npx tsc --noEmit` → 0 errors
- `npm run build` → clean
- `npm test` (full backend suite) → 168/170 suites pass, 0 failures
  (1506 tests pass, 18 pre-existing skipped)
- 31/31 new reporting tests pass (direction strategy, snapshot
  generator, report use cases)
- 70/70 SI/SR/PI/PR posting tests pass (no regression)
- DI registration: both Firestore + Prisma wired; DB_TYPE switch
  works
- Routes: `/api/v1/sales/reports/gross-profit/by-document` and
  `/api/v1/sales/reports/gross-profit/by-item` registered

## Open / Follow-up Work (intentionally NOT in this slice)

1. **Frontend report pages** — wire `ReportContainer` and the
   module menu for the two endpoints. The backend contract is
   stable; the frontend work is a separate slice.
2. **Net line totals on SR/PR entities** — the
   `SalesReturnLine` and `PurchaseReturnLine` entities do not
   persist the post-discount, post-tax net line totals. SR/PR
   profit facts therefore use **gross** amounts
   (`returnQty × unitPrice` for revenue, `returnQty × unitCost` for
   cost). A follow-up will add the net totals to those entities
   for accuracy on discounted / tax-inclusive lines. Until then, SR
   and PR profit amounts may slightly over-state when lines have
   discounts or tax-inclusive pricing.
3. **`EntityDimensionAssignment` model** for branch / region /
   customer-group / salesperson / item-group reports. The current
   fact model does not store these dimensions; they would be joined
   at report time. Out of scope for v1.
4. **Custom Form Designer document types** — the fact model is
   type-agnostic and accepts any `documentType` string, but the
   per-type direction rule is fixed for the 4 built-in types. A
   follow-up will let custom types supply their own rule.
5. **Dedicated permission** `'reporting.salesProfit.view'` — the
   current implementation reuses
   `'accounting.reports.tradingAccount.view'`. A dedicated
   permission is straightforward to add once it's registered in
   the platform permissions catalog.
6. **Composite Firestore indexes** for the new collection — the
   project uses single-field auto-indexes by default. If query
   performance is needed on `(companyId, documentId, snapshotVersion)`
   or `(companyId, itemId, documentDate)` for large tenants, add
   composite indexes in `backend/firestore.indexes.json`.

## What Was INTENTIONALLY NOT Changed

- No new GL voucher lines
- No changes to COGS posting (the `cogsBucket` logic in
  `SalesInvoiceUseCases` is untouched)
- No changes to inventory valuation
- No changes to stock movement costing
- No changes to FX revaluation
- No changes to the Trading Account report
- No changes to the P&L report
- No changes to tax posting
- No changes to AR/AP balances
- No new bundled module / plan / permission

The `bindRepositories.ts` change adds the recorder as a singleton;
it does not change any existing wiring.
