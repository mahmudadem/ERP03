# Completion Report 170 - Apex Route and Sidebar Adapter

**Date:** 2026-06-05  
**Agent:** Codex  
**Task:** Task 167 Slice 3B - Apex route/sidebar adapter  
**Estimated time:** 2.0-3.0 hours  
**Actual time:** about 1.1 hours

## Technical Developer View

### What Changed

- **`frontend/src/pages/dev/apex-ledger/routeMap.ts`**  
  Added a focused route translation helper for the Apex candidate namespace:
  - `tenantPathToApexPath(path)` converts existing tenant/sidebar paths to `/dev/apex-ledger/...` candidate paths.
  - `apexPathToTenantPath(path)` provides the reverse mapping for future page mounting and cutover work.
  - Explicit aliases cover route names that are not one-to-one, including Accounting report slugs and AI Assistant paths.
  - Query strings and hash fragments are preserved.

- **`frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx`**  
  Changed the runtime sidebar source from static Apex child lists to an adapter over the real `useSidebarConfig()` output:
  - module visibility still follows tenant bundles
  - child links now follow item-level RBAC filtering
  - workflow-hidden Sales/Purchase operational links stay hidden
  - dynamic default/cloned document forms come through from the same grouping policy as the main shell
  - Apex visual markup, compact spacing, icon style, and RTL classes were preserved

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**  
  Added handling for `/dev/apex-ledger/accounting/tools/*` candidate paths so Accounting tool links adapted from the real sidebar do not fall into the generic placeholder.

- **Docs/planning**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.
  - Updated `planning/tasks/167-apex-shell-production-migration.md`.
  - Updated `planning/ACTIVE.md`, `planning/JOURNAL.md`, `planning/PRIORITIES.md`, and `planning/QA-QUEUE.md`.

### Architecture Decision

The main shell pages were not copied. Apex remains the shell/chrome candidate, while operational ERP workflows remain owned by the native production pages until explicit Apex-native replacements are contract-equivalent.

This avoids creating duplicate Sales/Purchases/Inventory pages with divergent posting, audit, attachment, approval, AR/AP, inventory, or permission behavior.

### Accounting / ERP Impact

No accounting, posting, ledger, approval, period-lock, tax, AR/AP, inventory costing, or database schema behavior changed.

The control improvement is navigation correctness: Apex now uses the same permission-filtered and workflow-filtered sidebar tree as the main shell, reducing the risk that users see links their role/company should not expose.

### Verification

- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed.

## End-User View

When testing the Apex shell, the sidebar should now match the company and user access rules more closely:

- Modules still appear only when the company has access.
- Links inside modules should also respect the user's permissions.
- Sales and Purchases workflow links should follow the same direct/full workflow policy as the normal shell.
- Default and cloned forms should appear according to the same grouping policy as the main sidebar.

The Apex look and feel should remain the same. This was a navigation-safety and cutover-readiness update, not a visual redesign.

## Acceptance Criteria Met

- Apex sidebar runtime data comes from the real `useSidebarConfig()` tree.
- Static Apex child lists are no longer the runtime permission source.
- Explicit route aliases exist for non-identical Apex candidate paths.
- Apex styling and RTL class structure were preserved.
- Frontend typecheck passed.
- Frontend production build passed.

## Known Follow-Ups

- **Slice 3C:** mount native production pages inside Apex for Sales, Purchases, Inventory, Settings/RBAC, and AI child routes that still render Apex workbench pages.
- **Slice 3D:** add the tenant-shell feature flag and perform role/bundle/empty-data/RTL QA before making Apex the default shell.
