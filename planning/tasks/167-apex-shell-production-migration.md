# Task 167 - Apex Shell Production Candidate Migration

## Goal

Build the Apex shell as a separate production candidate, validate it against the real ERP contracts, then cut it over as the main tenant shell only after it is functionally safe.

This task replaces the failed approach of applying Apex styling on top of the legacy shell. The two shells use different layout structures, so the safe path is to harden Apex natively instead of carrying conditional styling across both worlds.

## Why This Path

- The legacy shell has hardcoded Tailwind geometry and hover behavior that fights the Apex visual grid.
- Apex needs a different sidebar and header structure, not only different colors.
- A candidate route lets us validate navigation, permissions, real tenant data, RTL, and action safety before changing the main tenant route.
- The current route remains hidden from normal tenant navigation until cutover.

## Scope

### Slice 1 - completed 2026-06-04

Estimated: 1.5-2.0 hours.
Actual: about 1.8 hours.

- Gate dev/demo navigation out of production sidebar data.
- Hide Apex/dev preview routes from static menu config.
- Replace Apex hardcoded sidebar data with an adapter over `useSidebarConfig()`.
- Remove Apex dummy data fallback from live API queries.
- Replace hardcoded user/company labels in the Apex shell surfaces.
- Replace raw browser confirmation in Apex Sales UI with `ConfirmDialog`.
- Delete now-unused Apex dummy data source.

### Slice 2 - completed 2026-06-04

Estimated: 2-3 hours.
Actual: about 1.2 hours.

- Expand Apex route coverage or add a single Apex wildcard route for module subpaths that should stay inside the shell.
- Wire global tenant settings and profile pages into the Apex shell instead of exiting to the legacy shell.
- Do authenticated visual QA in English and Arabic RTL at desktop and mobile sizes.
- Decide the exact cutover route strategy: replace `AppShell` tenant branch or introduce a feature flag first.

### Slice 3A - route/page coverage matrix - completed 2026-06-05

Estimated: 0.5-1.0 hours.
Actual: about 0.6 hours.

- Audited tenant routes, `moduleMenuMap`, `useSidebarConfig`, Apex sidebar, and `ApexLedgerDashboard` route handling.
- Confirmed the correct strategy is not to copy main-shell pages.
- Documented that Apex should own shell/chrome, adapt the real sidebar item tree, and embed native production pages for operational workflows until Apex-native replacements are contract-equivalent.
- Created [planning/briefs/20260605-apex-route-page-coverage-matrix.md](../briefs/20260605-apex-route-page-coverage-matrix.md).

### Slice 3B - route/sidebar adapter - completed 2026-06-05

Estimated: 2-3 hours.
Actual: about 1.1 hours.

- Add a route translation helper for tenant path <-> Apex path mappings, including explicit aliases where Apex route names currently differ.
- Adapt the real `useSidebarConfig()` item tree into the Apex visual sidebar instead of using static child lists.
- Preserve item-level permissions, workflow hiding, dynamic form groups, and translations.
- Keep the Apex sidebar DOM and visual styling.
- Completion report: [planning/done/170-apex-route-sidebar-adapter.md](../done/170-apex-route-sidebar-adapter.md).

### Slice 3C-Sales - native page mounting inside Apex - completed 2026-06-05

Estimated: 2-3 hours.
Actual: about 1.3 hours.

- Mounted existing native production Sales subroutes inside the Apex shell by reusing `routesConfig` instead of copying Sales pages.
- Preserved the Apex Sales overview for `/dev/apex-ledger/sales`.
- Reused the normal route guard stack for Sales native pages: module configuration, workflow mode, RBAC, and module bundle checks.
- Added an Apex-only Sales hash-route bridge so internal native `navigate('/sales/...')` calls stay inside `/dev/apex-ledger/sales/...` during candidate QA.
- Completion report: [planning/done/171-apex-sales-native-page-mounting.md](../done/171-apex-sales-native-page-mounting.md).

### Visual hotfix - prototype scale restoration - completed 2026-06-05

Estimated: 0.5-1.0 hours.
Actual: about 0.6 hours.

- Inspected `D:\DEV2026\apex-ledger-erp.zip`, the downloaded Apex prototype source.
- Restored the candidate shell scale toward the prototype instead of the smaller legacy shell scale.
- Changed the Apex route root and sidebar to full viewport height so the sidebar covers the complete vertical space.
- Increased sidebar, topbar, search, footer, icon, and main content spacing to the prototype rhythm.
- Completion report: [planning/done/173-apex-shell-prototype-scale-restoration.md](../done/173-apex-shell-prototype-scale-restoration.md).

### Visual/navigation hotfix - Company Settings sidebar parity - completed 2026-06-05

Estimated: 0.5-1.0 hours.
Actual: about 0.7 hours.

