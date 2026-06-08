# Completion Report 179 - Apex Route Coverage Gap Audit

**Date:** 2026-06-06  
**Agent:** Codex  
**Task:** Audit Apex shell route coverage and fix missing native page mounts  
**Estimated time:** 0.5-1.0 hours  
**Actual time:** about 1.3 hours

## Technical Developer View

### What Was Found

The follow-up audit confirmed the user's concern: not every relevant tenant/native page was wired through Apex yet.

Previously mounted:

- Sales native routes
- Purchases native routes
- Inventory native routes
- Company Settings footer routes
- Settings/RBAC native routes
- AI native routes

Missing or weakly handled before this audit:

- Accounting setup
- Accounting recurring vouchers
- Accounting cost centers
- Accounting voucher detail/view/demo routes
- Accounting voucher designer
- Accounting budgets
- Accounting subgroup tagging
- Tools forms designer

A stricter second pass parsed the tenant route table from `frontend/src/router/routes.config.ts` and compared every Apex alias against the Apex dashboard routing logic. That found another 45 valid routes still falling to generic placeholders, including Companies, Notifications, HR, POS, Super Admin, Company Wizard, CRM, Manufacturing, Projects, and Canvas Dev route groups.

A final sidebar-link audit found the user's reported remaining failures were stale Apex sidebar URLs, not missing route mounts. The broken links pointed to paths that do not exist in `routes.config.ts`.

### What Changed

- **`frontend/src/pages/dev/apex-ledger/components/NativeModuleRouteMount.tsx`**
  - Added support for `accounting`.
  - Added support for `tools`.
  - Added support for a `remaining` native route group that mounts valid production routes that do not yet have dedicated Apex-native sections.
  - Allowed Accounting native routes to use multiple Apex aliases, including `/dev/apex-ledger/accounting/*`, `/dev/apex-ledger/vouchers/*`, `/dev/apex-ledger/coa`, and `/dev/apex-ledger/reports`.

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**
  - Routed missing Accounting utility/detail pages through `NativeModuleRouteMount`.
  - Routed voucher detail/view/demo URLs through the native Accounting route mount.
  - Routed accounting tool aliases through the native Accounting route mount.
  - Routed `/dev/apex-ledger/tools/*` through the native Tools route mount with the existing Apex tools section as fallback.
  - Routed remaining valid production route groups through the native route mount instead of the generic placeholder.

- **`frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx`**
  - Fixed stale Apex sidebar URLs:
    - `/dev/apex-ledger/sales/reports/analytics` -> `/dev/apex-ledger/sales/reports/sales-analytics`
    - `/dev/apex-ledger/sales/tools/forms` -> `/dev/apex-ledger/sales/tools/voucher-designer`
    - `/dev/apex-ledger/sales/reports/aged-backlog` -> `/dev/apex-ledger/sales/aged-backlog`
    - `/dev/apex-ledger/purchases/reports/analytics` -> `/dev/apex-ledger/purchases/reports/purchases-analytics`
    - `/dev/apex-ledger/purchases/tools/forms` -> `/dev/apex-ledger/purchases/tools/voucher-designer`
    - `/dev/apex-ledger/inventory/alerts` -> `/dev/apex-ledger/inventory/alerts/low-stock`
    - `/dev/apex-ledger/inventory/unsettled-costs` -> `/dev/apex-ledger/inventory/reports/unsettled-costs`
    - `/dev/apex-ledger/inventory/valuation` -> `/dev/apex-ledger/inventory/reports/valuation`
    - `/dev/apex-ledger/tools/budgets` -> `/dev/apex-ledger/accounting/tools/budgets`
    - `/dev/apex-ledger/tools/subgroup-tagging` -> `/dev/apex-ledger/accounting/tools/subgroup-tagging`

- **Docs**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.

### Scope Boundary

Apex now keeps Super Admin URLs inside the candidate shell for route continuity. Super Admin is still a platform-owner workflow with different global-role expectations, so it needs separate role/permission QA before Apex can be treated as the replacement shell for those workflows.

### Accounting / ERP Impact

No posting logic, ledger behavior, tax calculation, inventory valuation, approvals, period locks, AP/AR balances, or database schema changed.

The control impact is preservation: missing Accounting and Tools pages now render their native production route components inside Apex instead of falling back to generic Apex workbench sections.

The broader route mount also preserves existing native route guards for non-accounting pages. No permissions were loosened in this slice.

### Verification

- Strict route audit script -> `tenant routes 185`, `placeholders 0`.
- Apex sidebar link audit -> `sidebarPaths 79`, `missing 0`.
- `git diff --check -- <touched files>` -> Passed, with existing CRLF normalization warnings only.
- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed. Build emitted existing dependency/chunk warnings only.
- `graphify update .` -> Failed because `graphify` is not installed/available in this PowerShell environment.

## End-User View

More pages now stay inside the Apex shell instead of jumping back to the old shell or showing a generic placeholder.

Newly covered examples:

- Accounting Setup
- Recurring Vouchers
- Cost Centers
- Voucher Detail / View
- Voucher Designer
- Budgets
- Subgroup Tagging
- Forms Designer
- Companies
- Notifications
- Company Admin
- HR
- POS
- Super Admin
- Company Wizard
- CRM
- Manufacturing
- Projects
- Canvas Dev

## Known Follow-Ups

- Manual authenticated route QA is still needed.
- Apex feature flag and cutover QA remain pending.
- Super Admin route continuity is wired, but platform-role QA is still required before default-shell cutover.
