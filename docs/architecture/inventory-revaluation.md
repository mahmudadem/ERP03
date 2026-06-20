# Inventory Revaluation (value-only cost correction)

**Module:** Inventory · Accounting
**Status:** Implemented (Task 223 / brief 2026-06-20)
**Touches:** Inventory, Accounting, RBAC (`inventory.stock.adjust`)

Inventory Revaluation is the standard "MR21-style" document for correcting
the **carrying cost** of inventory **without** changing the on-hand
quantity. It exists alongside Stock Adjustment, which only changes
quantity. The two documents share a layout for muscle-memory continuity,
but their business rules are different on purpose.

| | Stock Adjustment | Inventory Revaluation |
|---|---|---|
| Touches quantity | Yes (`newQty - currentQty`) | **Never** |
| Touches value | Yes (delta × cost) | Yes (qty × Δ cost) |
| GL side | Inventory Asset ↔ Gain/Loss (qty movement) | Inventory Asset ↔ Inventory Revaluation (value movement) |
| Costing basis | WAREHOUSE only | WAREHOUSE **or** GLOBAL |
| PERIODIC mode | Quantity-only (no GL) | Sub-ledger average updates, **no daily GL voucher** |
| `INVOICE_DRIVEN` / `PERPETUAL` | Dr/Cr via SubledgerVoucherPostingService | Dr/Cr via SubledgerVoucherPostingService |

## When to use

Use Inventory Revaluation when:

- The on-hand quantity is correct but the average cost is wrong
  (migration cleanup, historic cost-fix, costing-basis change
  `GLOBAL` ↔ `WAREHOUSE`, prior-period correction).
- A GL entry was posted outside the sub-ledger and the Inventory
  Asset balance drifted from the sub-ledger total.
- Opening stock was loaded without a matching GL and a value-only
  correction is needed.

Use Stock Adjustment when the on-hand quantity is wrong (counted
surplus / shortfall). Do not use Revaluation to "fix" a quantity
problem — it is not a substitute for a count correction.

## Accounting mode behavior

The use case reads the company's `InventorySettings.accountingMode` and
branches:

- **`PERIODIC`** — No daily Inventory Asset GL voucher is created.
  The use case revalues the sub-ledger average cost (in one
  transaction, atomically) so the report-time **Inventory Valuation**
  service picks up the new basis. The revaluation document is the
  auditable artifact; `voucherId` is `null` and `totalValueDeltaBase`
  still records the value movement for reporting.
- **`INVOICE_DRIVEN`** / **`PERPETUAL`** — A balanced
  `JOURNAL_ENTRY` voucher is posted through
  `SubledgerVoucherPostingService.postInTransaction` (Dr/Cr
  Inventory Asset vs `InventorySettings.defaultInventoryRevaluationAccountId`).
  Period lock + approval + accounting policy are all honored via
  the existing `PostingGateway`. Sub-ledger and GL remain tied
  after posting.

Posting is wrapped in `transactionManager.runTransaction` so a
failure on any side (sub-ledger write, item costing stats write,
or voucher post) rolls everything back.

## Costing basis

`InventorySettings.costingBasis` decides the revaluation scope:

- **`WAREHOUSE`** — Required `warehouseId` on every line. Posting
  re-prices only the named level. Cross-warehouse revaluation is a
  single document with multiple lines (one per warehouse).
- **`GLOBAL`** — No `warehouseId` allowed. The use case reads
  **all** `StockLevel` rows for the item, computes the company-wide
  weighted average from the totals, and posting re-prices every
  level to the new company average. The line's `qtyOnHand` is the
  **sum across warehouses** so the value delta matches the company
  total.

## GL posting rule

The revaluation use case builds a Dr/Cr pair per line, with the
absolute value of the delta:

