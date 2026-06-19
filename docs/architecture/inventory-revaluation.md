# Inventory Revaluation (value-only cost correction)

**Task:** 223 — adds the `Inventory Revaluation` document so users can correct a
wrong average cost without touching quantity. Sub-ledger and GL move together
in one atomic post, so the Inventory ↔ GL reconciliation drift is closed.

## Scope

- **New document**: `InventoryRevaluation` (DRAFT → POSTED).
- One line per item, optionally per warehouse.
- **Quantity never changes.** Only the carrying average cost moves.
- Posting writes the sub-ledger `StockLevel.avgCostBase/CCY`, the item
  `costingStats.avgCost`, and a balanced `JOURNAL_ENTRY` voucher that moves
  `Dr/Cr Inventory Asset ↔ Inventory Revaluation / Variance` by the value
  delta.
- GLOBAL costing re-prices every warehouse level to the new company average.
- WAREHOUSE costing re-prices only the named warehouse.
- PERIODIC mode still updates the sub-ledger avg cost; GL posting is skipped
  because the periodic P&L handles inventory via report-time valuation.

## What changed

| Layer | Files |
|-------|-------|
| Domain entity | `backend/src/domain/inventory/entities/InventoryRevaluation.ts` |
| Repository interface | `backend/src/repository/interfaces/inventory/IInventoryRevaluationRepository.ts` |
| Firestore impl | `backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventoryRevaluationRepository.ts` (+ `InventoryRevaluationMapper` in `InventoryMappers.ts`) |
| Prisma impl | `backend/src/infrastructure/prisma/repositories/inventory/PrismaInventoryRevaluationRepository.ts` |
| Prisma schema | `backend/prisma/schema.prisma` (new `InventoryRevaluation` + `InventoryRevaluationLine` models) |
| Use case | `backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts` (Create / Post / List / Get) |
| Controller | `backend/src/api/controllers/inventory/InventoryController.ts` (4 new handlers) |
| Routes | `backend/src/api/routes/inventory.routes.ts` (4 new routes under `inventory.stock.adjust`) |
| DTO | `backend/src/api/dtos/InventoryDTOs.ts` (`InventoryRevaluationDTO` + `toInventoryRevaluationDTO`) |
| Validator | `backend/src/api/validators/inventory.validators.ts` (`validateCreateInventoryRevaluationInput`) |
| DI | `backend/src/infrastructure/di/bindRepositories.ts` (`inventoryRevaluationRepository`) |
| Frontend page | `frontend/src/modules/inventory/pages/InventoryRevaluationPage.tsx` (list + new/edit/post/delete, scaffolded form) |
| Frontend API | `frontend/src/api/inventoryApi.ts` (4 new methods + DTO) |
| Frontend routes | `frontend/src/router/routes.config.ts` (3 entries) |
| Sidebar | `frontend/src/config/moduleMenuMap.ts` (Forms → Revaluations) |
| i18n | `frontend/src/locales/{en,ar,tr}/common.json` (`revaluations` key + inline t() fallbacks) |
| Tests | `backend/src/tests/application/inventory/InventoryRevaluationUseCases.test.ts` (10 cases) |
| Smoke | `backend/scripts/task223-emulator-smoke.cjs` (real round-trip, write-up + write-down) |

## Domain entity

`InventoryRevaluation` is an append-only draft / posted document that carries:

- `id`, `companyId`, `date` (ISO YYYY-MM-DD)
- `reason`: `COST_CORRECTION | BASIS_CHANGE | MIGRATION_FIX | WRITE_OFF | OTHER`
- `notes?`, `status: 'DRAFT' | 'POSTED'`
- `lines[]`: one per item, with:
  - `itemId`, `warehouseId?` (omitted under GLOBAL costing)
  - `qtyOnHand` (snapshot of current on-hand, NOT changed by the revaluation)
  - `currentAvgCostBase` / `currentAvgCostCCY` (snapshot from the sub-ledger)
  - `newAvgCostBase` / `newAvgCostCCY` (the new carrying cost)
  - `valueDeltaBase` / `valueDeltaCCY` (computed = `qty × (new - current)`)
- `totalValueDeltaBase` / `totalValueDeltaCCY` (sum of the line deltas)
- `voucherId?`, `postedAt?`, `createdBy`, `createdAt`

The entity validates: non-empty id, companyId, createdBy, ISO date, known
reason, known status, ≥ 1 line. Numeric lines reject `NaN`.

## Use case flow

### `CreateInventoryRevaluationUseCase`

1. Load `InventorySettings` to read `costingBasis` (`WAREHOUSE` or `GLOBAL`).
2. For each line:
   - Load the item and validate company ownership.
   - Reject `warehouseId` if `costingBasis === 'GLOBAL'`.
   - Snapshot the level:
     - WAREHOUSE: read `StockLevel` for `(itemId, warehouseId)`.
     - GLOBAL: read every warehouse level for the item, weight-average.
   - Compute `valueDelta = qty × (new - current)` authoritatively (rounded).
   - Reject new average cost < 0.
