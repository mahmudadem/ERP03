# Task 244 NOTE-09 — Item UOM Conversions Web/Windows Parity

**Date:** 2026-06-19  
**Branch:** `codex/244-note09-uom-web-windows-parity`  
**Status:** Complete; PR opened for review  
**Time spent:** ~0.7h

## Technical Developer View

### Scope

Implemented only Task 244 NOTE-09 from `planning/tasks/244-item-uom-card-bugfix-cluster.md`.

The fix keeps Web and Windows mode behavior aligned for the item master card: UI mode may change the shell/window
rendering, but it must not remove business sections such as **Item UOM Conversions**.

### Root Cause

`ItemsListPage` opened Windows item cards with `data.id`, while `ItemCardWindow` read only `win.data?.itemId`.

That mismatch meant a Windows item card could mount without the selected item id. The shared `ItemMasterCard` then
treated the card like a new/empty item, making existing-item Stock Control/UOM conversion maintenance appear unavailable
compared with Web mode.

### Files Changed

- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
  - Changed Windows item-card open payloads from `data.id` to `data.itemId`.
- `frontend/src/modules/inventory/components/ItemCardWindow.tsx`
  - Reads `win.data.itemId` with a fallback to legacy `win.data.id`.
- `docs/architecture/inventory.md`
  - Documented item-card Web/Windows parity and the window payload contract.
- `docs/user-guide/inventory/README.md`
  - Documented that item UOM conversions are maintained from the item card Stock Control tab in both modes.

### Nearby Audit

Audited `ItemMasterCard.tsx` for conditional hiding by mode. No `isWindow`/Windows conditional hides the UOM conversion
section or any nearby item-card section. The item card already renders **Managed UOM Defaults** and **Item UOM
Conversions** under the Inventory tab for both modes once the selected item identity is correctly supplied.

## End-User View

When a user opens an item from `Inventory → Items`, the item card behaves consistently in Web mode and Windows mode.

To edit UOM conversions:

1. Open `Inventory → Items`.
2. Open an existing item.
3. Go to the **Stock Control** tab.
4. Use **Item UOM Conversions** to manage relationships such as `BOX → PCS`.

Windows mode now frames the item card as a desktop window, but it still shows the same Stock Control sections as Web
mode.

## Verification

- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

## Residual Risk

No automated browser smoke was added in this slice. Manual QA should still open an existing item in both Web and Windows
modes and confirm the **Stock Control → Item UOM Conversions** section appears and loads existing conversions.
