# Task 132 - UX Layout Production Hardening

Status: Ready for planning approval

Created: 2026-05-29

Source audit: `docs/architecture/frontend-ux-layout-audit.md`

Scope: Frontend shell, navigation, top bar, settings, auth/user flow, operational lists, action feedback, RTL/i18n readiness.

## Goal

Bring ERP03's frontend layout and user experience closer to a professional production ERP standard by removing demo/dev exposure, stabilizing the app shell, standardizing navigation/settings/list behavior, and enforcing safer user actions.

This task is intentionally split into phases. It must not be implemented as one large commit.

## Product Owner Standards Added Before Implementation

The product owner clarified three non-negotiable UX consistency rules:

1. Shared components are the default. If ERP03 has a shared date picker, account selector, party selector, item selector, warehouse selector, or equivalent master-data control, every module should use it by default.
2. Shared components are single sources of behavior. Updating a shared selector or date picker should update the project-wide behavior, including filtering, display, validation, fiscal/date handling, and permission-sensitive behavior.
3. Loading and action feedback must be consistent. Loading states, success toasts, failure toasts, policy blocks, validation errors, permission errors, and real critical/system errors must be visibly different and consistently worded.
4. Reports must follow one full report contract through `ReportContainer`: parameters, filters, loading/results display, refresh, export/print, density, empty/error states, and UI-mode routing.
5. Master-data entity cards must be UI-mode aware. Core entities such as Customers, Vendors, Items, Warehouses, and Accounts need consistent normal web/page presentation and Windows UI mode card/window presentation.
6. The top-bar widget system is frozen for the current implementation pass. Do not modify widget behavior, widget defaults, `widgetStore`, `DraggableWidgetSpace`, or top-bar widget files until the product owner explicitly reopens this scope.

Implementation priority:

- Treat shared component enforcement as P0 where the control captures dates, accounts, parties, items, warehouses, or other posting/reporting master-data references.
- Treat toast/error taxonomy as P0 for posting, approval, permission, tenant/security, and accounting-impacting actions.
- Treat loading-state consistency as P1 and include it in the shared operational-list and form standards.
- Treat the report contract as P0 for new reports and P1 for normalizing existing report parameters/filters/results.
- Treat entity card UI-mode awareness as P1 overall and P0 for customer-demo-critical master entities.

## Business Reason

ERP users judge system trust through the shell, navigation, lists, settings, and action feedback before they understand deeper accounting architecture. Current ERP03 UX still exposes development/demo patterns and inconsistent module behavior. That creates customer-demo risk, training risk, and financial-control UX risk.

## Accounting and Control Risk

The highest control-sensitive UX risks are:

- Users seeing unfinished dev/demo tools and mistaking them for real ERP features.
- Accidental posting/cancel/delete/status changes due to inconsistent confirmations.
- Stale operational data caused by duplicate query providers.
- Raw date inputs bypassing company date/fiscal calendar behavior.
- Settings scattered across modules with no predictable accounting/workflow/tax grouping.
- RTL/i18n gaps that reduce usability for Arabic users.
- Page-local selector/date implementations that bypass shared filtering or master-data validation.
- Generic critical-error messages that hide whether the issue is a business policy block, validation problem, permission problem, setup problem, or true system failure.

## Current Baseline Notes

- The working branch had pre-existing dirty files in initialization wizard areas when the audit was created. Do not overwrite those unrelated changes.
- A previous frontend typecheck failed due to those unrelated wizard changes. Resolve or isolate that baseline before using typecheck as acceptance evidence for this task.
- `npm --prefix frontend run check:reports` passed before this task was created and should continue to pass.
- No authenticated UI walkthrough was completed because safe test credentials were not provided.

## Phase 0 - Baseline and Safety Setup

Estimate: 0.5-1 day.

Purpose: Make the work safe before changing production UX.

Candidate files:

- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/PRIORITIES.md`
- Existing dirty wizard files only if the product owner explicitly asks to resolve them first.

Required actions:

1. Confirm branch and dirty worktree state.
2. Decide whether to continue on the current branch or create a clean UX branch from the latest base.
3. Resolve or isolate unrelated typecheck failures from wizard changes.
4. Add a task lock in `planning/PRIORITIES.md` if implementation starts.
5. Confirm customer-demo target scope with the product owner.

Acceptance criteria:

- The UX hardening work starts from a known git state.
- Unrelated wizard changes are not overwritten.
- Frontend typecheck baseline is either passing or explicitly documented as blocked by unrelated work.

Validation:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run check:reports
git status --short
```

## Phase 0.5 - Shared Component and Feedback Inventory

Estimate: 1-2 days.

Purpose: Establish the reusable UI/control baseline before refactoring high-traffic pages.

Candidate files:

- `frontend/src/components/shared/selectors/`
- `frontend/src/modules/accounting/components/shared/DatePicker.tsx`
- `frontend/src/components/ui/`
- `frontend/src/components/ui/DataTable/`
- `frontend/src/components/reports/ReportContainer.tsx` as reference only
- `frontend/src/components/shared/ModuleSettingsLayout.tsx`
- `frontend/src/i18n/`
- Pages found by raw search for local date/account/party/item/warehouse inputs

Required actions:

1. Inventory existing shared selectors and date picker components.
2. Inventory page-local account/date/party/item/warehouse inputs that should use shared components.
3. Inventory loading patterns: full-page load, table load, form submit, background refresh, inline lookup, and disabled-in-progress button states.
4. Inventory current report parameter/filter patterns against `ReportContainer`.
5. Inventory current entity card behavior for Customers, Vendors, Items, Warehouses, Accounts, and Parties in classic and Windows UI mode.
6. Define the shared toast/error taxonomy:
   - Success
   - Info/no-op
   - Validation error
   - Business policy block
   - Missing setup/configuration
   - Permission block
   - System/API/network error
   - Critical/security/accounting-integrity error
7. Decide whether enforcement should be documented only, scripted, or partially linted.

Acceptance criteria:

- A component inventory exists before broad UI refactoring starts.
- High-risk local controls are identified and prioritized.
- Loading and feedback categories are defined before page conversions.
- Exceptions to shared component use require a documented reason.
- Report filter/parameter inconsistencies are listed before report changes.
- Entity card UI-mode gaps are listed before customer/vendor/item/warehouse/account page work.

Validation:

```powershell
rg "type=\"date\"|type='date'" frontend/src
rg "accountId|partyId|itemId|warehouseId" frontend/src/modules frontend/src/pages
rg "window\.confirm|alert\(" frontend/src
rg "ReportContainer|uiMode" frontend/src/components frontend/src/modules
```

## Phase 1 - Production Shell Cleanup

Estimate: 1-2 days.

Purpose: Remove obvious non-production shell behavior and fix provider/routing risks.

Candidate files:

- `frontend/src/router/routes.config.ts`
- `frontend/src/hooks/useSidebarConfig.ts`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/providers/QueryProvider.tsx`
- `frontend/src/queryClient.ts`
- `frontend/src/pages/AdminLoginPage.tsx`
- `frontend/src/modules/onboarding/pages/LandingPage.tsx`
- `frontend/src/layout/SuperAdminShell.tsx`

Required actions:

1. Hide or development-gate all `/dev/*`, `/canvas-dev`, and internal tool routes from production sidebar navigation.
2. Remove the always-visible `Dev` sidebar section from normal app navigation.
3. Consolidate to exactly one React Query provider.
4. Make React Query Devtools development-only.
5. Fix hash-router unsafe auth links.
6. Replace raw logout confirm in Super Admin with the shared confirmation pattern, if available in that shell context.
7. Do not edit the frozen top-bar widget system in this phase.

Acceptance criteria:

- Normal tenant users do not see dev/demo entries in sidebar.
- There is exactly one QueryClient provider in the app tree.
- Auth links work correctly under hash routing.
- No top-bar widget behavior/defaults were changed.
- Report route check still passes.

Validation:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run check:reports
npm --prefix frontend run build
```

## Phase 2 - Sidebar Information Architecture and Shell Standards

Estimate: 2-4 days.

Purpose: Make the shell feel like a stable ERP console while leaving the current top-bar widget system untouched.

Candidate files:

- `frontend/src/layout/Sidebar.tsx`
- `frontend/src/components/navigation/SidebarItem.tsx`
- `frontend/src/components/navigation/SidebarSection.tsx`
- `frontend/src/theme/userAppearance.ts`
- `frontend/src/context/UserPreferencesContext.tsx`
- `frontend/src/components/settings/AppearanceSettings.tsx` or current appearance settings component location
- `docs/architecture/appearance-settings.md`
- `docs/user-guide/appearance-settings.md`

Required actions:

1. Normalize sidebar groups around module taxonomy: Overview, Operations, Masters, Reports, Settings.
2. Remove duplicate icon-map definitions and avoid remote GitHub URLs for core navigation icons if practical.
3. Add page header/breadcrumb conventions if not already present.
4. Document the current top-bar widget system as out of scope for this pass.
5. Do not modify `TopBar.tsx`, `DraggableWidgetSpace.tsx`, `widgetStore.ts`, or top-bar widget files unless the product owner explicitly approves reopening that scope.

Acceptance criteria:

- Sidebar contains only production navigation for the current user's context.
- Appearance settings remain discoverable for users allowed to personalize UI.
- Navigation labels and icons are consistent and maintainable.
- Top-bar widget behavior remains unchanged.

Validation:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Manual visual QA:

- Tenant dashboard.
- Accounting module.
- Sales module.
- Purchases module.
- Inventory module.
- Super Admin shell.
- Mobile width and desktop width.

## Phase 3 - Settings Taxonomy Standardization

Estimate: 2-4 days.

Purpose: Make settings predictable across modules.

Candidate files:

- `frontend/src/components/shared/ModuleSettingsLayout.tsx`
- `frontend/src/modules/settings/pages/SettingsHomePage.tsx`
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`
- Existing accounting/inventory/company settings pages found during implementation
- `frontend/src/i18n/`
- `docs/architecture/settings.md` or new doc
- `docs/user-guide/settings/`

Standard settings groups:

- General
- Workflow
- Accounting
- Tax
- Printing and Documents
- Notifications
- Advanced

Required actions:

1. Turn Settings Home into a real settings hub.
2. Update ModuleSettingsLayout to support consistent desktop and mobile behavior.
3. Normalize Sales and Purchases settings tab naming and order where the concepts overlap.
4. Add i18n keys for visible labels changed or added.
5. Add help text where settings affect posting, workflow, tax, or document behavior.

Acceptance criteria:

- Users can predict where accounting/workflow/tax/notification settings live across modules.
- Settings layout works on mobile and desktop.
- No new user-facing strings are hardcoded.

Validation:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Phase 4 - Operational List and Table Standardization

Estimate: 4-8 days. Split into smaller commits by module.

Purpose: Give operational lists the same consistency that reports already get through `ReportContainer`.

Candidate files:

- `frontend/src/components/ui/DataTable/`
- `frontend/src/components/reports/ReportContainer.tsx` as reference only
- `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
- `frontend/src/modules/accounting/pages/VouchersListPage.tsx`
- Additional high-traffic list pages selected after inventory

Required actions:

1. Decide whether to extend current DataTable or create a thin ERPListPage wrapper around it.
2. Standardize search, filters, status chips, row actions, empty state, loading state, pagination, density, and permission-aware primary actions.
3. Start with four high-traffic pages: vouchers, sales invoices, purchase invoices, items.
4. Do not rewrite every table in one pass.
5. Keep reports on `ReportContainer`; do not merge report and operational-list patterns.
6. Use shared loading states for table fetching, background refresh, empty results, and disabled-in-progress actions.
7. Use shared selectors and DatePicker inside list filters when the filter references master data or dates.

Acceptance criteria:

- Selected high-traffic list pages share one visible interaction pattern.
- Users do not need to relearn table behavior per module.
- Actions provide visible toast feedback and safe confirmations where relevant.
- Loading and empty states look and behave consistently across selected high-traffic lists.

Validation:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run check:reports
```

## Phase 4.5 - Report Contract and Entity Card Standardization

Estimate: 3-6 days. Split report work and entity-card work into separate commits.

Purpose: Convert the product-owner consistency rule into enforceable frontend patterns for reports and master-data cards.

Candidate files:

- `docs/architecture/reports.md`
- `frontend/src/components/reports/ReportContainer.tsx`
- All report pages under `frontend/src/modules/**/pages/*Report*.tsx`
- `frontend/src/modules/sales/pages/CustomersListPage.tsx`
- `frontend/src/modules/purchases/pages/VendorsListPage.tsx`
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx`
- `frontend/src/modules/inventory/pages/WarehousesPage.tsx`
- `frontend/src/modules/accounting/pages/AccountsPage.tsx` or current account master page
- `frontend/src/modules/shared/components/PartyMasterCard.tsx`
- Shared entity/card component location if introduced

Required actions:

1. Document the full report contract: typed params, shared filters, run/refresh, loading, empty, error, export/print, density, and Windows UI-mode behavior.
2. Confirm existing reports use `ReportContainer`; then audit whether their filters use shared controls consistently.
3. Standardize report parameter names where possible: date range, party, account, warehouse, currency, cost center, status, mode.
4. Define an entity-card contract for master data: same behavior, two presentations.
5. Audit current UI-mode behavior for Customers, Vendors, Items, Warehouses, Accounts, and Parties.
6. Reuse or formalize `PartyMasterCard` for customer/vendor card behavior.
7. Do not duplicate business logic between classic page mode and Windows card mode.

Acceptance criteria:

- New report pages have a clear contract beyond "uses ReportContainer".
- Existing report filter inconsistencies are documented and prioritized.
- Entity cards have a documented UI-mode-aware standard.
- Core master-data entity pages identify whether they are complete, partial, or missing Windows mode support.

Validation:

```powershell
npm --prefix frontend run check:reports
rg "ReportContainer" frontend/src/modules
rg "uiMode === 'windows'|uiMode" frontend/src/modules/sales frontend/src/modules/purchases frontend/src/modules/inventory frontend/src/modules/accounting
npm --prefix frontend run typecheck
```

## Phase 5 - Action Safety, Date Fields, and Feedback Enforcement

Estimate: 2-5 days.

Purpose: Bring UI behavior in line with AGENTS.md safety rules.

Candidate files:

- Pages found by `rg "window\.confirm|alert\(" frontend/src`
- Pages found by `rg "type=\"date\"|type='date'" frontend/src`
- Pages found by local account/party/item/warehouse ID inputs instead of shared selectors
- `frontend/src/components/ui/ConfirmDialog.tsx`
- `frontend/src/modules/accounting/components/shared/DatePicker.tsx`
- `frontend/src/components/shared/selectors/`
- Shared action utilities if introduced

Required actions:

1. Replace raw `window.confirm` on user-facing actions with `ConfirmDialog`.
2. Replace raw `alert()` behavior with toast, disabled state, or proper dialogs.
3. Replace user-facing raw date inputs with shared DatePicker, except internal low-level DataTable filter implementation if intentionally allowed.
4. Add or enforce lint/check script for raw confirm/alert usage if practical.
5. Ensure posting, voiding, cancelling, approving, deleting, pausing, resuming, and status-changing actions show result toasts.
6. Replace page-local account/party/item/warehouse capture with shared selectors where a shared selector already exists.
7. Apply the shared error severity taxonomy so policy blocks are not reported as generic critical failures.
8. Track recurring policy/validation/system categories so support can distinguish business-rule friction from defects.

Acceptance criteria:

- No user-facing financial/document lifecycle action runs from an unconfirmed raw click.
- Every server-triggering user action has success/info/error feedback.
- Date entry respects the shared date-picker standard.
- Master-data references use shared selectors unless an exception is documented.
- Critical errors are reserved for real system/security/accounting-integrity failures, not normal policy blocks.

Validation:

```powershell
rg "window\.confirm|alert\(" frontend/src
rg "type=\"date\"|type='date'" frontend/src
rg "accountId|partyId|itemId|warehouseId" frontend/src/modules frontend/src/pages
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Phase 6 - Auth, User Flow, RTL, and i18n Hardening

Estimate: 4-8 days.

Purpose: Make login, logout, language, direction, and session context feel production-ready.

Candidate files:

- `frontend/src/i18n/config.ts`
- `frontend/src/context/UserPreferencesContext.tsx`
- `frontend/src/modules/onboarding/pages/LandingPage.tsx`
- `frontend/src/pages/AdminLoginPage.tsx`
- `frontend/src/modules/company-selector/CompanySelectorPage.tsx`
- `frontend/src/layout/SuperAdminShell.tsx`
- `frontend/src/i18n/`

Required actions:

1. Initialize i18n from persisted language before first render.
2. Add public language selector to auth/login flow.
3. Confirm or add forgot/reset password entry point.
4. Standardize logout across tenant and super-admin shells.
5. Standardize company-switch post-action routing.
6. Audit left/right-specific layout classes in shell and selected high-traffic pages.
7. Add Arabic visual QA checklist.
8. Do not edit `TopBar.tsx` or top-bar widget files in this phase unless the product owner explicitly reopens that scope.

Acceptance criteria:

- Arabic users can switch language before login.
- Direction is correct on first paint after language selection.
- Logout and company switch behave predictably.
- High-traffic shell/pages remain readable in RTL.

Validation:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Manual visual QA:

- Login in English.
- Login in Arabic/RTL.
- Tenant dashboard in Arabic/RTL.
- Sidebar open/collapsed in Arabic/RTL.
- Top bar user menu in Arabic/RTL.
- Sales invoice list in Arabic/RTL.
- Purchase invoice list in Arabic/RTL.
- Accounting voucher list in Arabic/RTL.

## Phase 7 - Customer Demo Readiness Review

Estimate: 1-2 days.

Purpose: Verify that the product no longer presents as a dev/demo UI.

Required actions:

1. Run build/typecheck/report validation.
2. Capture screenshots for desktop and mobile widths.
3. Walk core user flow: login, select company, dashboard, navigate to Accounting/Sales/Purchases/Inventory, open settings, open reports, logout.
4. Confirm no dev/demo routes appear in production navigation.
5. Confirm no obvious mock dashboard values appear as real metrics.
6. Confirm Arabic/RTL shell readability.

Acceptance criteria:

- Product owner can demo the shell and high-traffic flows without explaining away dev/demo UI artifacts.
- Remaining issues are documented as known follow-ups, not accidental discoveries.

## Recommended Builder Split

Use separate commits or sub-branches:

1. Shell cleanup and provider fix.
2. Topbar/sidebar IA.
3. Settings taxonomy.
4. List/table pattern pilot.
5. Action safety/date-picker pass.
6. Auth/RTL pass.
7. Docs and QA hardening.

Do not allow two builders to edit the same file area at the same time.

## Documentation Required

Update or create:

- `docs/architecture/frontend-ux-layout-audit.md`
- `docs/architecture/frontend-shell.md` or equivalent if implementation changes shell behavior.
- `docs/architecture/settings.md` if settings taxonomy changes.
- `docs/user-guide/settings/` for user-facing settings changes.
- `docs/user-guide/navigation.md` or equivalent for shell/sidebar/topbar behavior.
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`
- `planning/done/132-ux-layout-production-hardening.md` when complete.

## Out of Scope

- Backend accounting posting changes.
- Voucher semantics.
- Tax logic.
- Inventory valuation logic.
- New ERP modules.
- Full design-system rewrite before shell risks are fixed.

## Stop Conditions

Stop and ask the product owner if implementation requires:

- Removing a business feature from navigation permanently.
- Changing accounting settings behavior.
- Changing approval/posting lifecycle behavior.
- Changing tenant/company isolation behavior.
- Adding a new shared selector or changing master-data selection semantics.
