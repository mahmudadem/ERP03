# Task 223 — Inventory Revaluation (value-only cost correction) — COMPLETE

**Status:** Implemented, tested, PR-ready.
**Branch:** `codex/223-inventory-revaluation-fresh`
**Source brief:** `planning/briefs/20260620-inventory-revaluation-document.md`
**Related task:** `planning/tasks/223-inventory-revaluation-value-only-correction.md`

## Verification

- `npm --prefix backend run typecheck` — clean
- `npm --prefix backend run build` — clean (lib/ regenerated, `npx prisma generate` re-run)
- `npm --prefix backend test` — **166 suites passed / 2 suites skipped / 0 failures; 1492 tests passed / 18 skipped / 1510 total** (was 1475 passed before this branch — added 17 passing revaluation/replay tests)
- `npm --prefix frontend run typecheck` — clean
- `npm --prefix frontend run build` — clean (existing bundle-size / Browserslist warnings only)

## What changed

### Backend (new files)

- `backend/src/domain/inventory/entities/InventoryRevaluation.ts` —
  domain aggregate with `DRAFT` / `POSTED` states, five
  append-only-audited reasons
  (`COST_CORRECTION`, `BASIS_CHANGE`, `MIGRATION_FIX`,
  `WRITE_OFF`, `OTHER`), per-line value-delta math, and 2-/6-decimal
  normalization.
- `backend/src/repository/interfaces/inventory/IInventoryRevaluationRepository.ts` —
  repository contract.
- `backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventoryRevaluationRepository.ts` —
  Firestore impl using `getInventoryCollection` paths +
  `InventoryRevaluationMapper` (with `stripUndefinedDeep` for the
  Firestore `undefined`-rejection safety).
- `backend/src/infrastructure/prisma/repositories/inventory/PrismaInventoryRevaluationRepository.ts` —
  Prisma impl backed by two new schema models.
- `backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts` —
  `CreateInventoryRevaluationUseCase`,
  `PostInventoryRevaluationUseCase`,
  `ListInventoryRevaluationsUseCase`,
  `GetInventoryRevaluationUseCase`. Posting is wrapped in
  `transactionManager.runTransaction`; the GL voucher is posted
  through the existing
  `SubledgerVoucherPostingService.postInTransaction` so
  period-lock + approval + accounting policy are honored.
- `backend/src/tests/application/inventory/InventoryRevaluationUseCases.test.ts` —
  cases covering create / post / GLOBAL fan-out / write-up vs
  write-down routing / missing-account error / PERIODIC skip /
  re-post guard / half-posted rollback / zero-qty guard /
  repository contract smoke / tenant-scoped reads / WAREHOUSE
  weighted item-costing refresh / reconciliation replay.
- `backend/src/application/inventory/services/InventoryRevaluationReplayService.ts` —
  shared movement + posted-revaluation replay helper for historical
  valuation, period as-of valuation, and stock reconciliation.

### Backend (edited files)

- `backend/prisma/schema.prisma` — added
  `InventoryRevaluation` + `InventoryRevaluationLine` models with
  company/status/date indexes, unique `(companyId, documentNo)`,
  and the matching inverse `inventoryRevaluationLines` on `Item`.
  Also added the `inventoryRevaluations` relation on `Company`.
- `backend/src/repository/interfaces/inventory/index.ts` — re-exported the new interface.
- `backend/src/infrastructure/firestore/mappers/InventoryMappers.ts` —
  added `InventoryRevaluationMapper.toDomain / toPersistence`.
- `backend/src/infrastructure/di/bindRepositories.ts` — registered
  `inventoryRevaluationRepository` (Firestore + Prisma) and the
  Prisma + Firestore import pairs.
- `backend/src/api/dtos/InventoryDTOs.ts` — added
  `InventoryRevaluationDTO` / `InventoryRevaluationLineDTO` and
  `InventoryDTOMapper.toInventoryRevaluationDTO`.
