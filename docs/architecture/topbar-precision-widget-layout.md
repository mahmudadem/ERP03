# Topbar Precision Widget Layout

## Purpose

The production top bar now uses a 96-cell horizontal precision grid for widget placement. This gives enough resolution for small top-bar widgets while keeping all placement data simple and SQL-migration-ready in the frontend preference store.

## Files

- `frontend/src/components/topbar/DraggableWidgetSpace.tsx` — renders the precision grid, widget wrappers, drag behavior, selected-widget controls, background picker, and border variants.
- `frontend/src/layout/TopBar.tsx` — owns the unified layout actions menu and auto-align command.
- `frontend/src/store/widgetStore.ts` — owns default widget definitions, 96-cell layout values, and persisted style fields.
- `frontend/src/pages/dev/CanvasDevPage.tsx` — keeps the earlier sandbox for comparing the precision layout against older experiments.

## Layout Model

- The top bar has `96` columns.
- Each widget has an `x` position and `w` width in cells.
- Minimum widget width is `8` cells.
- Auto-align divides `96` by the number of visible widgets and assigns remainder cells to the first widgets.
- The widget grid keeps internal padding so widgets use the available bar height without touching the parent edges.

## Styling Model

The precision wrapper owns the top-bar widget presentation:

- Child widgets are rendered with internal background and border disabled.
- `isBold` applies a wrapper-level typography override.
- `bgColor` selects a neutral or colored background swatch.
- `borderVariant` controls border intensity.
- Border color is derived from the chosen widget background so colored widgets keep a matching outline.

## Migration Notes

The persisted key changed from `topbar-widgets-grid` to `topbar-widgets-precision-grid`. This avoids loading incompatible legacy layout coordinates into the 96-cell grid.

When adding a new top-bar widget:
1. Add it to the existing widget registry.
2. Add it to the layout actions add-widget list.
3. Choose a default width of at least `8` cells.
4. Let the wrapper own border/background styling unless the widget needs a domain-specific visual state.

## Verification

- `npm run typecheck` from `frontend/`
- `npm run build` from `frontend/`
