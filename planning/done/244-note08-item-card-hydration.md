# Task 244 NOTE-08 — Item Card Hydration Fix

**Date:** 2026-06-19  
**Branch:** `codex/244-note08-item-card-hydration`  
**Status:** Implemented, pending PR review/merge  
**Actual time:** ~0.4h

## Scope

Implemented only Task 244 NOTE-08 from `planning/tasks/244-item-uom-card-bugfix-cluster.md`.

## Technical Developer View

### Root cause

`ItemsListPage` opens item windows with `data: { id: item.id }`, but `ItemCardWindow` only passed `win.data?.itemId` into `ItemMasterCard`. In Windows mode, existing items therefore reached `ItemMasterCard` without an item id. The card interpreted that as a new item and rendered the blank default form even though the window title and list row data were correct.

### Fix

Updated `frontend/src/modules/inventory/components/ItemCardWindow.tsx` so the wrapper passes `win.data?.itemId ?? win.data?.id` to `ItemMasterCard`.

This keeps compatibility with both payload shapes and leaves the item API, backend repository, UOM conversion logic, posting, valuation, and accounting behavior unchanged.

### Files changed

- `frontend/src/modules/inventory/components/ItemCardWindow.tsx`
- `docs/architecture/inventory.md`
- `docs/user-guide/inventory/item-master-card.md`
- `planning/done/244-note08-item-card-hydration.md`
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`
- `planning/PRIORITIES.md`

## End-User View

When a user opens an existing item from `Inventory -> Items`, the item card now shows the saved item details instead of a blank card. The same behavior applies in Windows mode and normal page mode.

Users can edit the populated fields, save, and reopen the item to confirm the values stayed saved.

## Acceptance Criteria

- Existing item opens populated from the list in Windows mode.
- Existing item still opens through the normal route in page mode.
- Edits continue to save through the existing `ItemMasterCard` save flow.
- NOTE-09, NOTE-10, NOTE-11, and NOTE-14 remain out of scope for this slice.

## Verification

- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

## Residual Risk

Browser/manual round-trip still needs confirmation on the owner's live tenant because this worker slice validated the code path and frontend build, not an authenticated live item edit.
