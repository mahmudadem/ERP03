# Frontend UX and Layout Production Audit

Date: 2026-05-29

Scope: ERP03 frontend shell, sidebar, top bar, login/logout flow, module settings, list/table patterns, reports pattern, RTL/i18n readiness, and production ERP usability consistency.

Branch observed: `feat/init-wizard-forms-selection`

Audit type: Deep read-only UX/UI and frontend architecture review. No application code was changed as part of this audit.

## Executive Verdict

ERP03 has a real ERP foundation, but the current frontend experience does not yet feel like a finished professional ERP product. The strongest part is the report infrastructure: the project has a documented `ReportContainer` pattern and report route enforcement. The weakest parts are the application shell, top bar/sidebar relationship, settings consistency, table/list standardization, and auth/user-flow polish.

The main issue is not one broken screen. It is system inconsistency. Different modules solve the same UX problems in different ways: tables, filters, buttons, destructive confirmations, date fields, settings pages, navigation, and action feedback are not yet governed by one production-grade design system.

Overall production-readiness estimate: 4.8 / 10.

This does not mean the product is structurally bad. It means the product is still in a builder/demo UX phase in many places. Before customer demos or broad module expansion, the frontend needs a shell and interaction hardening pass.

## Product Owner Observations Incorporated

These observations are now treated as product standards, not optional polish:

1. Shared components must be the project-wide default. If ERP03 already has a shared `DatePicker`, account selector, party selector, item selector, warehouse selector, or any other master-data selector, new and existing module screens should use that shared component by default. A page-specific replacement should require an explicit architecture/product reason.
2. Shared components are a single source of behavior. Updating the account selector's filtering behavior, the date picker's fiscal/date-format behavior, or another shared component should update the behavior project-wide. Duplicated local implementations are a maintainability and data-integrity risk.
3. Loading/waiting states must be consistent. The app currently has different page-level loading experiences. ERP03 needs one standard loading model for page load, table load, form submit, background refresh, and disabled-in-progress actions.
4. Toast and error feedback must distinguish severity. A policy restriction, validation issue, permission issue, posting block, transient API failure, and real system-critical failure should not all be displayed as the same generic "critical error". Users need to understand whether they made an invalid action, hit a business rule, lack permission, or the system failed.
5. Reports must stay governed by one report contract. `ReportContainer` should not only wrap the screen visually; it should standardize parameter intake, filter rendering, refresh behavior, results display, export/print actions, density, UI-mode routing, and empty/loading/error states.
6. Master-data entities should have UI-mode-aware card behavior. Entities such as Items, Parties, Customers, Vendors, Warehouses, and Accounts should have a consistent master-card concept with two supported presentations: normal web/page mode and Windows UI mode. The concept is partially implemented and must be audited for gaps before expanding entity pages.
7. The top-bar widget system is frozen for the current implementation pass. Do not modify widget behavior, widget defaults, `widgetStore`, `DraggableWidgetSpace`, or top-bar widget files unless the product owner explicitly reopens that scope.

Priority impact:

- Shared component governance is P0 where the component controls accounting, date/fiscal behavior, permissions, or master-data references.
- Error/toast severity taxonomy is P0 for posting, approval, tenant/security, and accounting-impacting actions.
- Loading state standardization is P1 because it strongly affects perceived professionalism and supportability, but it is usually less financially dangerous than wrong selectors or wrong error semantics.
- Report contract enforcement is P0 for any new report and P1 for normalizing existing report filters/results beyond the current container usage.
- UI-mode-aware entity cards are P1 for the master-data experience, and P0 for core demo-critical entities such as customers, vendors, items, warehouses, and accounts if those screens are part of the customer demo path.

## Scorecard

