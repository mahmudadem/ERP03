# Task 262 — Fix `Firestore transactions require all reads before writes` (INFRA_005) on POS posting

**Status:** ✅ Complete
**Date completed:** 2026-06-23
**Branch:** `main`
**Time spent:** ~1.6h
**Linked plan:** _(none — hotfix discovered during owner QA, immediately after [261](./261-pos-direct-sale-referencetype-validation.md))_
**Linked architecture doc:** [`docs/architecture/pos.md`](../../docs/architecture/pos.md) §3 (transaction-safety note)
**Linked user guide:** [`docs/user-guide/pos/selling.md`](../../docs/user-guide/pos/selling.md) _(behaviour is unchanged for the user — a blocking error is removed; no new guide needed)_

---

## Definition of Done — Checklist

- [x] Code merged _(on `main`)_
- [x] `docs/architecture/pos.md` updated — transaction read/write discipline documented in §3
- [x] User guide — existing selling guide already covers POS sales; this fix removes a crash, no new feature surface
- [x] This completion report links the docs above
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Built

Right after the [261](./261-pos-direct-sale-referencetype-validation.md) fix, owner QA on the POS terminal hit a new blocking error: **"Firestore transactions require all reads to be executed before all writes" (INFRA_005)** when completing a sale.

`CompletePosSaleUseCase` runs the entire posting inside one Firestore transaction. POS posted inventory via the **stateful** `IInventoryCore.processOUT`, which reads the stock level **through the transaction** (`getLevelInTransaction`, `getLevelsByItemInTransaction`) and then writes. For a single-line cart that ordering is fine (reads-then-writes); for a **multi-line** cart, line 2's transactional read runs *after* line 1's writes — exactly what Firestore forbids. (The accounting bridge was already transaction-safe: its account/policy/period-lock reads are non-transactional; only the ledger/voucher writes use the transaction.)

The fix aligns POS with the proven **Sales invoice** pattern: pre-fetch with bare reads, compute with pure helpers, then a write-only transaction phase. Applied to both the sale and the return (the return had the same latent defect).

### Files Changed

**Backend**
- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts` — replaced the per-line `processOUT` call with: bare-read pre-fetch of stock levels (`preFetchLevelsByItem`), pure `computeStockOutMovement` (mutates an in-memory level threaded across same-item lines), `item.costingStats` recompute (`buildAverageCostPoint` / `buildUpdatedItemCostingStats`), and a write-only phase (`writeStockMovement` + `writeStockLevel` + `itemRepo.updateItemInTransaction`) after the compute loop. `assertNegativeStockAllowed` now also re-asserts the company `allowNegativeStock` flag (previously enforced inside `processOUT`) so Task 258 semantics are preserved.
- `backend/src/application/pos/use-cases/PostPosReturnUseCase.ts` — same refactor using `computeStockReturnInMovement`.

**Tests**
- `backend/src/tests/application/pos/PostPosSale.test.ts` — mocks updated from `processOUT` to the prefetch/write seams; real `StockLevel` fixtures so the pure helper derives issue cost as in production.
- `backend/src/tests/application/pos/PostPosReturn.test.ts` — same; also resolves the stale 7-arg constructor (now 8 with `posSettingsRepo`).
- `backend/src/tests/application/pos/PosIndependentOfSalesApp.test.ts` — same mock/constructor update (was already failing to compile for the same missing-arg reason).
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` — guard 251 updated to assert POS identity via `referenceType: 'POS_DIRECT_SALE' | 'POS_RETURN'` (the new call shape) and to reject any `referenceType: 'SALES_*'`.

**Docs**
- `docs/architecture/pos.md`, `planning/done/262-*.md` (this), `planning/JOURNAL.md`, `planning/ACTIVE.md`.

### Architecture / Behavior

- **No costing/accounting math change.** Same moving-average issue cost (sale) and weighted-average recompute (return); same revenue/COGS/settlement vouchers; same persona/identity stamping. Only the *order* of reads vs writes inside the transaction changed (all reads first, then all writes), plus the helper used to compute the movement.
- **Negative-stock parity.** POS `BLOCK` policy → `PosNegativeStockError` (POS Settings message). Company `allowNegativeStock === false` while POS policy is `ALLOW`/absent → inventory `NegativeStockError` — same outcome `processOUT` produced, now asserted up front with bare reads (so it is also caught on the dry-run preview).
- **Why bare reads are safe mid-transaction.** Firestore only orders reads done *through* the transaction object. The repositories' non-transactional `getLevel` / `getLevelsByItem` are plain reads and are allowed at any point, which is why pre-fetch (and the existing party/item/settings reads) never tripped INFRA_005.

### Verification

- [x] `cd backend && npx tsc --noEmit` clean
- [x] `cd backend && npm run build` (tsc) clean — recompiled to `lib/` so the emulator serves the fix
- [x] POS suite: 15 suites / 109 tests green (incl. the two previously-uncompilable suites)
- [x] Broad sweep: `pos` + `sales` + `inventory` + `architecture` = 62 suites / 517 tests green
- [x] Manual golden path: ring up a **multi-line** POS sale in the terminal — posts without the INFRA_005 dialog

### Known Issues / Follow-ups

- The pre-existing duplication between the `ReferenceType` type and the runtime `REFERENCE_TYPES` array (root cause of 261) remains a latent drift risk; deriving one from the other is a future cleanup, out of scope here.
- A background worktree was spun off earlier to fix `PostPosReturn.test.ts`'s stale constructor; that work is now superseded by this task (the test is fixed here). The worktree can be discarded.

---

## 2. End-User View

### What's New

A blocking error when completing a sale with **more than one item** in the cart ("Firestore transactions require all reads to be executed before all writes") is fixed. Multi-item POS sales and returns now post normally.

### How to Use It

1. Open the POS terminal and add several items to the cart.
2. Take payment and complete the sale.
3. The sale posts without any error dialog.

### Where to Find It

- Menu: POS → Terminal
- No setting to change — the fix is automatic.

### Limitations

- None. Stock, costing, and accounting behave exactly as before; only the crash is removed.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
