# Completion Report 171 - Apex Sales Native Page Mounting

**Date:** 2026-06-05  
**Agent:** Codex  
**Task:** Task 167 Slice 3C-Sales - native Sales page mounting inside Apex  
**Estimated time:** 2.0-3.0 hours  
**Actual time:** about 1.3 hours

## Technical Developer View

### What Changed

- **`frontend/src/pages/dev/apex-ledger/components/NativeSalesRouteMount.tsx`**  
  Added a focused Apex route mount for native Sales subroutes. It reuses `routesConfig` entries whose paths start with `/sales/`, converts them to descendant Apex route paths, and renders the original native route component under the Apex shell.

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**  
  Changed the Sales section render path so `/dev/apex-ledger/sales` still shows the Apex Sales overview, while concrete Sales subroutes render through `NativeSalesRouteMount`.

- **Docs/planning**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.
  - Updated `planning/tasks/167-apex-shell-production-migration.md`.
  - Updated `planning/QA-QUEUE.md`, `planning/PRIORITIES.md`, `planning/ACTIVE.md`, and `planning/JOURNAL.md`.

### Architecture Decision

Sales pages were not copied. The Apex shell now mounts the existing native production Sales pages for concrete subroutes. This keeps the existing Sales page contracts as the source of truth for document creation, editing, posting, attachments, messaging, audit, workflow behavior, reports, and settings.

The route mount reuses the normal guard stack:

- `ModuleConfigurationGuard`
- `WorkflowModeGuard`
- `ProtectedRoute`

Native Sales pages contain many internal `navigate('/sales/...')` calls. Instead of editing every Sales page in this slice, `NativeSalesRouteMount` installs an Apex-only hash route bridge while it is mounted. When a native Sales page navigates to `/sales/...` during Apex candidate QA, the bridge converts it back to `/dev/apex-ledger/sales/...`.

### Accounting / ERP Impact

No accounting, posting, ledger, approval, period-lock, tax, AR/AP, inventory costing, or database schema behavior changed.

The control improvement is that Apex no longer uses the simplified Apex Sales workbench for concrete operational Sales routes. Native Sales pages remain responsible for financially sensitive behavior such as invoice posting, credit/period-lock controls, sales returns, customer statement drilldowns, recurring invoices, and Sales settings.

### Verification

- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed.

## End-User View

When testing Apex, Sales links should now open the real Sales pages inside the Apex layout. The Apex sidebar and topbar stay visible, but the content area uses the production Sales screens users already rely on.

Examples:

- Sales Invoices opens the real invoice list.
- New Sales Invoice opens the real invoice detail page.
- Sales Orders, Delivery Notes, Sales Returns, Quotes, Recurring Invoices, Customer Statement, Sales Analytics, and Sales Settings open inside Apex.
- Clicking rows, back buttons, new buttons, and linked document actions should stay under the Apex route.

## Acceptance Criteria Met

- `/dev/apex-ledger/sales/invoices` renders the native Sales invoices list inside Apex.
- `/dev/apex-ledger/sales/invoices/new` renders the native Sales invoice detail page inside Apex.
- `/dev/apex-ledger/sales/orders/:id`, `/delivery-notes/:id`, `/returns/:id`, and `/quotes/:id` route to native detail pages inside Apex.
- Sales reports and settings route to native pages inside Apex.
- Sales route guards reuse the existing module, workflow, RBAC, and module-bundle checks.
- Apex visual shell/sidebar/topbar styling was preserved.
- Frontend typecheck passed.
- Frontend production build passed.

## Known Follow-Ups

- Run authenticated manual QA for Sales in English and Arabic RTL.
- Test direct-invoicing and operational workflow mode behavior inside Apex.
- Test restricted roles inside Apex.
- Continue Slice 3C for Purchases, Inventory, Settings/RBAC, and AI native page mounting.
