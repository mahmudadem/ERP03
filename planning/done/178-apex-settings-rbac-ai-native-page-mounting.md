# Completion Report 178 - Apex Settings/RBAC/AI Native Page Mounting

**Date:** 2026-06-06  
**Agent:** Codex  
**Task:** Task 167 Slice 3C-Settings/RBAC/AI native page mounting inside Apex  
**Estimated time:** 2-3 hours  
**Actual time:** about 0.8 hours

## Technical Developer View

### What Changed

- **`frontend/src/pages/dev/apex-ledger/components/NativeModuleRouteMount.tsx`**  
  Extended the shared Apex native-route mount so it supports route groups beyond Purchases and Inventory. It now handles:
  - `/settings/*` -> `/dev/apex-ledger/settings/*`
  - `/ai-assistant/*` -> `/dev/apex-ledger/ai/*`

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**  
  Routed general Settings/RBAC paths and AI paths through `NativeModuleRouteMount`. Company Settings footer paths remain handled by `NativeCompanySettingsRouteMount`, and `/dev/apex-ledger/settings/accounting` still mounts the dedicated Accounting Settings page.

- **Docs/planning**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.
  - Updated `planning/tasks/167-apex-shell-production-migration.md`.
  - Updated `planning/QA-QUEUE.md`, `planning/ACTIVE.md`, `planning/PRIORITIES.md`, and `planning/JOURNAL.md`.

### Why This Approach

Settings/RBAC and AI pages already contain the real frontend behavior: API calls, permission checks, global-role checks, module guards, settings forms, AI provider state, proposal flows, and route behavior. This slice keeps Apex as the shell while preserving those native production contracts.

This is route coverage work only. Apex-style visual redesign should happen page by page after route coverage and cutover QA are stable.

### Accounting / ERP Impact

No posting logic, ledger behavior, approvals, tax calculation, inventory valuation, AP/AR balances, or database schema changed.

The control impact is preservation: Settings/RBAC and AI pages continue to use their existing native route guards and permission rules inside Apex.

### Verification

- `git diff --check -- <touched files>` -> Passed, with existing CRLF normalization warnings only.
- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed. Build emitted existing dependency/chunk warnings only.
- `graphify update .` -> Not run successfully because `graphify` is not installed/available in this PowerShell environment.

## End-User View

Settings, role management, and AI pages can now be tested inside the Apex shell. When users open concrete Settings/RBAC or AI pages from Apex, the Apex sidebar and topbar should remain visible instead of the app jumping back to the old shell.

Examples:

- General Settings
- Appearance Settings
- Topbar Widgets
- Sidebar/Menu Config
- Approval Workflow
- Roles
- Assign Users
- AI Home
- AI Settings
- AI Usage
- AI Proposals
- AI Setup

## Acceptance Criteria

- Settings/RBAC concrete subroutes render inside Apex.
- AI concrete subroutes render inside Apex through `/dev/apex-ledger/ai/*`.
- Company Settings footer routes remain separate and still render inside Apex.
- Dedicated Accounting Settings detail route remains available.
- Native route guards are preserved.
- Internal native navigations are translated back into `/dev/apex-ledger/...`.
- QA steps are available for Mahmud.

## Known Follow-Ups

- Manual authenticated QA is still needed for Settings/RBAC and AI in English, Arabic RTL, restricted roles, disabled modules, global-role checks, and AI permission combinations.
- Apex feature flag and cutover QA remain pending.
- Apex-style page redesign should happen page by page after route coverage is complete.
