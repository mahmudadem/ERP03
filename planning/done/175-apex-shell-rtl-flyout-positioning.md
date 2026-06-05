# Completion Report 175 - RTL Flyout positioning and Background Cohesion for Apex Shell

**Date:** 2026-06-05  
**Agent:** Antigravity  
**Task:** Apex shell candidate - RTL submenus flyout positioning, themed background styling, and Contrast sidebar preset visual hardening  
**Estimated time:** 0.5 hours  
**Actual time:** 0.4 hours  

## Technical Developer View

### What Changed

- **`frontend/src/components/navigation/SidebarItem.tsx`**
  - **Coordinates Fix** (lines 77, 85-88, 281-286):
    - Updated the local coordinates state (`coords`) to store both `left` and `right` bounding values from `getBoundingClientRect()` instead of only `left: rect.right`.
    - Refactored `updateCoords` to store `rect.left` and `rect.right` independently as `coords.left` and `coords.right`.
    - Updated the fixed Portal element coordinate styling rules:
      - In LTR rendering, positions the submenu's left edge using the parent row's right boundary: `left: coords.right + gap`.
      - In RTL rendering, positions the submenu's right edge using the parent row's left boundary: `right: (window.innerWidth - coords.left) + gap`.
  - **Themed Background & Contrast Sidebar Fixes**:
    - Replaced the hardcoded white/slate background `bg-white dark:bg-slate-900` with the themed CSS variable `bg-[var(--app-sidebar-surface)]`.
    - Added `isContrastSidebar` state to detect contrast (brand colored) sidebar layouts.
    - Updated row active indicators, item hover backgrounds, and icon container pills to use semi-transparent white overlays (like `bg-white/10` and `bg-white/20`) when rendered inside contrast sidebars. This fixes invisible text (white-on-white) and hidden active item backgrounds in brand colored sidebars.

- **`frontend/src/components/navigation/SidebarSection.tsx`**
  - Added `isContrastSidebar` detection.
  - Refactored section title header hover style: switches from light-blue `hover:bg-[var(--color-bg-tertiary)]/50` to a subtle semi-transparent `hover:bg-white/10` when the sidebar surface is brand colored.
  - Updated section category icon containers (`ResolvedIcon` wrapper) to use matching semi-transparent white highlights (like `bg-white/10` and `bg-white/20`) when active or section-active in contrast mode, replacing the light-colored `bg-[var(--color-bg-tertiary)]` pills.

### Verification

- **`npx tsc --noEmit`** -> Passed successfully (0 errors).
- **`npm run build`** -> Passed successfully (0 errors).
  - All report containers, no-confirm controls, and SoD boundary enforcement scripts passed.

## End-User View

When navigating the application using Arabic (RTL) mode with the **Flyout (Hover menus)** sidebar layout:
- Hovering over a sidebar item with children correctly spawns the flyout submenu to the **left** of the sidebar.
- The submenu is aligned directly next to the sidebar's edge, preventing it from overlapping the icons and text labels of the main sidebar.
- In LTR mode, the submenu continues to fly out cleanly to the **right** of the sidebar as expected.
- The background color of the flyout submenus matches the main sidebar background perfectly across all themes and dark/light modes, preventing any visual discrepancy and ensuring text is fully readable in contrast mode.

When using the **Contrast (Brand colored)** sidebar surface settings (like in **Ocean Breeze** preset):
- Sidebar items, hovers, and section category pills no longer bleed light-colored/white page background colors into the sidebar.
- Inactive icon pills use a subtle transparent white highlight (`bg-white/10`), making white icons perfectly visible.
- Active items use a translucent white backdrop (`bg-white/20`) instead of matching the primary brand color, making active row highlights cleanly visible.
- Section header hover states are smooth and consistent (`bg-white/10`).

## Acceptance Criteria Met

- [x] Submenus position themselves cleanly to the left of the sidebar in RTL.
- [x] No overlapping of sidebar content in RTL flyout mode.
- [x] LTR submenu positioning remains intact.
- [x] Spawned submenus match the main sidebar background style exactly in all themes.
- [x] Sidebar items, hovers, and category pills render cleanly in Contrast modes without visual overlap.
- [x] Types compile and Vite bundle builds with zero errors.

## Reference Links
- [Apex Shell Candidate Architecture Document](file:///d:/DEV2026/ERP03/docs/architecture/apex-shell-candidate.md)