| Area | Score | Verdict |
| --- | ---: | --- |
| Product-grade ERP UX | 4.8 / 10 | Functional pieces exist, but the experience is not yet unified enough for a professional ERP. |
| App shell architecture | 6.5 / 10 | Central `AppShell`, `Sidebar`, and `TopBar` exist, but dev/demo routes and duplicate providers reduce confidence. |
| Sidebar information architecture | 4.5 / 10 | Comprehensive, but overloaded and polluted with dev/demo entries in normal navigation. |
| Top bar | 3.5 / 10 | User-configurable widgets are valuable, but widget editing and too many defaults are exposed too strongly in the primary work chrome. |
| Settings consistency | 4.0 / 10 | There is a shared settings layout, but module settings are not yet governed by one taxonomy and interaction model. |
| Login and user flow | 5.0 / 10 | Visually presentable landing/auth page, but incomplete ERP login flow details and inconsistent route handling. |
| RTL/i18n readiness | 4.0 / 10 | Direction support exists technically, but English is hardcoded at startup and many module pages still bypass translation hooks. |
| Tables/lists | 4.0 / 10 | Most operational lists use handwritten tables instead of a shared production data-grid pattern. |
| Reports | 8.0 / 10 | This is the most mature frontend pattern found. Keep it as the model for standardization. |
| Financial operation safety UX | 4.5 / 10 | Confirm/toast rules exist in AGENTS.md, but raw confirms, raw alerts, and silent/custom actions remain in modules. |

## Audit Method

The audit used:

- Planning context review: `planning/ACTIVE.md`, `planning/JOURNAL.md`, `planning/VISION.md`, `planning/PRIORITIES.md`, and `planning/QA-QUEUE.md`.
- Source inspection of frontend shell, router, menu config, auth pages, settings pages, list pages, and report architecture.
- Browser inspection of the public auth/landing route at `http://127.0.0.1:5173/#/auth?mode=login`.
- Visual inspection of the existing internal UI screenshot at `planning/tasks/image.png`.
- Pattern counts across `frontend/src` using repository search.

Authenticated end-to-end UI inspection was intentionally not performed because no safe test credentials were provided. During local search, a credential-like development artifact appeared in output. It was not displayed, copied, or used. Treat credential cleanup as a separate security housekeeping item.

## High-Level Diagnosis

### 1. The top bar needs widget governance, not widget removal

A professional ERP top bar should help the user understand current company, fiscal context, identity, notifications, help, and session controls. ERP03's widget system is a valid product idea because it lets users show and hide the context they personally need. The problem is not the existence of widgets. The problem is governance: layout editing, widget placement, add-widget controls, draggable widget space, clocks, dates, approval mode, UI mode, and appearance controls are too visible in the daily work surface by default.

This creates three UX problems:

- The top bar can compete with the page content instead of supporting it.
- The layout-editing concept is visible to normal users even when they are trying to complete accounting or operational tasks.
- The feature can feel like a configurable demo tool if edit mode is always prominent, even though the personalization capability itself is useful.

Evidence:

- `frontend/src/store/widgetStore.ts` defines many default visible top-bar widgets.
- `frontend/src/layout/TopBar.tsx` exposes layout edit and widget-management controls inside the primary shell.
- `frontend/src/components/topbar/DraggableWidgetSpace.tsx` implements active editing controls in the top bar itself.
- `frontend/src/components/topbar/widgets/NotesWidget.tsx` and `AlarmWidget.tsx` still use placeholder `alert()` behavior.

Recommended direction:

- Current scope decision: do not modify the widget system in the immediate hardening pass. Keep this section as a future governance note only.
- Make the top bar stable by default.
- Keep the widget system as a user personalization feature.
- Let users choose which approved widgets are visible or hidden.
- Move heavy widget layout/editing controls to Appearance/Profile Settings or a clearly entered edit mode, not always-on daily chrome.
- Restrict default visible top-bar content to company, fiscal year/period, current page context, search/command, notifications, help, and user menu.
- Keep advanced widget customization available, but governed by permission, settings, or explicit edit mode.

### 2. The sidebar is overloaded and includes non-production routes

The sidebar is meant to be the ERP's navigation backbone. It currently mixes production modules with development/demo tools. This damages trust immediately because a customer or business user should not see routes such as data-table demos, canvas development, voucher list experiments, or Tailwind demo pages.

Evidence:

- `frontend/src/router/routes.config.ts` includes `/tools/forms-designer`, `/canvas-dev`, `/dev/data-table`, `/dev/voucher-list`, `/dev/smart-vouchers`, and `/dev/tailwind-play-demo` with `hideInMenu: false`.
- `frontend/src/hooks/useSidebarConfig.ts` always appends a `Dev` section with demo/dev routes.

