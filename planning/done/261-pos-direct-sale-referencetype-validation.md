# Task 261 — Fix `Invalid referenceType: POS_DIRECT_SALE` at POS posting

**Status:** ✅ Complete
**Date completed:** 2026-06-23
**Branch:** `main`
**Time spent:** ~0.4h
**Linked plan:** _(none — hotfix discovered during owner QA)_
**Linked architecture doc:** [`docs/architecture/pos.md`](../../docs/architecture/pos.md), [`docs/modules/inventory/SCHEMAS.md`](../../docs/modules/inventory/SCHEMAS.md)
**Linked user guide:** [`docs/user-guide/pos/selling.md`](../../docs/user-guide/pos/selling.md) _(already documents the `POS_DIRECT_SALE` identity; no new guide needed for this restore-of-intended-behavior fix)_

---

## Definition of Done — Checklist

- [x] Code merged _(on `main`)_
- [x] `docs/architecture` / schema doc updated — `docs/modules/inventory/SCHEMAS.md` `ReferenceType` enum aligned
- [x] User guide — existing `docs/user-guide/pos/selling.md` already covers `POS_DIRECT_SALE`; no new guide required
- [x] This completion report links the docs above
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Built

Owner QA on the POS terminal hit a blocking **"Critical Error — Invalid referenceType: POS_DIRECT_SALE" (INFRA_999)** when completing a sale. Root cause was a **validation drift** inside the inventory domain entity: the `ReferenceType` **type** in `StockMovement.ts` already listed `'POS_DIRECT_SALE'` and `'POS_RETURN'` (so TypeScript compiled cleanly), but the parallel **runtime guard array** `REFERENCE_TYPES` — the list the entity constructor checks `props.referenceType` against — was never updated when the native POS posting path was introduced (Epic 250 / Task 250d). When `PostPosSaleUseCase` posts the stock-OUT movement via the shared inventory engine with `refs.type = 'POS_DIRECT_SALE'`, the constructor failed the membership check and threw.

Fix: add the two POS values to the runtime array so it matches the type (and the existing unit-test expectations). One-line, behavior-restoring change.

### Files Changed

**Backend**
- `backend/src/domain/inventory/entities/StockMovement.ts` — added `'POS_DIRECT_SALE'` and `'POS_RETURN'` to the runtime `REFERENCE_TYPES` array (the `ReferenceType` type already had them).

**Docs**
- `docs/modules/inventory/SCHEMAS.md` — `ReferenceType` enum brought in line (was missing the POS values).
- `planning/done/261-pos-direct-sale-referencetype-validation.md` (this report)
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`

### Architecture / Behavior

- The `ReferenceType` **type** and the `REFERENCE_TYPES` **runtime array** are two hand-maintained copies of the same set; they had silently diverged. The type guards compile-time call sites; the array guards runtime construction (including data deserialized from persistence). Both must list every value.
- `MOVEMENT_TYPES` already contained `SALES_DELIVERY` (POS sale OUT) and `RETURN_IN` (POS return IN), so no movement-type change was required.
- Production wiring was already correct — POS posts natively *as itself* (`POS_DIRECT_SALE` / `POS_RETURN`), never silently converted to a sales invoice (POS independence audit gate #8). This fix lets that intended path actually persist.

### Verification

- [x] `cd backend && npx jest PostPosSale RecordStockMovement` — `PostPosSale.test.ts` + `RecordStockMovementUseCase.test.ts` green (38 tests). These exercise the exact `POS_DIRECT_SALE` stock-movement construction that was throwing.
- [x] `cd backend && npm run build` (tsc) clean — recompiled to `lib/` so the emulator serves the fix (emulator runs compiled `lib/`, not `src/`).
- [x] Manual golden path: re-run a POS sale in the terminal — completes without the INFRA_999 dialog.

### Known Issues / Follow-ups

- **Pre-existing, unrelated:** `backend/src/tests/application/pos/PostPosReturn.test.ts` fails to *compile* (TS2554) — it constructs `new PostPosReturnUseCase(...)` with 7 args but the class now requires 8 (`posSettingsRepo`). Production wiring (`PosController.ts:1023`) already passes all 8; only the test is stale. Flagged as a separate task to add the missing mock arg.
- **Latent class:** the type/array duplication in `StockMovement.ts` is the kind of drift that bit us here. A future cleanup could derive the array from the type (e.g. a single `const` tuple as the source of truth) so they can never diverge again — out of scope for this hotfix.

---

## 2. End-User View

### What's New

A blocking error that appeared when ringing up a sale at the POS till ("Critical Error — Invalid referenceType: POS_DIRECT_SALE") is fixed. Sales and returns at the till now post normally.

### How to Use It

1. Open the POS terminal.
2. Ring up items and complete the sale as usual.
3. The sale posts without the error dialog.

### Where to Find It

- Menu: POS → Terminal
- No setting to change — the fix is automatic.

### Limitations

- None for this fix. It restores the intended behavior; nothing about how sales, stock, or accounting work has changed.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
