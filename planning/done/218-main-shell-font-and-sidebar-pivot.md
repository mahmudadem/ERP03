# 218 — Main Shell Font and Accordion Sidebar Visual Pivot

**Date:** 2026-06-13
**Status:** Complete
**Time spent:** ~0.6h

## Technical Developer View

Owner decision: stop Apex tenant-shell cutover work. The main shell remains the production shell. Only the Apex accordion-sidebar visual treatment should be reused, and only as presentation styling in the main shell accordion mode.

Changed files:

- `frontend/src/styles/globals.css`
- `frontend/src/theme/userAppearance.ts`
- `frontend/src/layout/Sidebar.tsx`
- `frontend/src/components/navigation/SidebarSection.tsx`
- `frontend/src/components/navigation/SidebarItem.tsx`
- `docs/architecture/main-shell-chrome.md`
- `docs/user-guide/navigation/main-shell-sidebar.md`
- `planning/ACTIVE.md`
- `planning/PRIORITIES.md`
- `planning/JOURNAL.md`

What changed:

- Added a main-shell `--font-mono` token using JetBrains Mono.
- Applied JetBrains Mono to main-shell `.font-mono`, `code`, `kbd`, `samp`, `pre`, `.tabular-nums`, and number input surfaces.
- Updated the user appearance mono preset so it resolves to JetBrains Mono.
- Added a `main-sidebar-accordion` marker class in the production `Sidebar`.
- Updated `SidebarSection` and `SidebarItem` so Apex-inspired row styling applies only when `sidebarMode !== 'submenus'`.
- Preserved existing `useSidebarConfig()` data flow, route behavior, permissions, workflow hiding, tenant/module filtering, and flyout mode.
- Updated planning to remove Apex feature-flag/cutover work from current priorities.

## End-User View

The production sidebar keeps working the same way, but accordion mode now looks cleaner and closer to the Apex sidebar style. Numbers, codes, and technical values in the main shell now use JetBrains Mono where the UI marks them as numeric or code-like.

## Accounting / ERP Impact

UI chrome only. No posting logic, vouchers, ledger balances, taxes, inventory valuation, AR/AP, approvals, period locks, reports, RBAC, tenant isolation, or data model behavior changed.

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed, including `check:reports`, `check:no-confirm`, and `check:sod-approve`.

Existing build warnings remain: stale Browserslist/baseline-browser-mapping data, Firebase auth mixed static/dynamic import, SalesInvoiceDetailPage static/dynamic import, and large chunk warning.

## Known Follow-Ups

- Manual visual QA in main-shell accordion mode, including Arabic RTL and compact layout.
- Manual check that flyout/submenus mode remains unchanged.
