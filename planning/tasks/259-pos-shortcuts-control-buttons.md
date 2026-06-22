# Task 259 — POS Shortcuts And Control Buttons

**Date:** 2026-06-23  
**Branch:** `codex/pos-shortcuts-control-buttons`  
**Estimate:** 4-6 hours  
**Actual:** ~4.2 hours

## Goal

Implement POS terminal configurable product shortcuts and control buttons across backend models, validation, runtime resolver, command registry, terminal integration, admin UI, print receipt integration, docs, and verification.

## Scope

### Slice A — Backend Layout Models, Validation, Resolver, Runtime API

- Add product shortcut layout/node entities.
- Add control button layout/button entities.
- Add repository contract and Firestore repository.
- Add runtime layout resolver with scope priority.
- Add admin and runtime API endpoints.

### Slice B — Control Button Registry And Safe Command Skeleton

- Add fixed command registry.
- Add command execution use case.
- Reject unknown command codes.
- Enforce command permissions and active register/shift/cart prerequisites.

### Slice C — POS Terminal Runtime Integration

- Load runtime product shortcut tree and control buttons.
- Render product shortcut groups/items.
- Execute configured control buttons through backend command validation.

### Slice D — Admin/Settings UI

- Add POS Settings `Layouts` tab.
- Add basic product shortcut layout/node management.
- Add basic control button layout/button management.

### Slice E — Print Engine Receipt/Reprint Integration

- Return POS receipt print templates from receipt fetch and print endpoints.
- Keep reprint policy/audit behavior intact.
- Use saved `POS_RECEIPT` print layout when available; otherwise generated default.

### Slice F — Docs And Verification

- Add architecture and user guide docs.
- Add focused backend tests.
- Run backend/frontend typechecks and builds.

## Accounting And Control Notes

This task is terminal configuration and print payload preparation. It must not alter tax, COGS, inventory valuation, settlement routing, posting bridge behavior, approval engine semantics, or period locks.

Reprint remains a controlled action. The command registry is allowlist-only and does not execute arbitrary scripts.

## Acceptance Criteria

- Product shortcuts resolve by user/register/branch/company priority.
- Inactive layouts/nodes/buttons do not appear at runtime.
- Shortcut tree validation prevents invalid parent structures.
- Control buttons can only execute registered command codes.
- Sensitive commands enforce backend permission checks.
- Terminal can add item shortcuts to cart and run control commands.
- POS settings can create basic layouts, nodes, and buttons.
- Receipt print/reprint responses include a print layout payload.
- Architecture/user docs and completion report exist.
- Focused tests and typechecks/builds are green.