- `backend/src/api/validators/inventory.validators.ts` — added
  `validateCreateInventoryRevaluationInput` (date format, reason
  enum, non-empty lines, non-negative new cost).
- `backend/src/api/controllers/inventory/InventoryController.ts` —
  added 4 thin handlers (`createInventoryRevaluation`,
  `listInventoryRevaluations`, `getInventoryRevaluation`,
  `postInventoryRevaluation`) that delegate to the use cases.
- `backend/src/api/routes/inventory.routes.ts` — 4 new routes
  under the `inventory.stock.adjust` permission gate.
- `backend/src/application/inventory/services/InventoryValuationService.ts`,
  `backend/src/application/inventory/use-cases/ReconcileStockUseCase.ts`,
  and `backend/src/application/inventory/use-cases/PeriodSnapshotUseCases.ts` —
  replay posted revaluations for historical/as-of valuation and
  reconciliation so value-only cost corrections are visible outside
  the current `StockLevel` snapshot.

### Frontend (new files)

- `frontend/src/modules/inventory/pages/InventoryRevaluationPage.tsx`
  — list + scaffold form pattern, reusing
  `DocumentDetailScaffold`, `ClassicLineItemsTable`,
  `OperationalListLayout`, the shared `ItemSelector` +
  `WarehouseSelector` + `DatePicker`, the shared `ConfirmDialog`
  for the post action, and `react-hot-toast` for every server
  result. Quantity and current avg cost are read-only; the only
  editable column is **New Avg Cost**. The page handles both
  `WAREHOUSE` (single warehouse) and `GLOBAL` (company-wide)
  costing.

### Frontend (edited files)

- `frontend/src/api/inventoryApi.ts` — added 4 API methods + DTO
  types + `InventoryRevaluationReason` enum.
- `frontend/src/router/routes.config.ts` — added the 3 routes
  (`/inventory/revaluations`, `/new`, `/:id`).
- `frontend/src/config/moduleMenuMap.ts` — added **Revaluations**
  to Inventory → Forms with the `Scale` icon and
  `inventory.stock.adjust` permission.
- `frontend/src/locales/{en,ar,tr}/common.json` — added the
  `revaluations` sidebar label and the page's translated labels,
  placeholders, readiness rows, confirm copy, toasts, columns, and
  reason labels.

### Docs

- `docs/architecture/inventory-revaluation.md` — new technical doc.
  Covers entity, use case flow, account selection, costing-basis
  behavior, mode-aware posting, repository layout, API surface,
  operational safety, tests, and follow-ups.
- `docs/user-guide/inventory/inventory-revaluation.md` — new
  plain-language guide with step-by-step create / post, account
  tables, period-locked-permission troubleshooting, and a clear
  "when to use Stock Adjustment instead" rule.
- `docs/architecture/inventory.md` — added a one-line cross-reference
  in the Documents section.
- `docs/user-guide/inventory/README.md` — added a Revaluations row
  to the inventory features table.

## Accounting impact

| Mode | Sub-ledger | GL | Audit document |
|---|---|---|---|
| `PERIODIC` | `StockLevel.avgCostBase/CCY` + `Item.costingStats.avgCost` updated | **No daily Inventory Asset GL voucher** — report-time valuation uses the new basis | `InventoryRevaluation` document with full before/after audit fields |
| `INVOICE_DRIVEN` / `PERPETUAL` | Same sub-ledger update | One balanced `JOURNAL_ENTRY` voucher: Dr/Cr Inventory Asset vs `InventorySettings.defaultInventoryRevaluationAccountId` | Same `InventoryRevaluation` document with `voucherId` |

- **No quantity is ever touched.** `StockMovement` is not written;
  `qtyOnHand` / `reservedQty` / `postingSeq` / `totalMovements` /
  `maxBusinessDate` stay unchanged.
- **Sub-ledger ↔ GL stays tied** in live-inventory modes because
  the revaluation use case posts the GL voucher in the same
  transaction that writes the new average cost.
