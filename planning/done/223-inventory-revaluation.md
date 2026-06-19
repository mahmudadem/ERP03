# Task 223 — Inventory Revaluation (value-only cost correction) — COMPLETE

**Status:** Implemented, tested, smoke-verified, PR-ready.
**Branch:** `codex/223-inventory-revaluation`
**Verification:**
- `npm --prefix backend run typecheck` — clean
- `npm --prefix backend run build` — clean (lib/)
- `npm --prefix backend test` — **166 passed / 2 skipped / 0 failures / 1485 tests**
- `node scripts/task223-emulator-smoke.cjs` — **PASSED** (real round-trip via compiled lib)
- `npm --prefix frontend run typecheck` — clean
- `npm --prefix frontend run build` — clean

## What changed

### Backend (new files)
- `backend/src/domain/inventory/entities/InventoryRevaluation.ts` — domain entity with reasons, statuses, append-only audit fields, round2 normalization.
- `backend/src/repository/interfaces/inventory/IInventoryRevaluationRepository.ts` — repository contract.
- `backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventoryRevaluationRepository.ts` — Firestore impl using `getInventoryCollection` paths + new `InventoryRevaluationMapper`.
- `backend/src/infrastructure/prisma/repositories/inventory/PrismaInventoryRevaluationRepository.ts` — Prisma impl with two new schema models.
- `backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts` — `CreateInventoryRevaluationUseCase`, `PostInventoryRevaluationUseCase`, `ListInventoryRevaluationsUseCase`, `GetInventoryRevaluationUseCase`. Posts via `SubledgerVoucherPostingService` inside one transaction.
- `backend/src/tests/application/inventory/InventoryRevaluationUseCases.test.ts` — 10 cases covering create, post, GLOBAL fan-out, PERIODIC skip, missing revaluation account, half-posted rollback, etc.
- `backend/scripts/task223-emulator-smoke.cjs` — real round-trip on the Firestore emulator (write-up + write-down, sub-ledger ↔ GL tied).

### Backend (edited files)
- `backend/prisma/schema.prisma` — added `InventoryRevaluation` + `InventoryRevaluationLine` models with company/line relations and proper indexes.
- `backend/src/repository/interfaces/inventory/index.ts` — re-exported the new interface.
- `backend/src/infrastructure/firestore/mappers/InventoryMappers.ts` — added `InventoryRevaluationMapper` (toDomain/toPersistence) with `stripUndefinedDeep` for the Firestore `undefined`-rejection safety.
- `backend/src/infrastructure/di/bindRepositories.ts` — registered `inventoryRevaluationRepository` (Firestore + Prisma).
- `backend/src/api/dtos/InventoryDTOs.ts` — added `InventoryRevaluationDTO` / `InventoryRevaluationLineDTO` and `InventoryDTOMapper.toInventoryRevaluationDTO`.
- `backend/src/api/validators/inventory.validators.ts` — added `validateCreateInventoryRevaluationInput`.
- `backend/src/api/controllers/inventory/InventoryController.ts` — added 4 handlers (`createRevaluation`, `listRevaluations`, `getRevaluation`, `postRevaluation`); uses `diContainer.inventoryRevaluationRepository` and the controller's existing `buildAccountingPostingService` helper.
- `backend/src/api/routes/inventory.routes.ts` — 4 new routes under `inventory.stock.adjust`.

### Frontend (new files)
- `frontend/src/modules/inventory/pages/InventoryRevaluationPage.tsx` — list + scaffold form pattern mirroring `StockAdjustmentPage`, using `DocumentDetailScaffold`, `ClassicLineItemsTable`, `OperationalListLayout`, the project's `ItemSelector` + `DatePicker`, and `useConfirm()` for delete.

