# Task 244 NOTE-11 — UOM Conversion Delete Unused Rows

**Date:** 2026-06-19
**Branch:** `codex/244-note11-uom-delete-unused`
**Status:** Implemented; PR pending
**Estimate:** 0.8h
**Actual:** 0.9h

## Technical Developer View

### What changed

- Fixed `ManageUomConversionsUseCase.delete()` so it calls `IUomConversionRepository.deleteConversion(id)` instead of soft-setting `active: false`.
- Kept the existing API guard in `InventoryController.deleteUomConversion`: the backend checks conversion impact first and refuses delete when posted movements use the conversion.
- Updated `ItemMasterCard` delete behavior to:
  - fetch live impact before delete,
  - refuse used rows with visible error/toast feedback,
  - confirm unused-row deletion through the shared confirm dialog,
  - refresh conversions after delete,
  - show success/error toast feedback.
- Added a focused backend regression test proving the delete use case performs a real repository delete.

### Files changed

- `backend/src/application/inventory/use-cases/UomConversionUseCases.ts`
- `backend/src/tests/application/inventory/UomConversionUseCases.test.ts`
- `frontend/src/modules/inventory/components/ItemMasterCard.tsx`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/README.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/PRIORITIES.md`

### Accounting / ERP impact

This is master-data maintenance only. It does not change posting math, stock movement creation, valuation, AR/AP, tax, vouchers, or ledger behavior.

The important control is preserved: once a UOM conversion has been used by posted stock/sales/purchase movements, it is refused for deletion so historical quantities and valuation traces remain auditable. Only unused conversions can be physically removed.

### Acceptance covered

- Usage `0` conversion delete works because the use case now physically deletes the conversion row.
- Used conversion delete is refused before delete, with clear frontend feedback and the existing backend conflict guard.

## End-User View

On an item card, users can delete a UOM conversion only when the system confirms that no posted movement has used it yet. If the conversion was already used in posted purchases, sales, or stock movements, ERP03 blocks deletion and explains that the conversion is part of the posted history.

This means a mistaken unused conversion can be cleaned up, but historical documents and stock quantities stay protected.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/application/inventory/UomConversionUseCases.test.ts`
- `npm --prefix backend run build`
- `npm --prefix frontend run typecheck`

## Known Follow-ups

- Manual browser QA still needed on a live item card: delete one unused conversion and attempt to delete one used conversion.
- Other Task 244 notes remain separate slices: NOTE-09, NOTE-10, and NOTE-14.
