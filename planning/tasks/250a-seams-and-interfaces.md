# 250a — Phase 0: Interface Seams + Adapters (no behavior change)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 0 · **Blocking:** enables all later phases
**Agent:** erp-backend-builder (one builder) · **Estimate:** 1–2 days
**Status:** ✅ Complete — CTO-audited green (2026-06-21)

## Objective

Introduce the System Core **interfaces** and thin **adapters** over today's code, so application modules can begin depending on contracts instead of internals — **with zero behavior change**. This is pure plumbing: every adapter delegates to the existing implementation.

## Why first

Later phases swap implementations behind these interfaces. If consumers depend on interfaces from day one, each later extraction is a localized adapter swap, not a cross-module rewrite ([master plan §4](../../docs/architecture/system-core-shared-engines-master-plan.md)).

## Target — create the namespace and contracts

Create `backend/src/application/system-core/contracts/` with these interfaces (signatures are the minimum from [audit §J/master plan §F](../../docs/audit/platform-architecture-engine-vs-app-audit.md)):

| Interface | Minimum methods | V1 adapter delegates to |
|---|---|---|
| `IDocumentCore` | `createIdentity(docType, persona)`, `transition(identity, state)`, `assertEditable(identity)` | `DocumentPolicyResolver` + `PostedDocumentEditGuard` |
| `INumberingEngine` | `next({ companyId, docType, scope, branchId?, terminalId? })` | existing voucher-sequence + per-module numbering + `PosSettings` receipt seq |
| `IMoneyCore` | `round(value, currency)`, `roundCash(value, currency, rule)`, `toBase(value, ccy, rate)` | a single new precision-aware helper wrapping `CurrencyPrecisionHelpers` |
| `ITaxEngine` | `calcLine(input)`, `calcCharge(input)`, `allocateInvoiceDiscount(lines, discount)`, `recoverable(taxCode)` | `SalesInvoiceCalculationService` (allocate/recoverable may throw `NotImplemented` in Phase 0) |
| `ICommercialCore` | `resolvePrice(ctx)`, `calcDiscount(ctx)` (promotions/cost-margin deferred) | Sales price-list use-cases + `SalesInvoiceCalculationService` discount math |
| `IPolicyEngine` | `resolve(scope, action, context) → { allowed, requiresApproval, resolvedBy }` | `DocumentPolicyResolver` (persona) + `AccountingPolicyRegistry` (posting) behind one facade |
| `IApprovalEngine` | `evaluate(subject, context) → { decision, requiredApprovers, gates }` | `ApprovalPolicyService` + `AccountingPolicyRegistry.isApprovalRequiredForVoucherType` |
| `IAccountingBridge` | `recordFinancialEvent(event)` | full posting via `PostingGateway` (current path) |
| `IAuditEngine` | `record({ entity, action, before, after, actor, reason, approval })` | `RecordChangeService` |
| `IInventoryCore` | re-export of `ISalesInventoryService` (alias only in Phase 0) | `ISalesInventoryService` |

## Scope — files

**Create (~11 contract files + adapters):**
- `backend/src/application/system-core/contracts/I{Document,Numbering,Money,Tax,Commercial,Policy,Approval,Audit}*.ts`
- `backend/src/application/system-core/contracts/IAccountingBridge.ts`
- `backend/src/application/system-core/contracts/IInventoryCore.ts` (alias `export type IInventoryCore = ISalesInventoryService`)
- `backend/src/application/system-core/adapters/*Adapter.ts` (one per interface, delegating)
- `backend/src/application/system-core/money/roundMoney.ts` — the single precision-aware helper (not yet adopted; defined here for Phase 2).

**Edit (DI only):**
- `backend/src/infrastructure/di/bindRepositories.ts` — register adapters (do NOT rewire consumers yet; that happens per later phase).

**Do NOT edit any consumer** in Phase 0. No module call sites change.

## Architecture test (the guardrail for the whole epic)

Add `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` that **fails** if:
1. Any file under `application/pos/` imports from `application/sales/` or `domain/sales/` (catches the current POS→Sales coupling — expected to be RED until Phase 1; mark `.todo`/skipped with a comment until 250d lands, then enable).
2. Any module imports another module's calculation service directly once that engine has an interface (extend the allow-list as phases land).

Model it on the existing [PostingAuthority.test.ts](../../backend/src/tests/architecture/PostingAuthority.test.ts) (static import-graph assertion).

## Acceptance criteria

- [x] All interfaces compile and are exported from a barrel `application/system-core/index.ts`.
- [x] Each adapter delegates to the current implementation and is registered in DI.
- [x] `npm --prefix backend run typecheck` + `run build` clean.
- [x] Full backend suite green after baseline capture. Counts increased only by the new architecture guard: +1 passed, +1 skipped.
- [x] `SystemCoreBoundaries.test.ts` exists (POS→Sales rule skipped with a TODO referencing 250d).

## Definition of Done

- [x] Code committed on branch: `feat(system-core): phase 0 interface seams + adapters [250a]`
- [x] `planning/done/250a-seams-and-interfaces.md` completion report (files created, baseline test counts).
- [x] No consumer behavior changed; no consumers rewired. Test-count delta is only the new architecture guard.

## CTO audit gate

I verify: interfaces match the table; adapters are pure delegation (no logic moved yet); zero consumer diffs; test counts identical. Reject if any adapter contains real logic (that belongs in later phases).