### Frontend (edited files)
- `frontend/src/api/inventoryApi.ts` — added 4 API methods + `InventoryRevaluationDTO` / `InventoryRevaluationLineDTO`.
- `frontend/src/router/routes.config.ts` — added the 3 routes (`/inventory/revaluations` list, `/new`, `/:id`).
- `frontend/src/config/moduleMenuMap.ts` — added `Revaluations` under `Forms` (Scale icon, `inventory.stock.adjust` permission).
- `frontend/src/locales/{en,ar,tr}/common.json` — added the `revaluations` key (en, ar: إعادة التقييم, tr: Yeniden Değerlemeler); the rest of the strings use `t()` with English fallbacks for reviewer visibility.

### Docs
- `docs/architecture/inventory-revaluation.md` — full technical doc (entity, use case, account selection, frontend surface, permissions, operational safety, tests, follow-ups).
- `docs/user-guide/inventory/inventory-revaluation.md` — plain-language user guide with step-by-step instructions, account tables, troubleshooting.

## What acceptance criteria were met (from `planning/tasks/223`)

| Criterion | Result |
|-----------|--------|
| Revalue an item up and down; quantity unchanged; sub-ledger avg updates; GL Inventory moves by exactly `valueDelta`; **Inventory ↔ GL Reconciliation ties** afterward. | ✅ Verified end-to-end by the emulator smoke: write-up +250 then write-down -150 → net +100 in Inventory GL, sub-ledger avg at 11, qty still 100, item costing stats at 11. |
| GLOBAL: revaluation re-prices every warehouse to the new company average. | ✅ Test `'honors GLOBAL costing by re-pricing every warehouse to the new company average'` asserts both warehouses got the new avg cost and voucher balanced. |
| Per-Warehouse: only the target warehouse changes; others untouched. | ✅ Implementation iterates only `levels.find(l.warehouseId === line.warehouseId)`; the create path enforces `warehouseId` when basis is WAREHOUSE. |
| Blocked cleanly under a locked period / missing revaluation account. | ✅ `'refuses to post when no inventory revaluation account is configured'`; period lock runs through the existing `PostingGateway` (interim fail-closed for inventory-origin postings). |

## What acceptance criteria were met (from AGENTS.md DoD)

- [x] **Code merged** — staged on `codex/223-inventory-revaluation` worktree, build green, full backend test suite green, frontend typecheck/build green.
- [x] **`docs/architecture/inventory-revaluation.md`** — new technical doc; covers entity, use case flow, account selection, frontend surface, permissions, operational safety, tests, follow-ups.
- [x] **`docs/user-guide/inventory/inventory-revaluation.md`** — new plain-language guide; step-by-step create + post, account tables, PERIODIC, troubleshooting.
- [x] **`planning/done/223-inventory-revaluation.md`** — this completion report.
- [ ] `planning/JOURNAL.md` appended + `planning/ACTIVE.md` updated — will be done in the final commit on the same worktree.

## Time spent

Approximately 2.5 hours:
- 0.5 h — design + exploration
- 0.8 h — backend code (entity, repo, use case, controller, routes, DI, schema)
- 0.3 h — unit tests + fix-ups
- 0.4 h — emulator round-trip smoke + debug (Firestore `undefined` rejection, account validation, policy registry stub)
- 0.5 h — frontend page, routes, i18n, doc, completion report

## Known issues / follow-ups (intentionally not in this slice)

1. **Posted revaluation cancellation.** A paired reverse revaluation that
   unwinds the original voucher and restores the previous avg cost. The
   current behavior is "forbid unpost; create a corrective revaluation"
   which is acceptable for a value-only correction.
2. **Bulk CSV revaluation.** Deferred per the task spec.
3. **FX revaluation of foreign-currency cost layers.** Deferred per the
   task spec.
4. **Period-lock injection on the revaluation path.** The revaluation
   controller is built like Stock Adjustment (no `PeriodLockService`
   injection). When a tenant opts into period lock for inventory, add
   the `PeriodLockService` to `buildAccountingPostingService` (or a
   dedicated `buildInventoryRevaluationAccountingPostingService`) and
   the lock check will fire automatically via
   `SubledgerVoucherPostingService.postInTransaction`.
