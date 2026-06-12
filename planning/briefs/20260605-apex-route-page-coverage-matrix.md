# Brief: Apex Route and Page Coverage Matrix

**For:** Codex / Antigravity frontend builder  
**From:** Codex  
**Date:** 2026-06-05  
**Task:** Task 167 Slice 3a - route/page coverage before Apex cutover

## Context

The product direction is now clear: Apex should become the production tenant shell after validation. It should not be built by copying all main-shell pages or by styling the legacy shell.

The safe target is:

- Apex owns shell chrome: sidebar, topbar, layout, RTL behavior, route container, and cutover flag.
- Existing ERP pages remain the source of truth for operational business workflows.
- Apex-native pages are allowed only where they preserve the same API contracts, permissions, posting controls, audit behavior, and empty states.
- The original Apex sidebar visual style must remain the baseline. Do not replace it with the legacy sidebar DOM.

This brief was created after reading:

- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/VISION.md`
- `planning/PRIORITIES.md`
- `planning/tasks/167-apex-shell-production-migration.md`
- `frontend/src/router/routes.config.ts`
- `frontend/src/config/moduleMenuMap.ts`
- `frontend/src/hooks/useSidebarConfig.ts`
- `frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`
- `frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx`

## Current Findings

### 1. Wildcard routing exists, but page coverage is not complete

`routes.config.ts` now registers `/dev/apex-ledger/*`, so Apex subpaths no longer fall out of the candidate shell. That solves route containment, not page equivalence.

Current `ApexLedgerDashboard.getActiveSectionFromPath()` behavior:

| Apex path family | Current render result |
| --- | --- |
| `/dev/apex-ledger` | Apex dashboard home |
| `/dev/apex-ledger/accounting` | Apex accounting overview |
| `/dev/apex-ledger/coa` | Apex COA section |
| `/dev/apex-ledger/vouchers` | Apex voucher list section |
| `/dev/apex-ledger/approvals` | Apex approval center |
| `/dev/apex-ledger/reports/*` | Apex report pages for supported slugs |
| `/dev/apex-ledger/tools/*` | Apex tools placeholder cards with links to legacy/native pages |
| `/dev/apex-ledger/settings` | Apex accounting settings hub |
| `/dev/apex-ledger/settings/appearance` | Embedded real Appearance settings |
| `/dev/apex-ledger/settings/accounting` | Embedded real Accounting settings |
| `/dev/apex-ledger/profile` | Embedded real Profile page |
| `/dev/apex-ledger/sales/*` | Same Apex `SalesSection` for every sales subpath |
| `/dev/apex-ledger/purchases/*` | Same Apex `PurchasesSection` for every purchases subpath |
| `/dev/apex-ledger/inventory/*` | Same Apex `InventorySection` for every inventory subpath |
| `/dev/apex-ledger/ai/*` | Same Apex `AIAssistantSection` for every AI subpath |
| `/dev/apex-ledger/hr/*`, `crm/*`, `pos/*`, `manufacturing/*`, `projects/*` | Generic "Module Coming Soon" placeholder |

### 2. Apex sidebar currently preserves module visibility, but not per-item visibility

`Sidebar.tsx` calls `useSidebarConfig()` and collects visible module IDs, then filters the static `APEX_MODULES` list by module ID.

This means:

- If Sales is hidden, Apex hides Sales.
- If Purchases is hidden, Apex hides Purchases.
- But inside a visible module, the child items are still Apex's static curated list.

Risk: per-item permissions, workflow hiding, dynamic forms, and tenant-specific sidebar groups can drift from the main tenant sidebar. That is not safe enough for cutover.

Required fix: adapt the real `useSidebarConfig()` item tree into the Apex visual renderer instead of only using it to decide which modules exist.

### 3. Some Apex menu paths diverge from tenant route names

Examples:

| Main tenant route | Current Apex sidebar route |
| --- | --- |
| `/accounting/reports/consolidated-trial-balance` | `/dev/apex-ledger/reports/consolidated-tb` |
| `/sales/reports/sales-analytics` | `/dev/apex-ledger/sales/reports/analytics` |
| `/sales/aged-backlog` | `/dev/apex-ledger/sales/reports/aged-backlog` |
| `/purchases/reports/purchases-analytics` | `/dev/apex-ledger/purchases/reports/analytics` |
| `/inventory/alerts/low-stock` | `/dev/apex-ledger/inventory/alerts` |
| `/inventory/reports/unsettled-costs` | `/dev/apex-ledger/inventory/unsettled-costs` |
| `/inventory/reports/valuation` | `/dev/apex-ledger/inventory/valuation` |

These are acceptable only if a route translation table makes the mapping explicit. Otherwise QA and future agents will confuse route containment with real page parity.

### 4. Apex Sales/Purchases/Inventory sections are not full ERP workflow replacements

The current Apex module-root sections are visually useful, but they are not equivalent to the native operational pages.

Financial/control risk:

- Sales detail pages include posting, attachments, messaging, audit, credit/period-lock behavior, and document status handling.
- Purchase detail pages include vendor invoice controls, attachments, AP/inventory integration, and workflow-specific rules.
- Inventory pages include stock adjustment/transfer/opening stock flows and costing/valuation controls.

Therefore, do not treat `SalesSection`, `PurchasesSection`, or `InventorySection` as production replacements for native operational pages unless they are fully audited and brought to parity. For Slice 3 cutover, the safer approach is to mount existing native list/detail/settings/report pages inside the Apex shell.

## Coverage Matrix

Legend:

- `Apex-native OK`: current Apex page can remain as a candidate visual page after QA.
- `Embed native now`: mount the existing production page inside Apex for cutover safety.
- `Placeholder OK`: future module or intentionally unbuilt surface.
- `Needs decision`: requires product/architecture decision before implementation.

### Shell and Core

| Tenant route family | Apex target | Recommendation |
| --- | --- | --- |
| `/` dashboard | `/dev/apex-ledger` | Apex-native OK, but empty-data states still need QA |
| `/profile` | `/dev/apex-ledger/profile` | Embedded native already done |
| `/notifications` | `/dev/apex-ledger/notifications` | Embed native now or keep topbar bell disabled until mapped |
| `/companies`, `/company-selector`, `/company-wizard/*` | outside tenant shell | Needs decision; these are company/session flows, not normal Apex module pages |

### Accounting

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/accounting` | Apex accounting overview | Apex-native OK after empty-data QA |
| `/accounting/accounts` | Apex COA section at `/coa` | Needs decision: use Apex COA only if it matches native COA behavior; otherwise embed native `AccountsListPage` |
| `/accounting/vouchers` | Apex voucher list | Needs decision: must verify filters, view/edit navigation, posting permissions |
| `/accounting/vouchers/:id`, `/:id/view` | Not mapped to real editor/viewer | Embed native now |
| `/accounting/approvals` | Apex approval center | Needs QA against native approval behavior |
| `/accounting/reports/*` | Mostly Apex-native report pages | Apex-native OK for the built report pages; use explicit slug map for consolidated trial balance |
| `/accounting/budgets` | Apex tool placeholder then legacy/native link | Embed native now |
| `/accounting/settings/subgroup-tagging` | Apex tool placeholder then legacy/native link | Embed native now |
| `/accounting/settings` | Embedded native details at `/settings/accounting`; Apex hub at `/settings` | Keep both: Apex hub plus native details |
| `/accounting/recurring-vouchers` | Not covered | Embed native now |
| `/accounting/cost-centers` | Not covered | Embed native now |
| `/accounting/forms-designer`, `/accounting/tools/voucher-designer` | Tool placeholder/link only | Embed native now |

### Sales

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/sales` | Apex sales workbench | Apex-native OK only as overview; keep read-oriented |
| `/sales/customers`, `/sales/customers/:id` | Collapses to `SalesSection` | Embed native now |
| `/sales/items`, `/sales/items/:id` | Collapses to `SalesSection` | Embed native now |
| `/sales/quotes`, `/sales/quotes/new`, `/sales/quotes/:id` | Collapses to `SalesSection` | Embed native now |
| `/sales/orders`, `/sales/orders/:id` | Collapses to `SalesSection` | Embed native now |
| `/sales/delivery-notes`, `/new`, `/:id` | Collapses to `SalesSection` | Embed native now |
| `/sales/invoices`, `/new`, `/:id` | Collapses to `SalesSection` | Embed native now; this protects posting, attachments, messaging, audit, period-lock, and credit controls |
| `/sales/returns`, `/new`, `/:id` | Collapses to `SalesSection` | Embed native now |
| `/sales/reports/ar-aging` | Collapses to `SalesSection` | Embed native now, preserving `ReportContainer` |
| `/sales/reports/customer-statement` | Collapses to `SalesSection` | Embed native now, preserving ledger-backed behavior |
| `/sales/reports/sales-analytics` | Apex route uses `/reports/analytics` | Embed native now and normalize route mapping |
| `/sales/aged-backlog` | Apex route uses `/reports/aged-backlog` | Embed native now and normalize route mapping |
| `/sales/recurring-invoices` | Not in Apex sidebar | Embed native now or add to sidebar only if enabled |
| `/sales/customer-groups`, `/price-lists`, `/salespersons`, `/promotions` | Collapses to `SalesSection` | Embed native now |
| `/sales/settings` | Collapses to `SalesSection` | Embed native now |
| `/sales/:formCode/*` dynamic forms | Not covered explicitly | Must come from adapted `useSidebarConfig()`; do not hardcode |

### Purchases

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/purchases` | Apex purchases workbench | Apex-native OK only as overview; keep read-oriented |
| `/purchases/vendors`, `/purchases/vendors/:id` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/items`, `/purchases/items/:id` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/orders`, `/:id` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/goods-receipts`, `/new`, `/:id` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/invoices`, `/new`, `/:id` | Collapses to `PurchasesSection` | Embed native now; protects AP/inventory/posting controls |
| `/purchases/returns`, `/new`, `/:id` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/reports/vendor-statement` | Collapses to `PurchasesSection` | Embed native now; must preserve ledger-backed report behavior |
| `/purchases/reports/ap-aging` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/reports/purchases-analytics` | Apex route uses `/reports/analytics` | Embed native now and normalize route mapping |
| `/purchases/vendor-groups`, `/price-lists` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/settings` | Collapses to `PurchasesSection` | Embed native now |
| `/purchases/:formCode/*` dynamic forms | Not covered explicitly | Must come from adapted `useSidebarConfig()`; do not hardcode |

### Inventory

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/inventory` | Apex inventory workbench | Apex-native OK only as overview; keep read-oriented |
| `/inventory/items`, `/inventory/items/:id` | Collapses to `InventorySection` | Embed native now |
| `/inventory/categories`, `/uoms`, `/warehouses` | Collapses to `InventorySection` | Embed native now |
| `/inventory/opening-stock` | Collapses to `InventorySection` | Embed native now; this affects opening stock controls |
| `/inventory/adjustments` | Collapses to `InventorySection` | Embed native now; stock movement control surface |
| `/inventory/transfers` | Collapses to `InventorySection` | Embed native now |
| `/inventory/stock-levels`, `/movements` | Collapses to `InventorySection` | Embed native now |
| `/inventory/alerts/low-stock` | Apex route uses `/inventory/alerts` | Embed native now and normalize route mapping |
| `/inventory/reports/unsettled-costs` | Apex route uses `/inventory/unsettled-costs` | Embed native now and normalize route mapping |
| `/inventory/reports/valuation` | Apex route uses `/inventory/valuation` | Embed native now and normalize route mapping |
| `/inventory/settings` | Collapses to `InventorySection` | Embed native now |

### Settings, RBAC, and Company Admin

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/settings` | Not embedded as global settings home | Embed native now |
| `/settings/appearance` | Embedded at `/dev/apex-ledger/settings/appearance` | Done |
| `/settings/sidebar`, `/settings/widgets`, `/settings/notifications` | Not covered | Embed native now |
| `/settings/communications` | Not covered | Embed native now; tenant-scoped messaging config is security-sensitive |
| `/settings/approval` | Not covered | Embed native now |
| `/settings/tax-codes` | Not covered | Embed native now |
| `/system/currencies` | Not covered | Embed native now |
| `/settings/rbac/*` | Not covered | Embed native now; permission management must not be duplicated |
| `/company-admin/*` | Not covered | Needs decision: either embed under Apex admin area or leave outside shell for first cutover |

### AI Assistant

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/ai-assistant` | Apex CFO/chat section uses real API | Apex-native OK for chat after permission QA |
| `/ai-assistant/proposals`, `/:proposalId` | Collapses to AI chat section | Embed native now |
| `/ai-assistant/usage` | Collapses to AI chat section | Embed native now |
| `/ai-assistant/settings` | Collapses to AI chat section | Embed native now |
| `/ai-assistant/setup` | Not covered | Embed native if setup remains user-accessible |

### Future Modules

| Tenant route family | Current Apex state | Recommendation |
| --- | --- | --- |
| `/hr/*` | Generic placeholder | Placeholder OK until HR becomes launch-critical |
| `/crm/*` | Generic placeholder | Placeholder OK |
| `/pos` | Generic placeholder | Embed `PosHomePage` if POS is visible in a tenant bundle |
| `/manufacturing/*` | Generic placeholder | Placeholder OK |
| `/projects/*` | Generic placeholder | Placeholder OK |

## Recommended Implementation Plan

### Slice 3A - route/page adapter foundation

Estimated: 1-2 hours.

Build a small Apex route translation layer, for example:

- `frontend/src/pages/dev/apex-ledger/routeMap.ts`
  - `tenantPathToApexPath(path: string): string`
  - `apexPathToTenantPath(path: string): string`
  - explicit aliases for route-name differences
  - dynamic path preservation for `:id`, `new`, and `:formCode`

Acceptance:

- Every visible Apex sidebar click has a known tenant route equivalent or an explicit Apex-native override.
- Aliases are documented in code, not hidden in string checks.

### Slice 3B - preserve permissions by adapting the real sidebar tree

Estimated: 2-3 hours.

Replace the static child lists in `APEX_MODULES` with an adapter over the real `useSidebarConfig()` output. Keep the Apex markup and styling. Only the data source changes.

Rules:

- Do not render legacy `Sidebar.tsx`.
- Do not reintroduce legacy spacing/hover styling.
- Do preserve item-level permissions, workflow hiding, dynamic form groups, and translated labels.
- Convert each tenant item path through `tenantPathToApexPath()`.

Acceptance:

- A user with restricted report/settings permissions does not see restricted child links in Apex.
- Operational workflow hidden items do not appear in Apex.
- Dynamic Sales/Purchase form links appear in the same group policy as the main sidebar.

### Slice 3C - mount native pages for operational route families

Estimated: 4-6 hours if done as one pass; should be split by module.

For cutover safety, embed existing native pages inside Apex for:

- Sales list/detail/settings/report/tool routes
- Purchases list/detail/settings/report/tool routes
- Inventory list/detail/settings/report/tool routes
- Global Settings/RBAC/Company Admin routes selected for cutover
- AI proposals/usage/settings

Keep Apex-native pages only where already built and verified:

- Apex dashboard home
- Apex accounting report pages after QA
- Apex chat if permission QA passes
- Apex overview/workbench pages as dashboards, not as replacements for posting/detail pages

Acceptance:

- `/dev/apex-ledger/sales/invoices/new` opens the real Sales Invoice detail page inside Apex.
- `/dev/apex-ledger/purchases/invoices/:id` opens the real Purchase Invoice detail page inside Apex.
- `/dev/apex-ledger/inventory/adjustments` opens the real Stock Adjustment page inside Apex.
- No operational page silently collapses to a generic module overview.

### Slice 3D - feature flag and cutover

Estimated: 2-4 hours after 3A-3C.

Implement a tenant/user feature flag for the shell:

- `classic`: current `AppShell`
- `apex`: Apex shell route container

Acceptance:

- Flag defaults to classic unless explicitly enabled.
- Apex remains hidden from static production navigation until flag is enabled.
- Switching the flag does not change data, posting, permissions, or tenant scope.

## QA Checklist Before Cutover

- EN and AR RTL desktop smoke test.
- EN and AR RTL mobile smoke test.
- Empty tenant test: no accounts, no customers, no invoices, no inventory.
- Restricted role test: no hidden report/settings child links in Apex.
- Workflow test: Sales/Purchase operational documents hidden when full workflow is disabled.
- Dynamic form test: default and cloned voucher/document links route inside Apex.
- Financial control smoke:
  - Sales Invoice new/edit/post path still uses native controls.
  - Purchase Invoice new/edit/post path still uses native controls.
  - Inventory Adjustment/Transfer paths still use native controls.
  - Customer/Vendor statement pages remain ledger-backed.
- Build checks:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`

## Final Recommendation

Do not replicate the main shell pages by copying files.

The recommended cutover path is:

1. Use Apex as the shell/chrome.
2. Adapt the real sidebar tree into Apex styling.
3. Mount native production pages for operational ERP workflows.
4. Keep Apex-native pages only for dashboards, reports, and views that are already contract-equivalent.
5. Cut over behind a feature flag after role, bundle, empty-data, and RTL QA pass.