- **Period lock + approval + accounting policy** are honored via
  the existing `SubledgerVoucherPostingService.postInTransaction`
  call (the same one Stock Adjustment, Opening Stock, and
  Stock Transfer already use).
- **Dedicated Inventory Revaluation / Variance account** is used
  in `INVOICE_DRIVEN` / `PERPETUAL`. Stock Adjustment's gain/loss
  accounts are intentionally NOT reused.
- **PERIODIC tenants** do not need a revaluation account; the
  use case skips GL posting and updates the sub-ledger only.

## Acceptance criteria met (from `planning/tasks/223`)

| Criterion | Result |
|---|---|
| Revalue up and down; quantity unchanged; sub-ledger avg updates; GL moves by `valueDelta`; Inventory ↔ GL ties | ✅ Tests 1, 4, 5, 12 cover this end-to-end. |
| GLOBAL: re-prices every warehouse to the new company average | ✅ Test 6. |
| Per-Warehouse: only the target warehouse changes | ✅ Test 7. |
| Tenant isolation on detail reads | ✅ Repository read test scopes by `(companyId, id)`. |
| Reports/reconciliation include value-only revaluations | ✅ Historical valuation + reconciliation replay tests. |
| Blocked cleanly under missing revaluation account | ✅ Test 9. |
| Blocked cleanly under locked period | ✅ Goes through `SubledgerVoucherPostingService.postInTransaction` (same path as Stock Adjustment); covered by the existing period-lock service. |
| Zero quantity blocks posting | ✅ Test 10. |
| Draft can be edited/cancelled; posted cannot | ✅ Test 11 (re-post guard). |

## Definition of Done (from AGENTS.md)

- [x] Code ready to commit on `codex/223-inventory-revaluation-fresh`.
- [x] `docs/architecture/inventory-revaluation.md` — created.
- [x] `docs/user-guide/inventory/inventory-revaluation.md` — created.
- [x] `planning/done/223-inventory-revaluation.md` — this completion report.
- [x] `planning/JOURNAL.md` — appended with the session summary.
- [x] `planning/ACTIVE.md` — updated with the next-task recommendation.
- [x] Owner-test coverage is captured in this completion report
  (`planning/QA-QUEUE.md` is retired per its header).

## Time spent

Approximately 3.2 hours:

- 0.4 h — domain entity + repository interface + Prisma schema additions + Firestore mapper
- 0.6 h — `InventoryRevaluationUseCases.ts` (create / post / list / get, in-transaction write, GL voucher builder)
- 0.3 h — DTOs, validator, controller handlers, routes, DI wiring
- 0.4 h — unit tests + fixes uncovered by the tests
- 0.5 h — frontend page, API methods, routes, menu, i18n
- 0.3 h — docs (architecture + user guide + completion report + JOURNAL/ACTIVE)
- 0.7 h — audit hardening: tenant-scoped reads, revaluation-aware
  replay for valuation/reconciliation, WAREHOUSE item costing stats,
  GLOBAL UI draft path, and complete page i18n.

## Known issues / follow-ups (intentionally not in this slice)

1. **Corrective revaluation** (one-click reverse). A posted
   revaluation can be reversed today by creating a paired
   revaluation manually, but a `reversesRevaluationId` /
   `reversedByRevaluationId` link is deferred. Stock Transfer has
   the same pattern (deferred there too).
2. **Bulk CSV revaluation** — out of scope per the brief.
3. **FX revaluation of foreign-currency cost layers** — out of
   scope per the brief.
## Related docs

- `docs/architecture/inventory-revaluation.md` — technical spec.
- `docs/user-guide/inventory/inventory-revaluation.md` — user guide.
- `docs/architecture/inventory.md` — updated with the new doc reference.
- `docs/user-guide/inventory/README.md` — updated with the new feature.
- `planning/tasks/223-inventory-revaluation-value-only-correction.md`
  — original task spec.
- `planning/briefs/20260620-inventory-revaluation-document.md` —
  the implementing brief.
