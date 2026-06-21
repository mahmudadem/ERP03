# 250d2 — Phase 1: POS return posting entry point (independent of Sales use-cases)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 1 · **Blocking:** 🔴 POS-blocking (completes POS independence)
**Depends on:** [250d](./250d-pos-posting-entry-point.md) · **Agent:** erp-backend-builder · **Estimate:** 2–3 days
**Status:** ⬜ Not started

> **Why this exists:** Created by CTO ruling on 2026-06-21. The folder-wide POS→Sales import ban could not be enabled in 250d because POS **returns** still import Sales. 250d decoupled the sale path; this task decouples the return path and then flips the **folder-wide** ban on. It is the mirror of 250d for returns.

## Objective

Make POS returns **post on their own path** — via `IAccountingBridge` (reversal) + `IInventoryCore` (restock) — instead of constructing `CreateSalesReturnUseCase` + `PostSalesReturnUseCase`. After this, **no file under `application/pos/` imports Sales**, and POS-on / Sales-off works for returns as well as sales.

## Current state (proven)

- `CompletePosReturnUseCase` directly imports `CreateSalesReturnUseCase`, `PostSalesReturnUseCase` and the `SalesReturn` domain entity ([CompletePosReturnUseCase.ts:13-16, 63-64](../../backend/src/application/pos/use-cases/CompletePosReturnUseCase.ts:13)). The doc comment describes it calling the Sales layer to "reverse revenue/tax, restock inventory" with `AFTER_INVOICE` context.
- 250d already built `IAccountingBridge` + the POS sale posting path; this task reuses that bridge for the reversal.

## Target

A POS return flow that, for a `POS_DIRECT_SALE` return:
1. restocks inventory (stock-IN) via `IInventoryCore`;
2. records the **reversing** financial event (reverse revenue/tax, COGS back-out, refund settlement) via `IAccountingBridge.recordFinancialEvent(...)` (default = current full reversal posting);
3. carries the POS persona and resolves authorization via `IPolicyEngine`.

POS must construct **no Sales return use-case**. The bridge may emit the same reversal voucher set for V1 (temporary adapter) — the constraint is the dependency direction, not the ledger output.

## Scope — files

**Create:**
- `backend/src/application/pos/use-cases/PostPosReturnUseCase.ts` (or fold into `CompletePosReturnUseCase`) — POS-owned reversal orchestration over `IInventoryCore` + `IAccountingBridge`.

**Edit:**
- `backend/src/application/pos/use-cases/CompletePosReturnUseCase.ts` — remove `CreateSalesReturnUseCase`/`PostSalesReturnUseCase`/`SalesReturn` imports + constructor deps; post via the new path.
- `backend/src/infrastructure/di/bindRepositories.ts` — rewire POS returns off the Sales use-cases.
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` — **enable the folder-wide** `application/pos/` → `application/sales/` + `domain/sales/` import ban (remove the TODO skip from 250a/250d). It must now be green.

## Out of scope

- Tax/return math still flows behind `ITaxEngine` adapter (extraction is [250h](./250h-tax-engine.md)).
- Refund cash-rounding nuances → [250f](./250f-money-core.md).

## Implementation steps

1. Build `PostPosReturnUseCase` assembling restock + reversing financial event from the original receipt/return lines + persona; call inventory core + bridge in one transaction.
2. Strip Sales-return deps from `CompletePosReturnUseCase`; route through the new use-case.
3. Enable the folder-wide POS→Sales import ban; fix any remaining illegal imports.
4. Tests (below).

## Tests

- **Return posting independence:** POS return calls `IInventoryCore` + `IAccountingBridge`; constructs **no** `CreateSalesReturnUseCase`/`PostSalesReturnUseCase` (DI/spies + the now-enabled folder-wide architecture test).
- **POS return without Sales App:** with Sales disabled/unconfigured, a POS return completes and posts its reversal; persona on the ledger.
- Regression: reversal ledger output equivalent to the pre-refactor `AFTER_INVOICE` sales-return voucher set (golden compare).
- The **folder-wide** `SystemCoreBoundaries` ban is enabled and green.

## Acceptance criteria

- [ ] `CompletePosReturnUseCase` has no Sales use-case/entity dependency.
- [ ] Folder-wide `application/pos/` → Sales import ban is enabled and green (no skips).
- [ ] Return independence + no-Sales + golden-reversal tests pass.
- [ ] typecheck + build clean; suite green.

## Definition of Done

- [ ] Commit: `feat(system-core): POS returns post via accounting bridge, not Sales use-cases [250d2]`
- [ ] `planning/done/250d2-pos-return-posting-entry-point.md` report.
- [ ] Update `docs/architecture/pos-independence.md` to cover returns (POS-on/Sales-off guarantee now complete).

## CTO audit gate

Reject unless: no Sales return use-case/entity is referenced anywhere under `application/pos/`, the folder-wide architecture ban is ON with zero skips, a POS return posts with Sales disabled, and the reversal ledger matches the golden baseline.
