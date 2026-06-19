# Task 244 NOTE-14 - Line UOM Picker Uses Item Conversions

**Date:** 2026-06-19
**Branch:** `codex/244-note14-line-uom-picker`
**Scope:** Task 244 NOTE-14 only.
**Actual time spent:** ~0.8h

## Technical Developer View

Fixed the shared document line UOM selector so item-level conversions returned by the inventory API are unwrapped
and included in the selectable UOM list.

Files changed:

- `frontend/src/components/shared/selectors/UomSelector.tsx`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/item-uom-selection.md`
- `planning/done/244-note14-line-uom-picker.md`
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`

Root cause:

`UomSelector` called `inventoryApi.listUomConversions(itemId)` but treated the result as a raw array. Other document
pages unwrap API responses before passing conversions to `buildItemUomOptions()`. When the selector received a
wrapped response, it stored `[]`, so the picker displayed only the base UOM.

Fix:

- Added local API response unwrapping in `UomSelector`.
- Stored active conversion responses as arrays only after unwrap.
- Changed focus behavior so the selector fetches item UOMs even when the current option list has only one entry.
- Preserved the existing document line payload shape: `uomId` and `uom`.

Not changed:

- No backend posting logic.
- No inventory valuation logic.
- No item-card conversion add/edit/delete behavior beyond reading/displaying existing conversions.

## End-User View

When an item has a defined alternate UOM conversion, that alternate UOM now appears in sales and purchase document
line UOM pickers.

Example:

- Item base UOM: BOX
- Conversion: BOX to PCS
- Document line picker now allows selecting PCS as well as BOX

Users still maintain UOM conversions from the item card. The document line picker only lets users choose from UOMs
already defined for the selected item.

## Acceptance

- BOX to PCS conversions are surfaced by the shared line UOM picker.
- PCS can be selected without changing the `uomId` / `uom` payload contract.
- Scope stayed limited to NOTE-14.

## Verification

- `npm --prefix frontend run typecheck` - passed.
- `npm --prefix frontend run build` - passed, including `check:reports`, `check:no-confirm`, and `check:sod-approve`. Existing bundle-size/Browserslist/baseline-data warnings remain.
