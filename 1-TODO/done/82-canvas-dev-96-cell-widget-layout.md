# Canvas Dev 96-Cell Widget Layout Sandbox

**Date:** 2026-05-10  
**Status:** Complete  
**Estimate:** 60-90m  
**Actual time:** ~1h 10m  

## Technical Developer View

Added a dev-only candidate implementation for the next top-bar widget layout system in `frontend/src/pages/dev/CanvasDevPage.tsx`.

What changed:
- Added `PrecisionWidgetConfig` with `id`, `type`, `span`, `colStart`, `label`, and style options.
- Added `PRECISION_MAX_CELLS = 96` and `PRECISION_MIN_WIDGET_SPAN = 8`.
- Added a 96-cell CSS grid implementation using `@dnd-kit/core`.
- Added local sandbox widget state so testing does not mutate the production widget store.
- Added widget templates for clock, date, logo, text, weather, and battery.
- Added exact widget movement controls:
  - Left/right buttons move by one grid cell.
  - Width input updates `span` directly.
  - Minimum width is enforced at 8 cells.
- Added style controls for bold, border, and background.
- Added remove widget and auto-align tools.
- Updated quick controls to show only on the selected widget, preventing overlapping control bars when widgets sit close together.
- Replaced mocked demo widgets with the real top-bar widget components from the application registry.
- Fixed bold styling so it affects the real widget contents.
- Replaced background cycling with a compact color swatch panel.
- Disabled real widget internal backgrounds and borders inside the 96-cell candidate so the sandbox wrapper controls visual styling cleanly.
- Hid the older experiments behind a toggle so the new candidate can be tested in isolation.
- Fixed the legacy React Grid Layout experiment's coordinate feedback loop by converting 48-cell demo coordinates back before saving to the shared widget store.

Files changed:
- `frontend/src/pages/dev/CanvasDevPage.tsx`
- `ACTIVE.md`
- `JOURNAL.md`
- `1-TODO/done/82-canvas-dev-96-cell-widget-layout.md`

Verification:
- `frontend`: `npm run typecheck` passed.
- `frontend`: `npm run build` passed.

Known notes:
- This is intentionally not wired into production `TopBar` yet.
- Browser QA should focus on whether the 96-cell precision controls feel better than the current top-bar widget area before porting.

## End-User View

The Canvas Dev page now has a test version of a more precise top-bar widget editor.

What you can test:
- Open `/canvas-dev`.
- Use the first section, `96-Cell Precision Grid`.
- Click `Edit & Layout` to switch editing on or off.
- Add real top-bar widgets like company logo, fiscal year, base currency, approval mode, UI mode, clock, date, notes, or alarm.
- Click one widget to show its compact controls.
- Move widgets left or right one tiny step at a time.
- Type an exact widget width.
- Toggle simple styling such as border and bold text.
- Open the background picker and choose a color swatch.
- Use `Auto Align` to pack widgets neatly.

This does not change the real app top bar yet. It is a safe test area for deciding whether this layout should replace the existing widget area.
