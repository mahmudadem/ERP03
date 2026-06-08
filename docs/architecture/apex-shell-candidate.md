# Apex Shell Candidate Architecture

## Status

The Apex shell is a production candidate, not the active tenant shell. It remains mounted under `/dev/apex-ledger` and hidden from normal tenant navigation while it is hardened.

## Current Design

The candidate route is isolated by `AppShell` for `/dev/apex-ledger`. The shell renders its own Apex sidebar, header, and page surface while still using the same application providers around the route.

The Apex sidebar no longer owns a separate hardcoded module tree. It adapts the output from `useSidebarConfig()`, which means it inherits:

- active company module bundles
- RBAC filtering
- document workflow visibility
- dynamic voucher/form grouping
- shared menu labels and icons where available

This keeps Apex aligned with the tenant navigation contract instead of creating a second source of truth.

## Prototype Scale Contract

The Apex candidate shell scale is intentionally based on the downloaded prototype source at `D:\DEV2026\apex-ledger-erp.zip`. The prototype used a larger, viewport-bound shell instead of the tighter legacy application chrome.

Current shell sizing rules:

- The Apex route root is `h-screen min-h-screen flex overflow-hidden` so the sidebar spans the full viewport height.
- The sidebar is `w-64`, `h-screen`, and `min-h-screen`, with header and footer fixed inside the sidebar and only the menu body scrolling.
- Sidebar chrome follows the prototype rhythm: `p-4` header/footer spacing, `px-3 py-4` menu body, `px-3 py-2.5 text-xs` top-level rows, `w-4 h-4` top-level icons, and slightly larger footer/user controls.
- The top header, search width, and main work area use the prototype scale instead of the smaller legacy shell scale.
- Main content uses `p-6` with a constrained inner `max-w-7xl` surface, matching the prototype's larger workspace density without changing native page contracts.

This is a visual-shell restoration only. The route adapters, RBAC filtering, native page mounting, and data contracts remain unchanged.

## Prototype Typography Contract

The downloaded Apex prototype loads `Inter` for UI text and `JetBrains Mono` for code, counters, badges, and compact metadata. It also renders at the browser's normal root font scale.

The main ERP shell intentionally applies `font-size: 90%` in `frontend/src/styles/globals.css` for dense dashboard ergonomics. Apex must not inherit that smaller typography scale because it makes matching prototype classes render visibly smaller and lighter.

Current typography rules:

- `frontend/index.html` loads the prototype font families and weights: `Inter` 400-900 and `JetBrains Mono` 400-800.
- The Apex route root uses `apex-ledger-shell`, which scopes `--app-font-family` back to `Inter`.
- `.apex-ledger-shell .font-mono` scopes mono text to `JetBrains Mono`.
- `ApexLedgerDashboard` temporarily sets `document.documentElement.style.fontSize = '100%'` while the Apex shell is mounted, then restores the previous inline root font size when it unmounts.

This preserves the main shell's compact typography while making Apex typography match the prototype's actual rendering contract.

## Company Settings Footer Parity

The main tenant shell does not receive Company Settings from `useSidebarConfig()`. It appends that section directly in `frontend/src/layout/Sidebar.tsx` as a footer block.

Because the Apex sidebar originally adapted only `useSidebarConfig()`, Company Settings did not appear in Apex even when it appeared in the main shell. Apex now carries a matching footer-level Company Settings section and removes the old Apex-specific user/profile footer.

The Apex Company Settings footer links to the same tenant destinations through `tenantPathToApexPath()`:

- `/company-admin/overview`
- `/company-admin/users`
- `/company-admin/roles`
- `/company-admin/modules`
- `/company-admin/features`
- `/company-admin/bundles`
- `/system/currencies`
- `/settings/tax-codes`
- `/settings/notifications`
- `/settings/communications`
- `/company-admin/settings`

These routes mount inside Apex through `NativeCompanySettingsRouteMount`, which reuses the existing `routesConfig` pages and guards. Apex does not copy or simplify the Company Admin settings pages.

## Route Translation

The candidate namespace still uses `/dev/apex-ledger` while Apex is being validated, but production tenant routes must remain stable after cutover. The bridge lives in `frontend/src/pages/dev/apex-ledger/routeMap.ts`.

Key rules:

- `tenantPathToApexPath()` converts permission-filtered tenant sidebar paths into Apex candidate paths.
- `apexPathToTenantPath()` keeps the reverse mapping explicit for future page mounting and cutover work.
- Accounting report aliases are documented in one place, for example `/accounting/reports/consolidated-trial-balance` maps to `/dev/apex-ledger/reports/consolidated-tb`.
- AI routes are normalized from `/ai-assistant/*` to `/dev/apex-ledger/ai/*`.
- Dynamic suffixes, query strings, and hash fragments are preserved.

The Apex sidebar renders the same visual shell, but its runtime child items now come from the real `useSidebarConfig()` tree. This preserves item-level permissions, workflow hiding, and dynamic form groups. The old curated Apex menu list remains only as a visual reference and must not be treated as the runtime navigation contract.

## Native Sales Page Mounting

Sales operational subroutes are mounted inside the Apex shell through `frontend/src/pages/dev/apex-ledger/components/NativeSalesRouteMount.tsx`.

The mount reuses the existing production `routesConfig` entries for `/sales/*` instead of importing or copying individual Sales pages. Each mounted route keeps the same guard stack used by the main router:

- `ModuleConfigurationGuard`
- `WorkflowModeGuard`
- `ProtectedRoute`

This means direct Apex candidate paths such as `/dev/apex-ledger/sales/invoices`, `/dev/apex-ledger/sales/invoices/new`, `/dev/apex-ledger/sales/orders/:id`, `/dev/apex-ledger/sales/reports/customer-statement`, and `/dev/apex-ledger/sales/settings` render the native production Sales pages inside the Apex chrome.

The Sales module root `/dev/apex-ledger/sales` still renders the Apex Sales overview/workbench. Concrete list, detail, report, settings, setup, and dynamic document subroutes render the native pages because those pages own the real posting controls, attachments, messaging, audit behavior, report containers, and workflow edge cases.

Native Sales pages still contain internal `navigate('/sales/...')` calls. While Apex is mounted under the candidate namespace, `NativeSalesRouteMount` installs an Apex-only hash route bridge that translates those internal Sales navigations back to `/dev/apex-ledger/sales/...`. This keeps candidate QA inside Apex without editing every Sales page.

## Native Purchases And Inventory Page Mounting

Purchases and Inventory operational subroutes are mounted inside Apex through `frontend/src/pages/dev/apex-ledger/components/NativeModuleRouteMount.tsx`.

The mount filters `routesConfig` by module path, then renders the existing native production page components inside the Apex shell. Each route keeps the same guard stack used by the main router:

- `ModuleConfigurationGuard`
- `WorkflowModeGuard`
- `ProtectedRoute`

This means candidate paths such as `/dev/apex-ledger/purchases/invoices`, `/dev/apex-ledger/purchases/invoices/new`, `/dev/apex-ledger/purchases/goods-receipts/:id`, `/dev/apex-ledger/purchases/reports/vendor-statement`, `/dev/apex-ledger/inventory/items`, `/dev/apex-ledger/inventory/stock-levels`, `/dev/apex-ledger/inventory/transfers`, and `/dev/apex-ledger/inventory/settings` render the native production pages inside Apex.

The module roots `/dev/apex-ledger/purchases` and `/dev/apex-ledger/inventory` still render the Apex workbench sections. Concrete list, detail, report, settings, setup, and dynamic document subroutes render native pages because those pages own the real posting controls, stock controls, report containers, audit behavior, settings behavior, and workflow edge cases.

Native Purchases and Inventory pages may still contain internal `navigate('/purchases/...')` or `navigate('/inventory/...')` calls. While Apex is mounted under the candidate namespace, `NativeModuleRouteMount` installs an Apex-only hash route bridge that translates those internal navigations back to `/dev/apex-ledger/purchases/...` or `/dev/apex-ledger/inventory/...`. This keeps candidate QA inside Apex without editing every native page.

## Native Settings/RBAC And AI Page Mounting

Settings/RBAC and AI assistant subroutes are also mounted inside Apex through `NativeModuleRouteMount`.

Settings routes use the native `/settings/*` route tree and render under `/dev/apex-ledger/settings/*`. This covers general settings, topbar widgets, sidebar configuration, approval workflow, and RBAC role/user assignment pages. Company Settings footer routes remain handled by `NativeCompanySettingsRouteMount`, because those paths also include `/company-admin/*`, `/system/currencies`, and selected `/settings/*` pages that belong to the Company Settings footer contract.