```
Upward revaluation (valueDeltaBase > 0):
  Dr  Inventory Asset  (item.inventoryAssetAccountId or default)
  Cr  Inventory Revaluation / Variance  (defaultInventoryRevaluationAccountId)

Downward revaluation (valueDeltaBase < 0):
  Dr  Inventory Revaluation / Variance
  Cr  Inventory Asset
```

If the item has no `inventoryAssetAccountId`, the use case falls
back to `InventorySettings.defaultInventoryAssetAccountId`. If
neither is set, the use case refuses to post with a readable
error. The dedicated revaluation account **must** be configured
in Inventory Settings for INVOICE_DRIVEN / PERPETUAL posting;
otherwise the use case blocks with a readable error.

## Entity and persistence

`backend/src/domain/inventory/entities/InventoryRevaluation.ts`
is the aggregate root.

```ts
interface InventoryRevaluationLine {
  itemId: string;
  warehouseId?: string;       // WAREHOUSE only
  qtyOnHand: number;          // read-only, snapshot at draft time
  currentAvgCostBase: number; // read-only
  currentAvgCostCCY: number;  // read-only
  newAvgCostBase: number;     // user input
  newAvgCostCCY: number;      // user input (or derived from newAvgCostBase)
  valueDeltaBase: number;     // = qtyOnHand * (newAvgCostBase - currentAvgCostBase)
  valueDeltaCCY: number;
}
```

Append-only audit fields: `createdBy`, `createdAt`, `postedAt`,
`voucherId`. Once a revaluation is `POSTED` it cannot be edited
or deleted via the API — corrections happen through a paired
corrective revaluation (deferred feature).

### Persistence

- **Firestore:** `companies/{companyId}/inventory/Data/inventory_revaluations/{id}`
  via `FirestoreInventoryRevaluationRepository` using
  `getInventoryCollection` paths and the new
  `InventoryRevaluationMapper` (with `stripUndefinedDeep` to avoid
  the Firestore `undefined` rejection).
- **Prisma:** Two new models — `InventoryRevaluation` and
  `InventoryRevaluationLine` — with company-scope index, status
  index, date index, and `@@unique([companyId, documentNo])`.
  The Item model gained the matching `inventoryRevaluationLines`
  inverse relation. Both are wired in `bindRepositories.ts`
  (`inventoryRevaluationRepository`).
