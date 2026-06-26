# Brief: Implement Policy Resolution Engine Foundation

**For:** cheaper backend execution agent  
**From:** Codex  
**Date:** 2026-06-24  
**Worktree:** `D:\DEV2026\ERP03-267-engine-audit`  
**Branch:** `codex/267-system-core-boundary-audit`  
**Controlling audit:** `planning/audits/267-system-core-boundary-inventory.md`

## Task

Implement only the **Policy Resolution Engine foundation**. This is a behavior-preserving backend slice. Do not touch posting, inventory movement/costing, frontend UI, or catalog/items.

## Read First

- `AGENTS.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/tasks/267-system-core-engine-management-execution-plan.md`
- `planning/audits/267-system-core-boundary-inventory.md`
- `docs/architecture/engines-vs-modules.md`
- `docs/architecture/system-core.md`
- `backend/src/application/system-core/PolicyEngine.ts`
- `backend/src/application/system-core/contracts/IPolicyEngine.ts`
- `backend/src/domain/pos/entities/POSPolicy.ts`
- `backend/src/domain/system-core/entities/SellingPolicy.ts`
- `backend/src/application/system-core/approval/ApprovalEngine.ts`

## Allowed Scope

You may edit/add:

- `backend/src/domain/system-core/entities/PolicyConfig.ts`
- `backend/src/application/system-core/contracts/IPolicyEngine.ts`
- `backend/src/application/system-core/PolicyEngine.ts`
- `backend/src/application/system-core/policy/*`
- `backend/src/repository/interfaces/system-core/IPolicyConfigRepository.ts`
- Firestore policy-config repository only if needed for the foundation
- DI registration only if repository is added
- `backend/src/tests/application/system-core/*Policy*.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` only for export/non-failing guards
- `docs/architecture/policy-engine.md`
- planning completion docs

## Forbidden Scope

Do not edit:

- Sales/Purchases/Inventory posting use-cases
- `SubledgerVoucherPostingService`
- `PostingGateway`
- inventory stock movement/costing use-cases
- frontend settings pages
- item/catalog routes
- existing persistence removal for `POSPolicy` or `SellingPolicy`

## Required Design

Keep old compatibility:

```ts
resolve(request: PolicyResolveRequest): Promise<PolicyResolveResult>
```

Extend result shape without breaking old callers:

```ts
{
  allowed: boolean;
  requiresApproval: boolean;
  resolvedBy: string[];
  decision?: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';
  reasonCode?: string;
  effectiveRuleId?: string;
  approvalSubject?: ApprovalSubject;
}
```

Add typed policy config/resolution support for:

- company/tenant default rule;
- module override rule;
- role/user/register/context override where supplied;
- hard rule that cannot be overridden;
- approval handoff metadata.

Do not change current behavior for existing callers.

## Required Tests

Add tests proving:

- tenant default blocks an action;
- module override requires approval;
- hard rule blocks even when module override allows;
- POS terminal direct sale can allow without approval;
- Sales invoice posting requires approval over threshold;
- Purchase invoice posting requires approval over threshold;
- result includes `decision`, `reasonCode`, `resolvedBy`, and effective rule metadata.

Existing tests must still pass:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/system-core
npm --prefix backend test -- --runInBand src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
npm --prefix backend run build
```

## Reviewer Blockers

Your work must be rejected if:

- any posting output changes;
- any source module gains new shared policy logic outside System Core;
- existing POS/SellingPolicy behavior changes;
- unknown old `scope/action` behavior changes from default allow;
- tests or boundary guards are weakened;
- docs are missing.