ERP risk:

- Business users may enter unfinished screens and assume they are real features.
- Support and QA become harder because navigation no longer separates production, admin, and development-only tools.
- It weakens perceived control in a financial system.

Recommended direction:

- Hide dev/demo routes behind an explicit development flag.
- Remove the `Dev` section from production sidebar configuration.
- Keep experimental pages route-accessible only in local development or internal QA builds.
- Create a formal navigation taxonomy per module: Operations, Masters, Reports, Settings.

### 3. The app has duplicate React Query providers

ERP03 currently creates two separate QueryClient instances and providers. This is not directly a visual defect, but it can produce inconsistent data caching and invalidation behavior, especially in an ERP where stale balances, stale approval states, or stale posting statuses create user trust problems.

Evidence:

- `frontend/src/queryClient.ts` exports one shared `queryClient`.
- `frontend/src/providers/QueryProvider.tsx` creates a separate `new QueryClient()`.
- `frontend/src/main.tsx` wraps `<App />` with `QueryClientProvider`.
- `frontend/src/App.tsx` wraps routes again with `QueryProvider`.

Recommended direction:

- Use exactly one application-level `QueryClientProvider`.
- Keep React Query Devtools development-only.
- Confirm invalidation behavior after provider consolidation.

### 4. The login/auth flow is visually presentable but not ERP-complete

The public auth page looks like a SaaS marketing site. That can be acceptable for a commercial landing page, but a professional ERP login flow needs stronger operational details:

- Clear separation between marketing landing, tenant login, and super-admin login.
- Forgot/reset password flow visibility.
- Language/direction choice before login.
- Stable hash-router navigation.
- Clear session and logout behavior after company switching.

Evidence:

- Browser inspection showed `document.documentElement.dir = ltr` and `lang = en` on the login route.
- `frontend/src/i18n/config.ts` supports direction updates but initializes with `lng: 'en'`.
- `frontend/src/context/UserPreferencesContext.tsx` stores `erp_language`, but the public login page does not expose language selection.
- `frontend/src/modules/onboarding/pages/LandingPage.tsx` uses `href="/#/admin/login"`.
- `frontend/src/pages/AdminLoginPage.tsx` uses `href="/login"`, which is not hash-router safe.

Recommended direction:

- Add a consistent login route map: public landing, tenant login, super-admin login, forgot password, company selector, logout.
- Make language and direction selectable before login.
- Use router-safe navigation consistently.
- Standardize logout confirmation and post-logout destination.

### 5. Settings are not yet a unified ERP system

The project has `ModuleSettingsLayout`, which is a good start. However, settings pages are still module-specific islands instead of a single predictable ERP settings model.

Evidence:

- `frontend/src/components/shared/ModuleSettingsLayout.tsx` exists and is used by Sales and Purchases settings.
- The layout has fixed width/padding assumptions and no obvious mobile/tab collapse behavior.
- `frontend/src/modules/settings/pages/SettingsHomePage.tsx` is a placeholder rather than a real settings hub.
- Sales and Purchases settings use different tab structures and hardcoded labels.

Recommended direction:

Define a cross-module settings taxonomy:

| Standard Group | Meaning |
| --- | --- |
| General | Numbering, defaults, basic behavior. |
| Workflow | Approvals, lifecycle gates, document policies. |
| Accounting | Posting accounts, voucher integration, financial controls. |
| Tax | Tax behavior, tax code defaults, compliance settings. |
| Printing and Documents | Templates, document output, PDF/email behavior. |
| Notifications | Email, WhatsApp, reminders, internal alerts. |
| Advanced | Dangerous or rarely changed settings, guarded with help text. |

Every module does not need every group, but when a group exists it should mean the same thing everywhere.

### 6. Operational lists and tables are too inconsistent

A professional ERP depends heavily on lists: invoices, vouchers, items, parties, warehouses, receipts, orders, reports. Users learn the system through repeated table interactions. ERP03 still has many handwritten tables and page-local filters.

Observed metrics from source search:

- Approximate frontend TSX files: 386.
- Module page files: 148.
- Files with raw table markup: 112.
- DataTable consumer files found by simple search: 5.
- Raw `<button>` occurrences across frontend: about 1,199.
- Raw date inputs: 18.
- Raw confirm calls: 35.
- Raw alert calls: 7.