- **Tenant scope:** single-document reads are company-scoped in both
  repository implementations. Firestore reads from the current
  company's inventory collection path; Prisma reads by `{ companyId,
  id }`.

## Use cases

`backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts`
houses four thin use cases:

- **`CreateInventoryRevaluationUseCase`** — re-reads the sub-ledger
  for every line to authoritatively snapshot `qtyOnHand`,
  `currentAvgCostBase`, `currentAvgCostCCY`; computes
  `valueDeltaBase/CCY`; refuses to draft when all deltas are
  zero or when `costingBasis = GLOBAL` and the line carries a
  `warehouseId`.
- **`PostInventoryRevaluationUseCase`** — runs everything inside
  `transactionManager.runTransaction`. Re-snapshots each level in
  the same transaction (so the value delta is sourced from the
  authoritative on-hand at post time, not the stale draft display),
  writes the new `avgCostBase/CCY` + `lastCostBase/CCY` on the
  target `StockLevel`, updates `Item.costingStats.avgCost` from the
  full level snapshot (so WAREHOUSE costing remains weighted across
  all warehouses), posts the GL voucher (if applicable), and updates
  the revaluation document to `POSTED` in the same transaction. Rolls
  back wholesale if the GL post throws.
- **`ListInventoryRevaluationsUseCase`** — supports status filtering
  and limit/offset.
- **`GetInventoryRevaluationUseCase`** — single revaluation read.

## API surface

| Method | Path | Permission | Notes |
|---|---|---|---|
| `POST` | `/api/v1/tenant/inventory/revaluations` | `inventory.stock.adjust` | Create draft. Body: `date`, `reason`, `notes?`, `lines[{itemId, warehouseId?, newAvgCostBase, newAvgCostCCY}]` |
| `GET` | `/api/v1/tenant/inventory/revaluations?status=DRAFT\|POSTED` | `inventory.stock.adjust` | List company revaluations |
| `GET` | `/api/v1/tenant/inventory/revaluations/:id` | `inventory.stock.adjust` | Single revaluation |
| `POST` | `/api/v1/tenant/inventory/revaluations/:id/post` | `inventory.stock.adjust` | Post (returns updated revaluation with `voucherId` when applicable) |

The controller is `InventoryController.{createInventoryRevaluation, listInventoryRevaluations, getInventoryRevaluation, postInventoryRevaluation}` in
`backend/src/api/controllers/inventory/InventoryController.ts`. Each handler
is a thin adapter that delegates to the use case; no domain or
application logic lives in the controller.

## Validation

`validateCreateInventoryRevaluationInput` enforces:

- `date` is `YYYY-MM-DD`.
- `reason` is one of `COST_CORRECTION`, `BASIS_CHANGE`,
  `MIGRATION_FIX`, `WRITE_OFF`, `OTHER`.
- `lines` is a non-empty array.
- Each line has a non-empty `itemId`, non-negative
  `newAvgCostBase` and `newAvgCostCCY`.
- `warehouseId` is a non-empty string when supplied.

The use case enforces deeper invariants (zero-delta rejection,
GLOBAL warehouse rejection, item not found, posting-only-DRAFT,
qty-must-be-positive, etc.).

## Frontend surface

- `frontend/src/modules/inventory/pages/InventoryRevaluationPage.tsx`
  — list + scaffold form pattern, reuses
  `DocumentDetailScaffold`, `ClassicLineItemsTable`,
  `OperationalListLayout`, the shared `ItemSelector`,
  `WarehouseSelector`, and `DatePicker`. The post action
  always uses the shared `ConfirmDialog` (warning tone) and toasts
  on every server response. The "New Avg Cost" column is the only
  editable column — qty and current avg cost are read-only.
- `frontend/src/api/inventoryApi.ts` —
  `createInventoryRevaluation`, `listInventoryRevaluations`,
  `getInventoryRevaluation`, `postInventoryRevaluation`.
- `frontend/src/router/routes.config.ts` — three new routes:
  `/inventory/revaluations` (list), `/new`, `/:id` (detail).
- `frontend/src/config/moduleMenuMap.ts` — added **Revaluations**
  to Inventory → Forms with the `Scale` icon and
  `inventory.stock.adjust` permission.
- `frontend/src/locales/{en,ar,tr}/common.json` — `revaluations`
  sidebar label plus the page's `inventory.revaluations.*` labels,
  placeholders, readiness rows, confirm copy, toasts, columns, and
  reason labels in English, Arabic, and Turkish.

## Revaluation-aware valuation replay

Value-only revaluations do not create `StockMovement` rows, so
historical/reporting paths that rebuild stock state from movements
must also replay posted revaluations. The shared helper in
`backend/src/application/inventory/services/InventoryRevaluationReplayService.ts`
builds a dated event stream from movements and posted revaluations:

- movement events apply the movement ledger's authoritative
  `qtyAfter` and `avgCost*After` state;
- revaluation events leave quantity unchanged and overwrite the
  average/last cost for the target item/level;
- `GLOBAL` revaluations apply to every positive on-hand level for
  the item; `WAREHOUSE` revaluations apply only to the named level.

The helper is used by `InventoryValuationService` for historical
as-of valuation, `GetAsOfValuationUseCase` for period-snapshot
replay, and `ReconcileStockUseCase` so reconciliation does not
falsely report posted value-only revaluations as movement/level
mismatches.

## Operational safety

- **Quantity is never touched.** No `StockMovement` is written.
  The use case re-prices `StockLevel.avgCostBase/CCY` and
  `lastCostBase/CCY` and refreshes `Item.costingStats.avgCost`,
  but `qtyOnHand`, `reservedQty`, `postingSeq`, `totalMovements`,
  and `maxBusinessDate` stay untouched. The revaluation
  re-prices **in place** — same `StockLevel.id`, same qty, new
  cost.
- **Zero-qty protection.** The post use case refuses to revalue
  an item with zero on-hand quantity (you cannot revalue an
  empty stock position; that's a different conversation and
  would create phantom GL).
- **No direct mutation of posted revaluations.** The repository
  API has no `updateRevaluationLines` path; a revaluation
  flipped to `POSTED` cannot be re-edited or re-posted. A
  corrective revaluation (a future enhancement) is the only
  way to undo.
- **Approval & period-lock honored.** The GL voucher goes
  through the same `SubledgerVoucherPostingService.postInTransaction`
  used by every other inventory-origin ledger write. In strict
  mode (`ApprovalRequiredPolicy` active) the existing
  fail-closed approval guard (`SubledgerVoucherPostingService.resolveApproved`)
  applies — without an explicit `approved: true` the post will
  be rejected. Period-lock checks run inside the same service
  via the optional `PeriodLockService`.
- **Permission gate.** All four routes are guarded by
  `inventory.stock.adjust`. The same permission used for stock
  adjustment and transfers — intentional: it's the same
  operational authority.

## Tests

`backend/src/tests/application/inventory/InventoryRevaluationUseCases.test.ts`
and `backend/src/tests/application/inventory/services/InventoryValuationService.test.ts`
cover the contract:

1. Draft snapshots sub-ledger qty/avg and computes the value
   delta authoritatively.
2. Draft refuses when all deltas are zero.
3. Draft refuses a `warehouseId` when costing basis is `GLOBAL`.
4. INVOICE_DRIVEN write-up: qty unchanged, avg updated, voucher
   balances, GL moves by the delta.
5. INVOICE_DRIVEN write-down: routes Dr Variance / Cr Asset
   using the absolute value of the delta.
6. GLOBAL costing re-prices every warehouse to the new company
   average.
7. WAREHOUSE costing revalues only the named warehouse.
8. PERIODIC mode updates the sub-ledger but does **not** post a
   GL voucher.
9. Posting refused when no Inventory Revaluation account is
   configured.
10. Posting refused on a line with zero on-hand quantity.
11. Re-posting a non-DRAFT revaluation is refused.
12. Sub-ledger writes roll back when the GL voucher post throws.
13. Smoke guard: `PostInventoryRevaluationUseCase` is constructor
    compatible with `SubledgerVoucherPostingService`.
14. Single-document reads are tenant-scoped by `companyId`.
15. WAREHOUSE costing refreshes item-level average cost as a weighted
    average across all warehouses, not as the revalued warehouse cost.
16. Stock reconciliation replays posted revaluations and remains clean
    after a value-only cost change.
17. Historical inventory valuation includes posted revaluations in
    as-of average-cost valuation.

## Follow-ups (intentionally not in this slice)

- **Corrective revaluation** (reverse/undo). For a posted
  revaluation the user can already create a paired reverse
  revaluation manually, but a one-click "create reverse" button
  with audit linkage (`reversesRevaluationId` /
  `reversedByRevaluationId`) is deferred.
- **Bulk CSV revaluation** — out of scope per the brief.
- **FX revaluation of foreign-currency cost layers** — out of
  scope per the brief.

## Related docs

- `docs/architecture/inventory.md` — Stock Adjustment,
  Stock Transfer, Opening Stock, valuation.
- `docs/architecture/posting-authority.md` — approval /
  period-lock flow.
- `docs/user-guide/inventory/inventory-revaluation.md` — plain
  end-user walkthrough.
- `planning/tasks/223-inventory-revaluation-value-only-correction.md`
  — original task spec.
- `planning/briefs/20260620-inventory-revaluation-document.md` —
  the implementing brief.
