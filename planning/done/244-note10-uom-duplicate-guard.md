# Task 244 NOTE-10 — UOM duplicate conversion guard

**Date:** 2026-06-19  
**Branch:** `codex/244-note10-uom-duplicate-guard`  
**Status:** Implemented, verified, PR-ready  
**Actual time spent:** ~1.6h

## Technical Developer View

### What changed

- Added a central backend duplicate-pair guard in `ManageUomConversionsUseCase`.
- The guard resolves/normalizes From and To UOMs before checking existing active conversions for the same item.
- Create and update now reject a second active conversion with the same `From UOM -> To UOM` pair.
- Inactive conversions are ignored by the guard so a deleted/disabled unused conversion does not reserve the pair forever.
- The Item Master Card now detects a duplicate draft pair before submitting and tells the user to update the existing row factor instead.
- Added focused backend tests for create duplicate blocking, inactive-pair recreation, and update-to-duplicate blocking.

### Files changed

- `backend/src/application/inventory/use-cases/UomConversionUseCases.ts`
- `backend/src/tests/application/inventory/UomConversionUseCases.test.ts`
- `frontend/src/modules/inventory/components/ItemMasterCard.tsx`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/README.md`
- `planning/done/244-note10-uom-duplicate-guard.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/PRIORITIES.md`

### Accounting / ERP impact

This is an inventory master-data control fix. It does not change posted stock movements, GL vouchers, tax, AR/AP, or inventory valuation math. It prevents a data-integrity defect where two active conversion factors for the same item and UOM pair could make document-line quantity conversion, cost conversion, and per-UOM price memory ambiguous.

### Acceptance criteria met

- Duplicate same From/To pair is blocked in the backend write path.
- The Item card warns users before submitting a duplicate draft pair.
- Ambiguous active factors cannot coexist through the normal create/update use case.
- Existing inactive/deleted conversions do not block recreating a valid pair.

### Verification

- `npm --prefix backend test -- --runTestsByPath src/tests/application/inventory/UomConversionUseCases.test.ts`
- `npm --prefix backend run build`
- `npm --prefix frontend run typecheck`

## End-User View

When editing an item's UOM conversions, ERP03 now keeps one clear conversion per From/To pair. If `BOX -> PCS` already exists, users should update that existing row's factor instead of adding a second `BOX -> PCS` row. This keeps quantities and prices predictable when documents use alternate UOMs.

## Known follow-ups

- NOTE-11 separately owns delete behavior for unused conversions.
- NOTE-14 separately owns making alternate UOMs reliably selectable on document lines.
