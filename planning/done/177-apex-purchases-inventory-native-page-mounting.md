# Completion Report 177 - Apex Purchases And Inventory Native Page Mounting

**Date:** 2026-06-05  
**Agent:** Codex  
**Task:** Task 167 Slice 3C-Purchases/Inventory native page mounting inside Apex  
**Estimated time:** 4-6 hours total for both modules  
**Actual time:** about 0.9 hours for shared mount and dashboard wiring

## Technical Developer View

### What Changed

- **`frontend/src/pages/dev/apex-ledger/components/NativeModuleRouteMount.tsx`**  
  Added a shared Apex native-route mount for module paths that should reuse production native pages. It filters `routesConfig` by module path, renders each native page through the same `ProtectedRoute`, `WorkflowModeGuard`, and `ModuleConfigurationGuard` stack used by the main router, and redirects native hash navigations back into the Apex namespace.

- **`frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx`**  
  Mounted Purchases and Inventory through `NativeModuleRouteMount`. The module roots still render Apex workbench sections, while concrete subroutes render native production pages inside Apex.

- **Docs/planning**
  - Updated `docs/architecture/apex-shell-candidate.md`.
  - Updated `docs/user-guide/navigation/apex-shell-candidate.md`.
  - Updated `planning/tasks/167-apex-shell-production-migration.md`.
  - Updated `planning/QA-QUEUE.md`, `planning/ACTIVE.md`, `planning/PRIORITIES.md`, and `planning/JOURNAL.md`.

### Why This Approach

Purchases and Inventory native pages already contain the real ERP frontend behavior: API calls, permissions, workflow guards, posting/stock controls, report containers, settings forms, and route flows. Copying those pages into Apex or replacing them with simplified workbench cards would risk losing financial and operational controls.

This slice keeps Apex as the visual shell while preserving the native production page behavior. It creates the bridge needed before page-by-page Apex-style view redesign work.

### Accounting / ERP Impact

No posting logic, ledger write behavior, tax calculation, inventory valuation, AP/AR balances, approval policy, period lock behavior, or database schema changed.

The important accounting/control outcome is preservation: Purchases and Inventory pages continue to use the existing route guards, module guards, workflow guards, and native page logic inside the Apex shell.

### Verification

- `git diff --check -- <touched files>` -> Passed, with existing CRLF normalization warnings only.
- `npm --prefix frontend run typecheck` -> Passed.
- `npm --prefix frontend run build` -> Passed. Build emitted existing dependency/chunk warnings only.
- `graphify update .` -> Not run successfully because `graphify` is not installed/available in this PowerShell environment.

## End-User View

Purchases and Inventory links can now be tested inside the Apex shell. When users open concrete Purchases or Inventory pages from Apex, the Apex sidebar and topbar should remain visible instead of the app jumping back to the old shell.

Examples:

- Purchase Invoices
- New Purchase Invoice
- Purchase Orders
- Goods Receipts
- Purchase Returns
- Vendors
- Vendor Statement
- Inventory Items
- Warehouses
- Stock Levels
- Stock Transfers
- Opening Stock
- Inventory Settings

## Acceptance Criteria

- Purchases concrete subroutes render inside Apex.
- Inventory concrete subroutes render inside Apex.
- Apex Purchases and Inventory root workbenches remain available.
- Native route guards are preserved.
- Internal native navigations are translated back into `/dev/apex-ledger/...`.
- QA steps are available for Mahmud.

## Known Follow-Ups

- Manual authenticated QA is still needed for Purchases and Inventory in English, Arabic RTL, workflow modes, restricted roles, and empty tenant data.
- Settings/RBAC and AI native page mounting remain pending.
- Apex-style page redesign should happen page by page after route coverage is complete.
