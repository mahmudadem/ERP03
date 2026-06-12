# Completion Report 167 - Apex Shell Production Candidate Slice 1

**Date:** 2026-06-04  
**Agent:** Codex  
**Task:** Apex shell production candidate migration, slice 1  
**Estimated time:** 1.5-2.0 hours  
**Actual time:** about 1.8 hours

## Technical Developer View

### What Changed

- `frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx`
  - Replaced the hardcoded Apex module list with an adapter over `useSidebarConfig()`.
  - Sidebar now inherits real RBAC/module-bundle/dynamic-form filtering.
  - Footer now uses authenticated user and active company context.

- `frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`
  - Removed dummy-data fallback for accounts, parties, inventory, sales orders, sales invoices, and purchase bills.
  - Header now reads active company, fiscal year, base currency, UI mode, and current user.
  - Fixed the tab-navigation bridge used by dashboard quick actions.

- `frontend/src/pages/dev/apex-ledger/components/DashboardHome.tsx`
  - Removed dummy audit-log dependency.
  - Replaced fake database revision, fixed trend numbers, and mock audit rows with live loaded-data summaries or empty states.

- `frontend/src/pages/dev/apex-ledger/components/SalesPage2.tsx`
  - Replaced raw browser delete confirmation with shared `ConfirmDialog`.
  - Added visible toast feedback for delete and new-document reset.

- `frontend/src/pages/dev/apex-ledger/components/SalesSection.tsx`
  - Replaced raw browser delete confirmation with shared `ConfirmDialog`.
  - Replaced hardcoded company/user labels with active context values.

- `frontend/src/pages/dev/apex-ledger/components/AIAssistantSection.tsx`
  - AI context summary now uses active company fiscal year/base currency.
  - Removed hardcoded tenant company text.

- `frontend/src/hooks/useSidebarConfig.ts`
  - Dev/demo sidebar section is now gated to Vite development mode or `localStorage.erp_show_dev_navigation=true`.
  - Dev paths are filtered from production sidebar items.

- `frontend/src/router/routes.config.ts`
  - Dev preview routes, including Apex, are now hidden from normal static menu config.
  - Removed the direct Apex developer-panel route from the candidate route set.

- `frontend/src/pages/dev/apex-ledger/utils/dummyData.ts`
  - Deleted after removing all imports.

### Verification

- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed.
  - `check:reports` passed.
  - `check:no-confirm` passed.
  - Vite build passed with existing bundle-size/Browserslist warnings.

### Not Verified

- Authenticated visual QA was not completed in this session because the in-app Browser tool was not exposed and Playwright is not installed in the workspace.
- Dev server was started at `http://127.0.0.1:5173/` for smoke-check preparation, but protected-route visual access still needs an authenticated browser session.

## End-User View

The Apex shell is now safer to test as the future ERP workspace. It uses the same company permissions and module access rules as the current system, shows the active company/user instead of placeholder names, and no longer fills empty pages with fake sample data.

When users test the Apex Sales candidate, deleting an invoice now asks for confirmation in the ERP dialog style instead of using a browser popup.

## Acceptance Criteria Met

- Apex navigation uses the real sidebar contract.
- Dev/demo routes are hidden from normal production navigation.
- Fake tenant data fallback was removed.
- Hardcoded tenant/user labels were removed from the main Apex shell surfaces touched in this slice.
- Raw browser confirmation was removed from Apex Sales candidate files.
- Frontend validation passed.

## Known Follow-Ups

- Expand Apex route coverage or add an Apex wildcard route for sub-module paths.
- Decide how global settings/profile pages should render inside the Apex shell.
- Run authenticated visual QA in English and Arabic RTL on desktop and mobile.
- Put Apex behind a tenant-shell feature flag before replacing the main shell route.
