# Brief: Frontend UX Layout Production Hardening

**For:** Frontend builder or future UX-hardening agent

**From:** Codex

**Date:** 2026-05-29

## Context

A deep frontend UX/layout audit was completed for ERP03. The product has solid foundations, especially the report pattern, but the current app shell still exposes dev/demo routes, duplicated query providers, inconsistent settings, and uneven table/action patterns. The top-bar widget system was noted during the audit but is frozen for the current implementation pass by product-owner instruction.

Primary audit file: `docs/architecture/frontend-ux-layout-audit.md`

Execution task file: `planning/tasks/132-ux-layout-production-hardening.md`

## Task

Implement the hardening in small phases. Do not start with visual polish. Start with production trust issues:

1. Hide dev/demo routes and remove the always-visible Dev sidebar section.
2. Consolidate React Query to one provider.
3. Fix hash-router unsafe auth links.
4. Standardize logout confirmation behavior.
5. Do not modify the current top-bar widget system.
6. Prepare the sidebar/settings/list phases as separate commits.
7. Inventory shared DatePicker/selectors/loading/toast patterns before broad page refactors.
8. Enforce shared components by default for account, party, item, warehouse, and date capture.
9. Define toast/error severity categories so validation, policy, permission, setup, system, and critical/security errors are not shown as the same generic failure.
10. Treat `ReportContainer` as the full report contract: typed parameters, shared filters, results/empty/loading/error states, export/print, density, and Windows UI-mode routing.
11. Define UI-mode-aware entity-card behavior for Customers, Vendors, Items, Warehouses, Accounts, and Parties before refactoring master-data pages.

## Files To Inspect First

- `frontend/src/router/routes.config.ts`
- `frontend/src/hooks/useSidebarConfig.ts`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/providers/QueryProvider.tsx`
- `frontend/src/queryClient.ts`
- `frontend/src/layout/Sidebar.tsx`
- `frontend/src/pages/AdminLoginPage.tsx`
- `frontend/src/modules/onboarding/pages/LandingPage.tsx`
- `frontend/src/layout/SuperAdminShell.tsx`
- `frontend/src/components/shared/selectors/`
- `frontend/src/modules/accounting/components/shared/DatePicker.tsx`
- `frontend/src/components/ui/ConfirmDialog.tsx`
- `frontend/src/components/ui/DataTable/`
- `frontend/src/components/reports/ReportContainer.tsx`
- `frontend/src/modules/shared/components/PartyMasterCard.tsx`
- `frontend/src/modules/sales/pages/CustomersListPage.tsx`
- `frontend/src/modules/purchases/pages/VendorsListPage.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
- `frontend/src/modules/inventory/pages/WarehousesPage.tsx`

## Constraints

- Do not overwrite unrelated dirty wizard changes unless explicitly assigned.
- Do not change accounting posting behavior as part of UX hardening.
- Do not remove business features without product-owner confirmation.
- Keep reports on `ReportContainer`; do not merge report and operational-list patterns.
- Add i18n keys for new user-facing strings.
- Use shared `ConfirmDialog` and toast patterns for user-triggered actions.
- Shared components are the default. Do not create page-local date/account/party/item/warehouse controls when a shared component already exists.
- Critical error wording must be reserved for true system, security, tenant-isolation, posting-integrity, or data-loss failures.
- Business policy blocks, validation errors, missing setup, and permission denials need different wording and severity.
- Reports must not invent page-local report behavior outside the shared `ReportContainer` contract.
- Entity cards must not duplicate business behavior between classic/web and Windows UI modes; only presentation/container should differ.
- Top-bar widget files are frozen for now. Do not edit `TopBar.tsx`, `widgetStore.ts`, `DraggableWidgetSpace.tsx`, or `frontend/src/components/topbar/widgets/` unless the product owner explicitly reopens this scope.

## Definition Of Done For First Implementation Slice

- Normal sidebar no longer exposes dev/demo routes.
- App uses one React Query provider.
- React Query Devtools are development-only.
- Auth links work correctly with hash routing.
- Top-bar widget behavior remains unchanged.
- Shared component inventory exists and high-risk local controls are listed.
- Loading and toast/error severity rules are documented before page conversions.
- Report contract gaps are listed, including parameter/filter consistency.
- Entity-card UI-mode gaps are listed for Customers, Vendors, Items, Warehouses, Accounts, and Parties.
- Validation passes or unrelated failures are explicitly documented.

## Suggested Validation

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run check:reports
npm --prefix frontend run build
git status --short
```