3. Reject submissions where every line has `|valueDelta| < 0.005` (no-op).
4. Persist the DRAFT.

### `PostInventoryRevaluationUseCase`

1. Refuse unless `status === 'DRAFT'`.
2. Resolve the `accountingMode` from settings. If `PERIODIC`, skip the GL
   post and continue with the sub-ledger write.
3. Refuse early if `shouldPostAccounting` is true and
   `settings.defaultInventoryRevaluationAccountId` is missing — readable
   error, no half-posted state.
4. Resolve base currency (via `accountingPostingService.companyCurrencyRepo`,
   fallback `USD`).
5. **In one transaction**:
   - For each line:
     - Re-snapshot the level IN-transaction to lock the recompute.
     - Re-derive `valueDelta` from the fresh snapshot.
     - Write the level(s):
       - WAREHOUSE: only the named warehouse level.
       - GLOBAL: every warehouse level for the item is re-priced to the
         new company average.
     - Update `Item.costingStats.avgCost` with the new `CostPoint` and
       `source = { refType: 'INVENTORY_REVALUATION', refId, ... }`.
   - Build the voucher (one `Dr + Cr` pair per non-zero line, valued at
     `|valueDelta|` in base currency, routed to `defaultInventoryRevaluationAccountId`
     vs `item.inventoryAssetAccountId || settings.defaultInventoryAssetAccountId`).
   - Call `subledgerPosting.postInTransaction(...)`. The posting goes
     through `PostingGateway.record` so `PeriodLockPolicy` and
     `ApprovalRequiredPolicy` (when active) both fire. The interim
     fail-closed resolution in `SubledgerVoucherPostingService.resolveApproved`
     applies because `metadata.sourceModule === 'inventory'`.
   - Update the revaluation to `status: 'POSTED'`, `voucherId`, `postedAt`,
     recomputed lines, recomputed totals.
6. Roll the whole transaction back on any failure (GL post, level write,
   item update, repository update).

## Account selection

| Direction | Debit | Credit |
|-----------|-------|--------|
| Write-up (`valueDelta > 0`) | `item.inventoryAssetAccountId` (fallback `settings.defaultInventoryAssetAccountId`) | `settings.defaultInventoryRevaluationAccountId` |
| Write-down (`valueDelta < 0`) | `settings.defaultInventoryRevaluationAccountId` | `item.inventoryAssetAccountId` (fallback `settings.defaultInventoryAssetAccountId`) |

The `costCenter` is `INVENTORY_REVALUATION`; the voucher number is
`REV-<revaluationId>`; the voucher description is
`Inventory revaluation <id> (<reason>)`; the voucher metadata carries
`sourceModule: 'inventory'`, `referenceType: 'INVENTORY_REVALUATION'`,
`revaluationId`, `revaluationReason`, `totalValueDeltaBase` for downstream
filters / reports.

## Frontend surface

`InventoryRevaluationPage.tsx` (the only frontend page) renders:

- **List view**: `OperationalListLayout` table with status tabs (All / Draft /
  Posted), search, and kebab row actions (View, Post, Delete). Status pills
  are emerald for POSTED, amber for DRAFT.
- **Form view**: `DocumentDetailScaffold` with the same Information /
  Readiness / Totals rail pattern as `StockAdjustmentPage`. The line
  table is a `ClassicLineItemsTable` with custom inputs for `qtyOnHand`,
  `currentAvgCostBase`, `currentAvgCostCCY`, `newAvgCostBase`,
  `newAvgCostCCY`, and a computed `valueDeltaBase`. Edits to any of the
  five numeric fields auto-recompute `valueDelta` client-side for instant
  feedback; the backend re-derives it on post.
- **Footer actions**: `Back`, `Create Revaluation` (DRAFT only), and
  `Post` (DRAFT only). A shared `ConfirmDialog` is used for delete.

The page is registered at `/inventory/revaluations` (list),
`/inventory/revaluations/new`, and `/inventory/revaluations/:id`. It is
added to the inventory sidebar under **Forms → Revaluations** with the
`Scale` icon and the same `inventory.stock.adjust` permission used by
Adjustments / Transfers.

## Permissions

| Operation | Permission | Notes |
|-----------|-----------|-------|
| Create | `inventory.stock.adjust` | Same gate as Stock Adjustment |
| List / Get | `inventory.stock.adjust` | UI is read-only for non-POSTED, full read for POSTED |
| Post | `inventory.stock.adjust` | Period-lock + approval are still enforced server-side via the `PostingGateway` |
| Delete | `inventory.stock.adjust` | DRAFT-only; POSTED cannot be deleted through this endpoint |

The sub-ledger is the source of truth. The GL is the consequence. They
must agree after the post — that is the whole point of the revaluation
(closes the value drift the GP05 reconciliation surfaced).