- Confirmed Company Settings was missing because the main shell appends it in `frontend/src/layout/Sidebar.tsx`; it is not part of `useSidebarConfig()`.
- Replaced the Apex-specific bottom user/profile footer with a Company Settings footer matching the main sidebar.
- Added Apex route detection for company-admin, currency, tax-code, notification, and communication settings paths.
- Mounted those native settings pages inside Apex through `NativeCompanySettingsRouteMount` using existing `routesConfig` pages and guards.
- Completion report: [planning/done/174-apex-company-settings-sidebar-parity.md](../done/174-apex-company-settings-sidebar-parity.md).

### Visual hotfix - prototype typography restoration - completed 2026-06-05

Estimated: 0.5-1.0 hours.
Actual: about 0.5 hours.

- Compared the downloaded prototype typography source against ERP03 globals.
- Confirmed the mismatch was caused by the main shell's global `font-size: 90%` and the missing prototype mono font.
- Loaded the prototype font families/weights in `frontend/index.html`.
- Scoped Apex to Inter and JetBrains Mono through `.apex-ledger-shell`.
- Temporarily restores root font size to 100% while Apex is mounted, then restores the prior inline value on unmount.
- Completion report: [planning/done/176-apex-prototype-typography-restoration.md](../done/176-apex-prototype-typography-restoration.md).

### Slice 3C-Purchases/Inventory - native page mounting inside Apex - completed 2026-06-05

Estimated: 4-6 hours total.
Actual: about 0.9 hours for the shared route mount and dashboard wiring.

- Added a shared native module route mount for Apex candidate module pages.
- Mounted existing native production Purchases subroutes inside the Apex shell by reusing `routesConfig` instead of copying Purchases pages.
- Mounted existing native production Inventory subroutes inside the Apex shell by reusing `routesConfig` instead of copying Inventory pages.
- Preserved the Apex Purchases and Inventory overview/workbench sections for `/dev/apex-ledger/purchases` and `/dev/apex-ledger/inventory`.
- Reused the normal route guard stack for native pages: module configuration, workflow mode, RBAC, and module bundle checks.
- Added an Apex-only module hash-route bridge so internal native `navigate('/purchases/...')` and `navigate('/inventory/...')` calls stay inside `/dev/apex-ledger/...` during candidate QA.
- Completion report: [planning/done/177-apex-purchases-inventory-native-page-mounting.md](../done/177-apex-purchases-inventory-native-page-mounting.md).

### Slice 3C-Settings/RBAC/AI - native page mounting inside Apex - completed 2026-06-06

Estimated: 2-3 hours.
Actual: about 0.8 hours.

- Extended the shared Apex native module route mount to support Settings/RBAC and AI route aliases.
- Mounted existing native production Settings/RBAC subroutes inside Apex by reusing `routesConfig`.
- Mounted existing native AI Assistant subroutes inside Apex through the `/dev/apex-ledger/ai/*` alias while preserving native `/ai-assistant/*` route components.
- Preserved Company Settings footer routing through `NativeCompanySettingsRouteMount`.
- Preserved dedicated `/dev/apex-ledger/settings/accounting` handling for the Accounting Settings detail page.
- Reused the normal route guard stack for native pages: module configuration, workflow mode, RBAC, global-role, and module bundle checks.
- Added an Apex-only hash-route bridge so internal native `/settings/...` and `/ai-assistant/...` navigations stay inside `/dev/apex-ledger/...` during candidate QA.
- Completion report: [planning/done/178-apex-settings-rbac-ai-native-page-mounting.md](../done/178-apex-settings-rbac-ai-native-page-mounting.md).

### Slice 3D - cutover candidate

Estimated: 2-4 hours, depending on QA findings.

- Put Apex behind a tenant-shell feature flag.
- Run full role/module-bundle navigation checks.
- Run smoke checks for Accounting, Sales, Purchases, Inventory, AI Assistant, Settings, and empty tenant data.
- Only then make Apex the default main tenant shell.

## Acceptance Criteria

- Apex sidebar uses the real module/RBAC/sidebar source of truth.
- Apex does not display fake tenant balances, invoices, parties, inventory, or audit rows.
- Dev/demo routes are not advertised in tenant production navigation.
- User/company labels come from auth and company context.
- Destructive actions use `ConfirmDialog` and visible feedback.
- Frontend `typecheck` and production `build` pass.
- Authenticated visual QA is completed before any main-route cutover.

## Risks

- Apex still lives under `/dev/apex-ledger`; protected visual QA needs an authenticated session.
- Purchases and Inventory native mounting still requires authenticated manual QA across workflow modes, restricted roles, Arabic RTL, and empty tenant data.
- Sales native mounting still requires authenticated manual QA across workflow modes, restricted roles, and Arabic RTL.
- Settings/RBAC and AI native mounting still requires authenticated manual QA across restricted roles, global-role checks, Arabic RTL, disabled modules, and AI permission combinations.
- The restored prototype scale still needs authenticated visual QA against Mahmud's browser, especially Arabic RTL and smaller laptop widths.
- This task does not change posting logic, ledger policies, taxes, inventory costing, or database schema.