Evidence examples:

- `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx` uses custom list/table controls.
- `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx` uses custom list/table controls.
- `frontend/src/modules/inventory/pages/ItemsListPage.tsx` mixes list and creation form behavior with raw table and controls.
- `frontend/src/modules/accounting/pages/VouchersListPage.tsx` is more mature but still custom rather than governed by one shared operational-list system.

Recommended direction:

Create a shared `ERPListPage` or production `DataTable` adoption plan for operational lists. It should standardize:

- Search.
- Filter drawer or filter bar.
- Status chips.
- Row actions.
- Bulk actions.
- Export behavior.
- Empty states.
- Loading skeletons.
- Pagination/density.
- Permission-aware buttons.
- Toast and confirm behavior.

Reports already have a stronger standard through `ReportContainer`. Operational lists need the same level of governance.

### 6A. ReportContainer must become the full report contract, not just a wrapper

ERP03 has the correct direction for reports: every report page should use `ReportContainer`, and the report checker currently enforces route/container usage. The product-owner observation adds an important clarification: the report standard must include parameters and filters, not only visual shell placement.

Evidence:

- `docs/architecture/reports.md` already documents `ReportContainer` as non-negotiable.
- `frontend/src/components/reports/ReportContainer.tsx` is UI-mode aware and routes report pages into window mode where required.
- Report route check passed with 21 report routes and 0 allowlisted routes.

Required contract:

- Report parameters should be typed and explicit.
- Filter controls should use shared selectors and shared date controls.
- Common filters should behave the same everywhere: date range, party, account, warehouse, currency, cost center, status, and mode toggles.
- Report execution should follow the same flow: filter state, run/refresh, loading, results, no data, error, export/print.
- Reports should keep Windows UI mode behavior through `ReportContainer`; individual report pages should not reimplement that routing.

Priority:

- P0 for new reports.
- P1 for existing reports that already pass the container check but still have inconsistent filters, labels, selectors, or result-state behavior.

### 7. RTL/i18n support exists technically but is not consistently productized

The app has i18n infrastructure and direction handling, but many module pages still appear to hardcode labels or do not use the translation hook. This explains why Arabic/RTL readability can break or feel inconsistent even if some lower-level support exists.

Evidence:

- `frontend/src/i18n/config.ts` changes `document.documentElement.dir` based on language.
- Startup language defaults to Arabic when the user has no saved language
  preference. `erp_language` remains the authoritative local preference, and a
  saved backend preference overrides the startup default after authentication.
  The legacy IP detector is prevented from replacing either value by seeding
  its compatibility key during i18n initialization.
- Source search found many module pages without `useTranslation`.
- Many classes use explicit left/right terminology instead of logical direction-aware layout utilities.

Recommended direction:

- Add language selector to public auth and user settings.
- Persist selected language and initialize i18n from that value before first render.
- Replace left/right-specific layout assumptions with RTL-safe patterns where needed.
- Require new user-facing strings to go through i18n.

Account creation and editing now use a dedicated `accountForm` translation
contract in every supported accounting locale. The contract covers tabs,
fields, option labels, financial-policy explanations, custody controls, and
submit states; the component must not retain English-only fallback copy.
- Add Arabic visual QA for shell, sidebar, topbar, settings, lists, and reports.

### 7A. Entity cards must be UI-mode aware

ERP03 already has a Windows UI mode concept, and some entity flows use it. The issue is that this behavior is not yet documented as a master-data standard.

Expected behavior:

- In normal web/page mode, a master-data entity opens as a normal page/card experience.
- In Windows UI mode, the same entity opens in a Windows-style card/window experience.
- The underlying entity behavior should remain the same: validation, selectors, permissions, saving, auditability, and loading/error handling should not diverge by mode.

Evidence:

- `frontend/src/context/UserPreferencesContext.tsx` defines `uiMode` as `classic | windows`.
- `frontend/src/layout/AppShell.tsx` changes shell behavior when `uiMode === 'windows'`.
- `frontend/src/components/reports/ReportContainer.tsx` already uses UI-mode awareness for reports.
- `frontend/src/modules/sales/pages/CustomersListPage.tsx`, `frontend/src/modules/purchases/pages/VendorsListPage.tsx`, `frontend/src/modules/inventory/pages/ItemsListPage.tsx`, and `frontend/src/modules/inventory/pages/WarehousesPage.tsx` contain Windows-mode branching.
- `frontend/src/modules/shared/components/PartyMasterCard.tsx` already points toward a reusable card concept for customers/vendors.

Recommended direction:

- Define an `EntityCard` or master-card contract before further customer/vendor/item/warehouse/account work.
- Audit where entity pages are UI-mode aware and where they are still page-only.
- Keep the entity's business behavior shared across modes; only presentation/container should differ.
- Prioritize core entities: Customer, Vendor, Item, Warehouse, Account.

### 8. Financial action safety is not consistently enforced in the UI

The AGENTS.md rule is correct: every state-changing or destructive user action should use `ConfirmDialog` and every user-triggered result should produce a toast. The codebase does not consistently meet that rule yet.

Evidence:

- Raw `window.confirm` still exists in module and super-admin pages.
- Raw `alert()` placeholders exist in top-bar widgets.
- Many actions use page-local errors or raw button flows.

ERP accounting risk:

- Posting, voiding, cancelling, approving, deleting, and status-changing actions need clear user intent and visible result feedback.
- Weak confirmation UX can cause accidental document lifecycle changes.
- Silent server actions reduce trust and make support harder.

Recommended direction:

- Create a repo-level check for raw `window.confirm` and `alert()` outside explicitly allowlisted dev-only files.
- Convert posting/cancel/delete/status transitions to shared confirmation patterns.
- Standardize toast messages for success, no-op, and error states.
- Define a severity taxonomy so policy/validation blocks do not masquerade as system-critical failures.
- Track recurring error categories so support and engineering can distinguish product-rule friction from real defects.

### 8A. Shared component governance is not yet strict enough

ERP03 already has important shared controls such as date picker and master-data selectors. The product owner clarified that these components should be the default across the project, because changing one shared component should update behavior everywhere.

This is especially important in an ERP because selectors and date fields are not cosmetic controls. They control master-data references, fiscal behavior, posting context, reporting filters, and downstream data quality.

Risk examples:

- A local account input can allow invalid account references.
- A local date input can bypass company date-format or fiscal-calendar behavior.
- A local party/item/warehouse selector can save IDs or codes that do not resolve correctly later.
- A page-local filtering rule can behave differently from the rest of the system.

Recommended direction:

- Treat shared component reuse as the default rule.
- Inventory existing selector/date/loading/toast patterns before refactoring high-traffic pages.
- Add a reviewer checklist or script for raw ID inputs, raw date inputs, and page-local selector clones.
- Allow exceptions only when documented with a product/architecture reason.

### 8B. Loading states are inconsistent across pages

Loading and waiting behavior is part of the product's perceived reliability. ERP03 currently shows different loading behaviors depending on the page or module.

Recommended direction:

- Define standard loading states for full-page loading, table loading, form submit, inline field lookup, background refresh, and disabled-in-progress actions.
- Use shared skeleton/spinner/button-progress components instead of page-local loading implementations.
- Keep long-running accounting or posting actions explicit: users should know that the operation is still in progress and should not click twice.

### 9. The dashboard currently feels demo-oriented

The dashboard should be the user's operational cockpit. Current implementation includes hardcoded/demo-looking values and SaaS upgrade language, which is not appropriate for a serious ERP homepage unless clearly behind mock/demo mode.

Evidence:

- `frontend/src/modules/core/pages/DashboardPage.tsx` contains hardcoded KPI values and phrases such as upgrade/pro-oriented content.

Recommended direction:

- Replace with real tenant/company data or clear empty states.
- Remove upgrade/pro SaaS language from tenant ERP cockpit unless there is a real plan-management module.
- Use role-aware dashboard cards: approvals pending, postings needing attention, open receivables/payables, inventory exceptions, workflow tasks.

### 10. Super-admin and tenant shells are visually and behaviorally divergent

Some difference is expected, but the product should still feel like one ERP. Super Admin should have a deliberately different scope, not a completely unrelated interaction style.

