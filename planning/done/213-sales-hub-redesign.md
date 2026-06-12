# Task 213 — Sales Hub Redesign

**Status:** ✅ Complete
**Date completed:** 2026-06-12
**Branch:** main
**Time spent:** ~3h
**Linked plan:** None
**Linked architecture doc:** [`docs/architecture/sales.md`](../../docs/architecture/sales.md)
**Linked user guide:** [`docs/user-guide/sales/sales-hub.md`](../../docs/user-guide/sales/sales-hub.md)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [x] Code merged
- [x] `docs/architecture/sales.md` updated or created — technical doc for future engineers
- [x] `docs/user-guide/sales/sales-hub.md` created — plain-language guide for end users
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [x] `planning/ACTIVE.md` updated with next task

---

## 1. Technical Developer View

### What Was Built

The Sales Module home/dashboard page (`/sales`) was rewritten from a simple overview into a high-density, visual, and highly performant module hub. We also implemented navigation state filters on list pages and interactive status badges.

### Files Changed

**Frontend**
- [`frontend/src/modules/sales/pages/SalesHomePage.tsx`](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesHomePage.tsx) — Rewrote header, quick links, KPI tiles, Document Pipeline with interactive status badges, settings table, and recent activity list.
- [`frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx`](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx) — Added `useLocation` state lookup to initialize and sync status filters from the Sales Hub.
- [`frontend/src/modules/sales/pages/SalesOrdersListPage.tsx`](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesOrdersListPage.tsx) — Added `useLocation` state lookup to initialize and sync status filters from the Sales Hub.
- [`frontend/src/modules/sales/pages/DeliveryNotesListPage.tsx`](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/DeliveryNotesListPage.tsx) — Added `useLocation` state lookup to initialize and sync status filters from the Sales Hub.
- [`frontend/src/modules/sales/pages/SalesReturnsListPage.tsx`](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesReturnsListPage.tsx) — Added `useLocation` state lookup to initialize and sync status filters from the Sales Hub.

**Docs**
- [`docs/architecture/sales.md`](file:///d:/DEV2026/ERP03/docs/architecture/sales.md)
- [`docs/user-guide/sales/sales-hub.md`](file:///d:/DEV2026/ERP03/docs/user-guide/sales/sales-hub.md)
- [`planning/ACTIVE.md`](file:///d:/DEV2026/ERP03/planning/ACTIVE.md)
- [`planning/JOURNAL.md`](file:///d:/DEV2026/ERP03/planning/JOURNAL.md)

### Architecture / Behavior

- **State Filter Seeding**: Status filters are pre-applied by passing the filter state in React Router `navigate('/sales/invoices', { state: { statusFilter: s.status } })`. The list pages initialize the `statusFilter` state from `location.state` and synchronize on route updates.
- **Header Alignment and Polish**: Applied logical icon grouping with the `Layers` icon, added an inline context badge, formatted the timestamp metadata with the `Clock` icon, and added a dividing border line.
- **Badge Buttons**: Status badges inside `PipelineRow` are styled as interactable `<button>` elements with logical hover/focus zoom styling to give proper cursor feedback.
- **In-Memory Caching**: Caches list queries and settings configuration using TTLs to keep navigation instant. Per-section `RefreshCw` buttons allow the user to selectively bust cache and fetch the latest records.

### Verification

- [x] `cd frontend && npx tsc --noEmit` clean (completed successfully with 0 errors)
- [x] Manual test of golden path and badge interactions

---

## 2. End-User View

### What's New

The main Sales landing page has been redesigned with a premium dashboard style, featuring high-fidelity tiles, clear document pipeline flows, and instant navigation shortcuts.

### How to Use It

1. Open the **Sales** tab in the sidebar.
2. View the new visual header featuring the **Last updated** date and time.
3. Hover over the status badges in the **Document Pipeline** (e.g. `Draft`, `Posted`).
4. Click any status badge (e.g., `Draft` under `Invoices`) to jump directly to the pre-filtered Invoices list page displaying only draft invoices.

### Where to Find It

- Menu: **Sales**
- URL: `/sales`
- Required permission: `sales.dashboard.view` (or standard sales module access)
