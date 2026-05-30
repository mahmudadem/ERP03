# 141 — Visual Layout Editor Polish & Auto Align

**Date:** 2026-05-30
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`
**Status:** ✅ Implemented & Verified

---

## 1. Technical View (Future Developers)

### Context & Bugs Addressed
1. **Grid Double Scaling (Migration Bug):**
   The `migrateTo24Columns` helper in [DocumentDesigner.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx) was checking if *any* field in classic/windows modes occupied the left side of the grid (i.e. `col + colSpan <= 12 && colSpan > 0 && colSpan < 12`). If true, it doubled the horizontal coordinates (`col` and `colSpan`). In a valid 24-column layout, small fields on the left met this condition, triggering false migrations and double-scaling coordinate values repeatedly on saves and reloads, resulting in all components clamping to a width of `24`.
2. **Properties Sidebar Layout Shifts:**
   Dragging or clicking components in the visual canvas automatically set `selectedField`, sliding the properties sidebar open and shifting/squishing the canvas. This was disruptive to field repositioning.
3. **Missing Width Labels:**
   It was difficult to know the exact grid column width span of components directly from the canvas layout boxes.
4. **Auto Placement Defaults:**
   Defaulting placement/missing field spans to `24` in classic mode forced vertical stacking instead of side-by-side grids.

### Implementation Details
* **Bug Fix for double-scaling:**
  * Added `metadata.layoutVersion = 2` flag to new document configurations.
  * Refactored `migrateTo24Columns` in [DocumentDesigner.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx) to:
    1. Instantly skip if `metadata.layoutVersion === 2` exists.
    2. Check if any field exceeds `12` columns width/offset (`colSpan > 12 || (col + colSpan) > 12`), which proves it is already a 24-column layout; if so, skip doubling and tag as `layoutVersion = 2`.
    3. Double coordinates ONLY if all fields genuinely fit inside 12 columns.
* **Properties Sidebar UX Polish:**
  * Removed `setSelectedField` triggers from dragging start and drop events in `handleDragStartField` and `handleDropField`.
  * Standard components and compact action buttons only update `selectedField` on click if the sidebar is *already open* (`selectedField !== null`).
  * Explicitly require clicking the Pencil edit icon (visible on hover) to slide open the properties sidebar.
  * Added the pencil edit button to grouped action containers.
* **Component Width Indicators:**
  * Rendered a clean monospace badge displaying `Width: {field.colSpan}` inside every field element on the design canvas.
* **Auto-Placement default to 6:**
  * Updated `runAutoPlacement()` defaults to use a width span of `6` (4 items per row) for all standard fields and actions in all modes.
* **Smart Auto Align Tool (`row = 4 * 6`):**
  * Added a **Auto Align** button to the designer toolbar.
  * Implemented `handleAutoAlign()` which rearranges fields in all layout sections sequentially: setting spans to `6` (except `lineItems` which is `24`), wrapping rows at a span boundary of `24`, and cleaning up `rowSpan` to `1`.

---

## 2. End-User View (User Guide)

### What Was Polished

1. **Auto-Show Side Panel Disabled:**
   * Moving components on the screen or clicking on them to arrange them will no longer slide open the Properties panel on the right. This prevents layout shifting and lets you design your layout smoothly.
   * To edit a component's name or custom settings, hover your mouse over it and click the **Pencil icon** that appears. Once the settings sidebar is open, clicking any other component on the canvas will switch to its settings.
2. **Width Indicators on Canvas:**
   * Every component box now displays its column span width on the canvas (e.g. `Width: 6` or `Width: 24`). This makes it easy to align components side-by-side.
3. **Smart Auto Align Button:**
   * We added an **Auto Align** button to the top toolbar of Step 6.
   * Clicking this button automatically organizes all your fields in rows of exactly 4 components (each spanning `6` columns, totalling the grid width of `24`), sequentially wrapping them and cleaning up the layout instantly.
4. **Layout Corruption / Stacking Fix:**
   * We fixed a bug that double-scaled coordinates and forced components to stretch to full width (`24`) and stack on top of each other. Correct layout widths are now preserved when loaded and saved.

---

## Verification
* **TypeScript Compilation:** Passed cleanly.
* **Vite Production Bundler:** Passes reports check and builds cleanly.
