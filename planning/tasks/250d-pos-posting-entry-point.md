# 250d — Phase 1: POS posting entry point (independent of Sales use-cases)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 1 · **Blocking:** 🔴 POS-blocking
**Depends on:** [250b](./250b-document-core-persona.md), [250c](./250c-policy-engine-pos-decoupling.md) · **Agent:** erp-backend-builder · **Estimate:** 2–4 days
**Status:** ⬜ Not started

## Objective

Make POS **post on its own path** — through the Accounting/Financial Core (via `IAccountingBridge`) and `IInventoryCore` — instead of constructing `CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase`. After this, **POS does not depend on the Sales App**, and a tenant with POS-on / Sales-off can complete and post a sale.

## Current state (proven)

- `CompletePosSaleUseCase` is constructed with `CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase` ([CompletePosSaleUseCase.ts:94-96](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:94)) and builds a `CreateSalesInvoiceInput` from the cart.
- The Accounting engine is already shared and always-on: `PostingGateway` is the single ledger door ([PostingGateway.ts:60](../../backend/src/application/accounting/services/PostingGateway.ts:60)); Inventory posts via the `ISalesInventoryService` contract.
- There is **no `IAccountingBridge`** and no POS-owned posting use-case ([audit §G](../../docs/audit/platform-architecture-engine-vs-app-audit.md)).

## Target

A POS posting flow that, for a `POS_DIRECT_SALE`:
1. validates stock + posts stock-OUT/COGS via `IInventoryCore` (services/non-stock skip inventory);
2. records the financial event (revenue/tax/COGS/settlement) via `IAccountingBridge.recordFinancialEvent(...)` whose **default implementation is the current full voucher posting** through `PostingGateway`;
3. carries persona `POS_DIRECT_SALE` (from 250b) and resolves authorization via `IPolicyEngine` (from 250c).

POS must construct **no Sales use-case**. For V1 the bridge may still emit the same voucher set (temporary adapter, [master plan §4](../../docs/architecture/system-core-shared-engines-master-plan.md)) — the constraint is the **dependency direction**, not the ledger output.

## Scope — files

**Create:**
- `backend/src/application/system-core/AccountingBridge.ts` — implements `IAccountingBridge` (default = full posting via `PostingGateway` / `SubledgerVoucherPostingService`).
- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts` (or fold into `CompletePosSaleUseCase`) — POS-owned posting orchestration over `IInventoryCore` + `IAccountingBridge`.

**Edit:**
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts` — remove `CreateSalesInvoiceUseCase`/`PostSalesInvoiceUseCase` constructor deps and call sites; post via the new path.
- `backend/src/infrastructure/di/bindRepositories.ts` — wire POS posting to the bridge + inventory core, drop the Sales use-case wiring for POS.
- Enable the **POS→Sales import ban** in `SystemCoreBoundaries.test.ts` (from 250a) — it should now pass.

## Out of scope

- Tax math still flows through the current calc behind `ITaxEngine` adapter (Tax Engine extraction is [250h](./250h-tax-engine.md)). POS V1 keeps delegating tax — just not via a Sales *use-case*.
- Minimal-journal (accounting-off) mode → [250k](./250k-accounting-bridge.md). V1 default bridge = full posting.

## Implementation steps

1. Build `AccountingBridge` wrapping the existing posting services; expose `recordFinancialEvent(event)`.
2. Build `PostPosSaleUseCase` that assembles the financial event + inventory movements from the cart and persona, then calls inventory core + bridge inside one transaction (mirror the atomicity the Sales path has).
3. Strip Sales use-case deps from `CompletePosSaleUseCase`; route through the new use-case.
4. Flip on the POS→Sales import-ban architecture test; fix any remaining illegal imports.
5. Tests T2 + T5.

## Tests

- **T5 — posting independence:** POS posting calls `IInventoryCore` + `IAccountingBridge`; **constructs no** `CreateSalesInvoiceUseCase`/`PostSalesInvoiceUseCase` (assert via DI wiring/spies + the architecture import test).
- **T2 — POS without Sales App:** with the Sales App disabled/unconfigured, POS enables, completes, and posts a sale; persona `POS_DIRECT_SALE` is on the ledger. *(Builds on 250b/250c.)*
- Regression: ledger output for a POS sale is equivalent to the pre-refactor voucher set (golden compare) — proves the bridge default preserves behavior.

## Acceptance criteria

- [ ] `CompletePosSaleUseCase` has no Sales use-case dependency.
- [ ] `SystemCoreBoundaries.test.ts` POS→Sales ban is enabled and green.
- [ ] T2, T5, and the golden-ledger regression pass.
- [ ] typecheck + build clean; suite green.

## Definition of Done

- [ ] Commit: `feat(system-core): POS posts via accounting bridge, not Sales use-cases [250d]`
- [ ] `planning/done/250d-pos-posting-entry-point.md` report.
- [ ] `docs/architecture/pos-independence.md` drafted (persona + policy + posting + POS-on/Sales-off guarantee).

## CTO audit gate

This is the keystone POS-blocking task. Reject unless: (a) no Sales use-case is constructed on the POS path, (b) the architecture import-ban test is ON and green, (c) T2 demonstrably posts with Sales disabled, (d) ledger output matches the golden baseline.