Evidence:

- `frontend/src/layout/SuperAdminShell.tsx` uses separate shell behavior and raw logout confirm.
- Tenant shell uses `TopBar` and widget/user menu patterns.

Recommended direction:

- Keep Super Admin visually distinct through color/scope indicators.
- Reuse shared confirmation, toast, routing, and user menu behavior.
- Make scope explicit: Super Admin vs Tenant Company context.

## Priority Findings

Current product-owner scope decision:

- Top-bar widget behavior is excluded from the current implementation pass. Keep the audit finding for future governance, but do not modify the widget system now.

### P0 - Must Fix Before Customer Demo / Production-like Evaluation

1. Hide dev/demo routes from normal navigation.
2. Consolidate to one React Query provider.
3. Add or confirm a safe login/language/forgot-password flow.
4. Replace raw confirms for posting/cancel/delete/logout flows with shared `ConfirmDialog` where the action is user-facing.
5. Stop showing demo dashboard values as if they are production ERP metrics.
6. Enforce shared DatePicker and master-data selector usage where dates/accounts/parties/items/warehouses are captured.
7. Define toast/error severity taxonomy for posting, approval, permission, validation, policy, tenant/security, and system-failure cases.
8. Keep all new reports on the full `ReportContainer` contract, including parameters and filters, not only route/container presence.

### P1 - Must Fix Before Broad Module Expansion

1. Standardize module settings taxonomy.
2. Adopt one operational list/table pattern.
3. Enforce toast feedback for all server actions.
4. Replace raw date inputs with the shared DatePicker where user-facing.
5. Establish a route/menu governance rule for production vs internal/dev-only routes.
6. Standardize logout, company switch, and post-auth routing.
7. Standardize loading, waiting, and disabled-in-progress states across pages.
8. Inventory shared component adoption and remove local duplicates that already have project-wide shared equivalents.
9. Define and apply a UI-mode-aware entity card standard for customers, vendors, items, warehouses, accounts, and similar master data.
10. Normalize existing report filters/results to the full report contract where gaps remain.

### P2 - Should Fix During UX Hardening

1. Consolidate duplicate icon maps and avoid runtime dependency on remote GitHub image URLs for primary navigation.
2. Remove or clearly mark stale layout components such as `components/layout/MainLayout.tsx` if unused.
3. Normalize empty states, loading states, and permission-denied states.
4. Improve sidebar density and grouping for mobile/tablet.
5. Introduce consistent page headers and breadcrumbs.

### P3 - Later Polish

1. Refine visual language, typography, and hierarchy after shell standardization.
2. Add keyboard command palette if desired, but only after navigation taxonomy is stable.
3. Refine advanced personalization after the base ERP chrome is stable.

## Target Production UX Architecture

The recommended target is not a redesign from scratch. It is a standardization pass around existing components.

### Shell

- Left sidebar: module navigation only.
- Top bar: company/fiscal context, current page context, search/command, notifications, help, user menu.
- Page header: title, breadcrumbs, primary action, status/help text.
- Content area: module pages with consistent spacing and list/form/report behavior.
- Settings hub: one discoverable place for app, company, user, module, and appearance settings.

### Navigation Taxonomy

Every module should use the same structure where applicable:

1. Dashboard or Overview.
2. Operations.
3. Masters.
4. Reports.
5. Settings.

Development tools should not appear in this taxonomy.

### Action Model

Every meaningful user action should answer three questions:

1. What am I about to do?
2. Is this reversible or financially/audit significant?
3. What happened after I clicked?

Implementation model:

- Use `ConfirmDialog` for destructive, posting, voiding, cancelling, approval, status change, and logout actions.
- Use toast success/info/error for all server-triggering actions.
- Use page-level banners only for persistent state that the user must keep seeing.
- Use a shared error severity model:
  - Success: action completed.
  - Info: action succeeded but nothing changed.
  - Validation: user input is incomplete or invalid.
  - Policy block: business rule stopped the action, such as period lock, approval rule, credit rule, or missing setup.
  - Permission block: user is not allowed to perform the action.
  - System error: server/network/unexpected failure.
  - Critical/security: tenant isolation, authentication, authorization, data-loss, posting-integrity, or suspected corruption issue.

