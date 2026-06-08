# Completion Report 174 - Apex Company Settings Sidebar Parity

**Date:** 2026-06-05  
**Agent:** Codex  
**Task:** Task 167 visual/navigation hotfix - Company Settings footer parity inside Apex  
**Estimated time:** 0.5-1.0 hours  
**Actual time:** about 0.7 hours

## Technical Developer View

### What Changed

- **`frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx`**  
  Replaced the Apex-specific bottom user/profile footer with a Company Settings footer modeled after the main sidebar. The footer includes Overview, Users, Roles, Modules, Features, Bundles, Currencies, Tax Codes, Notifications, Communications, and General Settings.

- **`frontend/src/pages/dev/apex-ledger/components/NativeCompanySettingsRouteMount.tsx`**  
  Added a focused native route mount for Company Settings footer pages. It reuses `routesConfig` so Apex renders the existing native Company Admin/settings pages and their existing route guards instead of copying pages.

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**  
  Added route detection for Apex company-admin, currency, tax-code, notification, and communication settings paths and routes them through `NativeCompanySettingsRouteMount`.

- **Docs/planning**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.
  - Updated `planning/tasks/167-apex-shell-production-migration.md`.
  - Updated `planning/QA-QUEUE.md`, `planning/ACTIVE.md`, and `planning/JOURNAL.md`.

### Why Company Settings Was Missing

The main shell does not get Company Settings from `useSidebarConfig()`. It appends the Company Settings block directly in `frontend/src/layout/Sidebar.tsx` as a footer.

Apex only adapted `useSidebarConfig()`, so it inherited normal module sections but missed the footer block. This was a shell adapter gap, not an RBAC or permission issue.

### Accounting / ERP Impact

No accounting, posting, ledger, approval, tax, inventory, AR/AP, reporting, or database schema behavior changed.

Settings permissions remain enforced by the existing native route guards. Apex only changes the shell location and route namespace used to display those pages during candidate QA.

### Verification

- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed.

## End-User View

In Apex, the bottom of the sidebar now shows **Company Settings**, just like the main shell. The old Apex-specific user/profile card has been removed.

Opening Company Settings should show the same administration links users expect:

- Overview
- Users
- Roles
- Modules
- Features
- Bundles
- Currencies
- Tax Codes
- Notifications
- Communications
- General Settings

Each page should stay inside the Apex shell instead of switching back to the old shell.

## Acceptance Criteria Met

- Company Settings is visible at the bottom of the Apex sidebar.
- The old Apex user/profile footer is removed.
- Company Settings child links use Apex candidate paths under `/dev/apex-ledger`.
- Native Company Settings pages mount inside Apex using existing route components and guards.
- Frontend typecheck passed.
- Frontend production build passed.

## Known Follow-Ups

- Manual authenticated QA is still needed in English and Arabic RTL.
- Broader Settings/RBAC/AI native page mounting remains part of Task 167 Slice 3C-Remaining.
