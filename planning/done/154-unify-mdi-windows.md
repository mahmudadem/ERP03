# Completion Report - Unify MDI Windows

Unify the multi-window desktop shell wrappers and eliminate coordinate transitions/text selection highlighting issues inside the Windows UI mode.

## What Was Changed

We consolidated the desktop windowing code around a single standard window frame component (`MdiWindowFrame.tsx`), deleted the buggy and duplicate `DraggableWindow.tsx`, and fixed pointer event selection leaks during drag/resize.

### Modified Files:
- [MdiWindowFrame.tsx](file:///d:/DEV2026/ERP03/frontend/src/components/mdi/MdiWindowFrame.tsx) — Added `e.preventDefault()` inside dragging/resizing `mousedown` handlers to stop default browser text-selection actions.
- [WindowsDesktop.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/WindowsDesktop.tsx) — Replaced `DraggableWindow` with the standardized `MdiWindowFrame` wrapper for `sales_invoice` window types.
- [ItemCardWindow.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/inventory/components/ItemCardWindow.tsx) — Swapped `DraggableWindow` for `MdiWindowFrame`.
- [PartyCardWindow.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/PartyCardWindow.tsx) — Swapped `DraggableWindow` for `MdiWindowFrame`.
- [WarehouseCardWindow.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/WarehouseCardWindow.tsx) — Swapped `DraggableWindow` for `MdiWindowFrame`.
- [ReportWindow.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/ReportWindow.tsx) — Overhauled and simplified this component by stripping out duplicate resizing, movement, and header HTML, delegating window management to `MdiWindowFrame`.

### Deleted Files:
- `DraggableWindow.tsx` — Deleted as it is now completely replaced by `MdiWindowFrame`.

---

## What Was Tested

### Automated Tests
- Verified type check: `npm --prefix frontend run typecheck` completed with exit code 0.
- Verified production bundling: `npm --prefix frontend run build` completed with exit code 0, verifying routing, imports, and checking script validation.

### Manual Verification Path
1. Open the application shell in **Windows Mode** (`uiMode === 'windows'`).
2. Open a Sales Invoice, a Customer Card, a Ledger Report, and a standard Voucher.
3. Verify that dragging any window:
   - Responds instantly to pointer coordinates (no 300ms transition lag).
   - Never selects or highlights text in the background workspace or adjacent windows.
4. Verify window resizing behaves identically (instant updates, no highlighting).

---

## Documentation

### Technical Developer View
* **Root Cause:**
  1. The `DraggableWindow.tsx` wrapper used unconditionally the CSS transition `transition-all duration-300` on the root node wrapper. This delayed style properties (like absolute `top`/`left`) from tracking mouse moves directly, introducing a 300ms lag.
  2. The dragging and resizing event handlers on both `DraggableWindow` and `MdiWindowFrame` did not prevent browser default click selection. Because `DraggableWindow` lagged behind the cursor, the cursor departed the window header/handles and dragged over background text. The browser registered this as text-selection dragging.
  3. `ReportWindow.tsx` duplicated drag/resize state and styles instead of delegating to a shared helper.
* **Resolution:**
  - Standardized the window frame mapping inside `WindowsDesktop.tsx` to wrap `sales_invoice`, `item`, `party`, and `warehouse` in `MdiWindowFrame`.
  - Stripped `ReportWindow` to delegate layout structure and interactions entirely to `MdiWindowFrame`.
  - Added `e.preventDefault()` calls on header-dragging and boundary-resizing mouse events in `MdiWindowFrame` to suppress the browser's default text highlighting engine.

### End-User View
* **Window Drag & Resize Fix:**
  Previously, when using the desktop window layout (Windows UI mode), resizing or dragging certain windows like the Sales Invoice, Reports, and Master Data Cards would feel sluggish and cause background text to get selected (highlighted in blue).
  We have fixed this:
  - All windows now move instantly and track your mouse cursor exactly.
  - Background text is no longer accidentally selected or highlighted when dragging or resizing windows.
  - The behavior of all windows is now standardized so they open, close, minimize, maximize, drag, and resize in the exact same smooth manner.