### Shared Component Contract

Shared components are not only UI conveniences. They are ERP control points.

Default rule:

- Use the shared `DatePicker` for all user-facing dates.
- Use shared selectors for accounts, parties, items, warehouses, and similar master-data references.
- Use shared confirmation, toast, loading, and table/list components where available.
- Do not build page-local alternatives unless there is a documented exception.

Reason:

- A single shared component lets ERP03 update filtering, permissions, date behavior, fiscal rules, and display behavior project-wide.
- Local duplicates create inconsistent behavior and can corrupt downstream financial or operational data.

### Lists and Tables

Operational list standard:

- Shared table/list component.
- Shared filter model.
- Shared action menu model.
- Shared empty/loading/error states.
- Shared export behavior if allowed.
- Shared status chip taxonomy.
- Permission-aware primary actions.
- Shared loading and disabled-in-progress behavior.

Reports should continue using `ReportContainer`.

### Report Contract

Report pages must be governed by a full contract:

- `ReportContainer` is mandatory.
- Parameters are typed and explicit.
- Filters use shared controls.
- Common filters behave consistently across modules.
- Loading, empty, error, refresh, export, print, and density behavior is consistent.
- Windows UI mode routing stays inside `ReportContainer`.

This keeps reports predictable and prevents every module from inventing its own report behavior.

### Entity Card Contract

Master-data entities should follow a two-mode presentation contract:

- Classic/web mode: normal page or card layout.
- Windows mode: the same entity opens as a Windows-style card/window.

The same entity logic must serve both modes:

- Same validation.
- Same shared selectors.
- Same date handling.
- Same permissions.
- Same save/update/delete behavior.
- Same toast/error severity rules.

Initial target entities:

- Customer.
- Vendor.
- Item.
- Warehouse.
- Account.

## Accounting and Financial Controls Lens

A UX issue in an ERP is often also a control issue. The following are the highest financial-control concerns from this audit:

1. Stale data risk from duplicate QueryClient providers.
2. Accidental lifecycle changes from raw or inconsistent confirmations.
3. User trust risk from demo dashboard values and unfinished dev routes.
4. Incorrect or inconsistent date entry if raw date inputs bypass company date/fiscal calendar rules.
5. Inconsistent settings taxonomy can hide posting/accounting configuration in different places per module.
6. Incomplete RTL/i18n creates adoption and training risk for Arabic users.

### Chart-of-Accounts tree controls

The account tree uses logical RTL behavior without changing its accounting
hierarchy:

- Expanded nodes use a downward chevron in every language.
- Collapsed nodes use a right chevron in LTR and a left chevron in RTL.
- Each expand/collapse control is a semantic button with a 36 by 36 pixel hit
  target, translated accessible name, and `aria-expanded` state.
- Toolbar actions use non-wrapping labels so Expand All, Collapse All, and New
  Account remain one-line controls.

These are presentation and accessibility rules only. The tree source,
parent/child relationships, header/posting roles, account codes, and mutation
behavior remain unchanged.

## Recommended Implementation Sequence

1. Phase 0: Baseline cleanup and guardrails.
2. Phase 1: Production shell cleanup.
3. Phase 2: Sidebar/topbar information architecture hardening.
4. Phase 3: Settings taxonomy standardization.
5. Phase 4: Operational list/table standardization.
6. Phase 5: Action safety and date-picker enforcement.
7. Phase 6: Auth, language, RTL, and session-flow polish.
8. Phase 7: Visual QA and customer-demo readiness review.

See `planning/tasks/132-ux-layout-production-hardening.md` for the execution-ready task plan.

## Non-Goals

This audit does not recommend changing accounting posting logic, voucher semantics, tenant isolation, or backend financial behavior. It focuses on frontend UX and layout production readiness. Any future implementation that touches posting, approvals, accounting settings, taxes, or inventory valuation must go through the ERP/accounting architecture review process.

## Final Recommendation

Do not start by polishing colors or typography. That would hide the real problem. Start by removing dev/demo exposure, stabilizing the shell outside the frozen widget system, and enforcing common interaction patterns. Top-bar widget governance is a later scope decision, not part of the immediate implementation pass. After that, visual design polish will have a stable foundation.