AI routes use the native `/ai-assistant/*` route tree but render under the Apex alias `/dev/apex-ledger/ai/*`. The route bridge translates internal native AI navigations such as `/ai-assistant/settings` back to `/dev/apex-ledger/ai/settings` during candidate QA.

This slice improves route coverage only. It does not redesign Settings/RBAC or AI pages into Apex-native views. Page-level Apex redesign should happen after the route coverage and feature-flag cutover checks are stable.

## Accounting And Tools Route Coverage Audit

The Apex shell keeps Apex-native Accounting overview, COA, voucher list, and report surfaces where dedicated Apex components exist. A follow-up route audit found that several non-overview Accounting routes still needed native mounting:

- `/accounting/setup`
- `/accounting/recurring-vouchers`
- `/accounting/cost-centers`
- `/accounting/window-config-test`
- `/accounting/wizard-test`
- `/accounting/vouchers/:id`
- `/accounting/vouchers/:id/view`
- `/accounting/vouchers/demo`
- `/accounting/tools/voucher-designer`
- `/accounting/budgets`
- `/accounting/settings/subgroup-tagging`
- `/tools/forms-designer`

These are now routed through `NativeModuleRouteMount` where appropriate. Accounting aliases such as `/accounting/vouchers/:id` still use Apex URLs like `/dev/apex-ledger/vouchers/:id`, but the rendered page is the native production route component with its existing guards.

A stricter route audit then parsed the tenant route table and found additional non-accounting routes that were still falling to the generic Apex placeholder. `NativeModuleRouteMount` now includes a `remaining` route group for valid production routes that do not yet have dedicated Apex-native sections:

- `/companies`
- `/notifications`
- `/companyAdmin/*`
- `/error-test`
- `/test-notification`
- `/hr/*`
- `/pos`
- `/super-admin/*`
- `/company-wizard/*`
- `/crm/*`
- `/manufacturing/*`
- `/projects/*`
- `/canvas-dev`

This is route continuity only. These pages still render their native production components and keep their existing guards. Super Admin routes are included so direct Apex URLs do not degrade to placeholders, but they require separate platform-role QA before any decision to make Apex the default shell for global owner workflows.

## Data Safety

The candidate dashboard no longer falls back to `dummyData.ts` when live API arrays are empty. Empty tenant data must render as empty tenant data. Showing sample balances, documents, parties, or audit logs is unsafe in an ERP because users can mistake it for real financial state.

The old Apex dummy data file was removed after all imports were eliminated.

## Dev Navigation

`useSidebarConfig()` now hides dev/demo routes unless:

- the app is running in Vite development mode, or
- `localStorage.erp_show_dev_navigation` is set to `true`

Static route entries for dev previews are also marked `hideInMenu: true`. This prevents production tenant navigation from advertising preview surfaces.

## Action Safety

The Apex Sales candidate no longer uses raw browser `confirm()` for delete actions. It uses the shared `ConfirmDialog` and toast feedback, matching the project-wide action safety rule.

## Cutover Rule

Do not replace the main tenant shell until these are complete:

- authenticated visual QA in English and Arabic RTL (RTL layout fixes implemented)
- sidebar navigation check across tenant roles and module bundles
- route coverage for module subpaths, settings, and profile routes
- native page mounting for operational Purchases, Inventory, Settings/RBAC, and AI subroutes that are not yet Apex-native equivalents
- full QA of native Sales page mounting inside Apex
- empty-data checks for a new tenant
- no raw confirm/alert guards failing in build
- frontend typecheck and production build passing

## RTL Support

The candidate shell is fully optimized for RTL layout directions (such as Arabic language). When the application reading direction flips:
- The dynamic parent container wraps the layouts and sets `dir="rtl"` automatically.
- Sidebar borders, menu padding, list offsets, and active state indicators adapt conditionally (`rtl:...` utility classes).
- Layout spacers in the sidebar, header top bar, and dashboard cards utilize direction-agnostic `gap` flex layout systems instead of direction-dependent margin sets.
- Chevron icons rotate 180 degrees dynamically (`rtl:rotate-180`).
- Text alignments default to right-align dynamically (`text-left rtl:text-right`).
- Absolute search utility icons and input text box offset paddings shift sides automatically (`left-2.5 rtl:left-auto rtl:right-2.5`, etc.).

## Accounting Impact

This slice is shell/navigation work only. It does not change voucher posting, ledger write paths, approval policies, period locks, tax calculation, AR/AP balances, inventory valuation, or database schema.
