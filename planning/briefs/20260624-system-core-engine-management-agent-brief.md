# Brief: System Core Engine Management and Boundary Remediation

**For:** Codex / OpenCode / cheaper executor agents  
**From:** Codex  
**Date:** 2026-06-24  
**Primary plan:** `planning/tasks/267-system-core-engine-management-execution-plan.md`

## Context

The owner wants ERP03 modules to remain independent while all reusable logic lives in shared engines. The specific concern is policy resolution: company default policies should be reusable, modules may override where allowed, and POS/Sales/Purchases may require different approval behavior for financially meaningful actions.

ERP03 already has System Core contracts and several extracted engines, but the implementation is uneven:

- POS is relatively clean and uses System Core for tax, numbering, accounting bridge, inventory core, and selling policy.
- Sales/Purchases/Inventory still have direct legacy posting paths.
- Purchases still constructs stock movements/levels in places.
- Policy Engine exists but is not yet a full generic tenant-default/module-override resolver.
- Shared setting doorways are fixed for SellingPolicy but not audited globally.

## Task

Start with **Slice 267-A only** from `planning/tasks/267-system-core-engine-management-execution-plan.md`.

Create a read-only inventory of current engine boundaries and violations. Do not implement fixes.

## Required Output

Create:

```text
planning/audits/267-system-core-boundary-inventory.md
```

It must contain:

```text
Concern | Current owner | Expected engine | State extracted/hybrid/wrapper/missing | Module consumers | Doorways present | Violations | Recommended slice
```

Every violation needs file/line evidence.

## Commands

```powershell
git status --short --branch
rg "SubledgerVoucherPostingService|PostingGateway|postInTransaction\(" backend/src/application backend/src/api -n
rg "new StockMovement|new StockLevel|StockLevel\.createNew|StockLevel\.fromJSON" backend/src/application backend/src/api -n
rg "function calculateDiscountAmount|const calculateDiscountAmount|calculateDiscountAmount\(" backend/src/application -n
rg "moduleInitializedGuard" backend/src/api/routes -n
rg "IPolicyEngine|PolicyEngine|IApprovalEngine|ApprovalEngine|SellingPolicy|POSPolicy|CashierRolePolicy" backend/src -n
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
```

## Hard Blocks

Stop and report if:

- you need to change behavior to complete the audit;
- baseline architecture tests fail;
- you find unrelated dirty files that your output would overwrite;
- a proposed implementation would change voucher output, tax, COGS, stock valuation, AP/AR, settlement, or period-lock behavior without golden tests.

## Definition of Done

- Audit file created.
- No source code changed.
- Dirty worktree status reported.
- Architecture boundary test result reported.
- Recommended implementation slices are listed in dependency order.