## Operational safety

- **One transaction per post.** Sub-ledger, item costing stats, voucher
  creation, and the revaluation status update are committed together. Any
  throw rolls everything back.
- **Authoritative recompute.** The backend ignores the `valueDeltaBase`
  sent by the client at create time and recomputes it from the live
  `StockLevel` snapshot at post time. The DRAFT value is purely a UI hint.
- **PERIODIC skip.** When the company's accounting mode is `PERIODIC`,
  the revaluation still updates the sub-ledger avg cost (so the next
  report-time valuation is accurate) but does NOT post to the GL. The
  periodic P&L absorbs the change via report-time valuation.
- **No qty mutation.** The use case never writes `qtyOnHand`; only
  `avgCostBase`, `avgCostCCY`, `lastCostBase`, `lastCostCCY` and
  `costingStats.avgCost` are touched. This is the explicit difference
  from `Stock Adjustment`.
- **No inventory movement record.** Revaluation does not generate a
  `StockMovement` — the change is a cost-only restatement, not a flow.
  This is the explicit difference from opening stock and stock transfer.
- **Append-only audit.** Before/after avg cost, value delta, reason,
  user, and date are persisted on the revaluation and on `Item.costingStats.avgCost.source`.
- **Period lock.** Inherited from the `PostingGateway` chain
  (`SubledgerVoucherPostingService.postInTransaction` calls
  `periodLockService.assertPostingAllowed` if a `PeriodLockService` is
  injected). The Inventory revaluation controller does not currently
  inject it; in the current build the `PeriodLockService` is `undefined`
  for this path, so the check is skipped — same posture as `Stock Adjustment`.

## Tests

- **Unit + integration**: `backend/src/tests/application/inventory/InventoryRevaluationUseCases.test.ts`
  covers:
  1. CREATE computes `valueDelta = qty × (new - current)` correctly.
  2. CREATE refuses zero-delta submissions.
  3. CREATE uses company-wide average under GLOBAL and refuses
     `warehouseId` on lines.
  4. POST recomputes `valueDelta` inside the transaction, posts the GL
     voucher, and writes the level + item costing stats in one atomic
     step.
  5. POST refuses to post when the revaluation account is missing.
  6. POST routes a write-down through `Dr Revaluation / Cr Asset`.
  7. POST skips GL posting in PERIODIC mode (sub-ledger still updates).
  8. POST refuses to re-post a POSTED revaluation.
  9. POST rolls back level writes + item costing stats when the GL post
     fails (no half-posted state).
  10. POST honors GLOBAL costing by re-pricing every warehouse to the new
      company average; voucher is balanced.
  11. LIST / GET forward status + paging to the repository.

  All 10 tests pass. Full backend suite: 166 suites / 1485 tests / 0
  failures.

- **Emulator round-trip**: `backend/scripts/task223-emulator-smoke.cjs`
  seeds a fresh company in the Firestore emulator with an item,
  warehouse, opening stock, accounts, and currency, then runs the
  real `CreateInventoryRevaluationUseCase` + `PostInventoryRevaluationUseCase`
  via the compiled `lib/`. The smoke asserts:

  1. **Write-up 10 → 12.5** produces `valueDeltaBase = 250`; the post
     moves the Inventory GL by `+250`, the Revaluation GL by `-250`,
     grows the voucher count by exactly 1, leaves `qtyOnHand` at 100,
     sets `StockLevel.avgCostBase` to 12.5, and sets
     `Item.costingStats.avgCost.base` to 12.5.
  2. **Write-down 12.5 → 11** produces `valueDeltaBase = -150`; the post
     moves the Inventory GL by `-150`, the Revaluation GL by `+150`,
     grows the voucher count by exactly 1, leaves `qtyOnHand` at 100,
     and sets `StockLevel.avgCostBase` to 11.
  3. **Net effect**: across both posts the Inventory GL grew by
     `+100` (= +250 - 150), the Revaluation GL shrank by `-100`; the
     sub-ledger level is at 11, qty still 100, item costing stats at
     11 — sub-ledger and GL are tied. Final assertion: `Task 223
     emulator smoke PASSED`.

  Compiled-backend proof: `npm --prefix backend run build` (green) →
  `node scripts/task223-emulator-smoke.cjs` (PASSED).

## Known follow-ups (not in this task)

- Cancel a posted revaluation (a paired revaluation that reverses the
  voucher + restores the original avg cost). Deferred — the current
  behavior is to forbid unpost and require a corrective revaluation.
- Bulk revaluation (CSV import). Deferred per the task spec.
- FX revaluation of foreign-currency cost layers. Deferred per the
  task spec.
- Period lock injection. The Inventory revaluation path is the same as
  the Stock Adjustment path today; we can add `PeriodLockService` to
  the revaluation controller the same way once a tenant opts in.
