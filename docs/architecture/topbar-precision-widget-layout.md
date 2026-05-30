# Topbar Precision Widget Layout

## Purpose

To provide a highly interactive, customizable, and professional top header layout. Active dashboard widgets are rendered inline inside the `TopBar` itself (which maintains a fixed height of `h-12`). 

## Files

- `frontend/src/layout/TopBar.tsx` — renders the top navigation bar, handles layout selection, and manages the inline widget styling patterns.
- `frontend/src/components/topbar/DraggableWidgetSpace.tsx` — renders the full 96-column grid workspace when in "Layout Edit" mode, allowing drag-and-drop repositioning and resizing.
- `frontend/src/store/widgetStore.ts` — owns default widget configurations, visibility status, coordinates, custom styles, and preferences.
- `frontend/src/components/topbar/widgets/` — directory containing individual modular widgets:
  - `CompanyLogoNameWidget.tsx` (Logo/Name)
  - `FiscalYearWidget.tsx` (Active Fiscal Year)
  - `BaseCurrencyWidget.tsx` (Base Currency)
  - `ApprovalModeWidget.tsx` (Approval Settings)
  - `UIModeWidget.tsx` (Current UI Mode - Win/Web)
  - `ClockWidget.tsx` (Local Time)
  - `DateWidget.tsx` (Date)
  - `NotesWidget.tsx` (Quick Notes)
  - `AlarmWidget.tsx` (Alarms)
  - `SearchWidget.tsx` (Dynamic Global Search)

## Layout & Styling Model

- In **Normal Mode**, widgets are displayed inline using one of the selected preset visual styles:
  - **Style 1:** Double-Decker Micro Cards (Double vertical stacked layout)
  - **Style 2:** Tech Terminal Brackets (Monospace brackets `[icon value]`)
  - **Style 3:** Pipeline Separators (Horizontal separators `|`)
  - **Style 5:** Unified Bubble Pill (Harmonious rounded pills)
  - **Style 10:** Slanted Angles (Technological angled tabs)
  - **Style 11:** Tech Dotted Matrix (Dashed borders)
  - **Style 16:** Perforated Coupon Tag (Card ticket theme)
  - **Style 17:** Dashed Blueprint (Sky blue blueprints)
  - **Style 18:** Glowing Dot Indicator (Color pulse states)
- In **Layout Edit Mode** (activated by clicking "Edit & Layout" in the widgets menu), the TopBar switches to the custom 96-column `DraggableWidgetSpace` grid. Here, users can drag, reposition, and resize widgets to adjust their layout configuration.
- Individual widgets accept a `compact` prop which strips away labels and icons, maximizing readability in narrow containers.

## Verification

- `npm run typecheck` from `frontend/`
- `npm run build` from `frontend/`
