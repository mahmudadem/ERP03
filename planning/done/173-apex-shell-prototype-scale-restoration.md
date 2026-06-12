# Completion Report 173 - Apex Shell Prototype Scale Restoration

**Date:** 2026-06-05  
**Agent:** Codex  
**Task:** Task 167 visual hotfix - Apex prototype shell scale restoration  
**Estimated time:** 0.5-1.0 hours  
**Actual time:** about 0.6 hours

## Technical Developer View

### What Changed

- **`D:\DEV2026\apex-ledger-erp.zip`**  
  Inspected the downloaded Apex prototype source and used its shell sizing as the reference for this visual fix.

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**  
  Made the Apex route root viewport-bound with `h-screen min-h-screen flex overflow-hidden`, increased the search/header rhythm, and restored the main workspace to `p-6` with an inner `max-w-7xl` content surface.

- **`frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx`**  
  Restored the prototype-like sidebar scale: `w-64`, full viewport height, fixed header/footer inside the sidebar, scrolling menu body, larger logo/user controls, larger top-level rows, and larger icon/label spacing.

- **Docs/planning**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.
  - Updated `planning/tasks/167-apex-shell-production-migration.md`.
  - Updated `planning/QA-QUEUE.md`, `planning/ACTIVE.md`, and `planning/JOURNAL.md`.

### Architecture Decision

The fix changes only the Apex candidate shell chrome. It does not reintroduce legacy shell styling, duplicate route contracts, or alter the native page mounting strategy.

The Apex shell should keep using:

- Apex-owned sidebar/header DOM for candidate chrome.
- The real `useSidebarConfig()` tree for module, RBAC, workflow, and dynamic form visibility.
- Existing native production pages for financially sensitive operational routes until an Apex-native replacement is contract-equivalent.

### Accounting / ERP Impact

No accounting, posting, ledger, approval, period-lock, tax, AR/AP, inventory costing, reporting, permission, or database schema behavior changed.

The benefit is visual and operational: the candidate shell now better matches the prototype Mahmud approved, while preserving the real ERP navigation and page contracts already wired in earlier Task 167 slices.

### Verification

- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed.

## End-User View

When opening the Apex candidate at `/#/dev/apex-ledger`, the sidebar should now cover the full browser height. The logo/header area stays at the top, the user/profile area stays at the bottom, and the long menu scrolls in the middle.

The whole Apex workspace should feel larger, closer to the downloaded prototype, without needing browser zoom. It should feel similar to the old smaller view at about 110% zoom, but as a native shell scale.

## Acceptance Criteria Met

- Apex sidebar spans the full browser viewport height.
- Apex sidebar width restored from the smaller candidate width to the prototype `w-64` scale.
- Sidebar header, menu rows, icons, submenu rows, and footer are larger and closer to the prototype.
- Apex main workspace uses larger `p-6` spacing.
- Route, RBAC, permissions, native Sales mounting, and data contracts were not changed.
- Frontend typecheck passed.
- Frontend production build passed.

## Known Follow-Ups

- Mahmud should compare the restored Apex shell against the downloaded prototype in an authenticated browser session.
- Manual Arabic RTL visual QA is still required.
- Continue Task 167 Slice 3C for Purchases, Inventory, Settings/RBAC, and AI native page mounting.
