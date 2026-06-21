# 250e — Phase 1: Subject-agnostic Approval Engine (accounting FA/CC becomes a plug-in)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 1 · **Blocking:** 🔴 POS-blocking **seam**
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 3–4 days
**Status:** ⬜ Not started

## Objective

Turn approval from an **accounting-voucher-only** mechanism into a **shared, subject-agnostic engine**, so future POS/Sales/Purchases approvable actions (manager override, price/discount/tax override, below-cost sale) have somewhere to register — instead of being hardcoded into accounting voucher types.

> **Scope discipline:** Phase 1 builds the **seam + registry**, re-homes the existing voucher approval behind it with **no behavior change**, and proves a non-voucher subject can be evaluated. It does **not** build every override flow (those arrive with Commercial Core / POS V1 features).

## Current state (proven)

- Approval is real but accounting-shaped: `ApprovalPolicyService` (FA/CC "Smart CC" gates on accounts/custodians) ([ApprovalPolicyService.ts:75-220](../../backend/src/domain/accounting/policies/ApprovalPolicyService.ts:75)); `ApproveVoucherUseCase` explicitly states "**No workflow engine. No conditional logic. No approval chains.**" ([VoucherApprovalUseCases.ts:13](../../backend/src/application/accounting/use-cases/VoucherApprovalUseCases.ts:13)).
- Posting is gated by `ApprovalRequiredPolicy` (`status === APPROVED`) run inside `PostingGateway`, fed by the caller's **real** approval state ([PostingGateway.ts:170-186](../../backend/src/application/accounting/services/PostingGateway.ts:170)).
- SI/PI re-implement `PENDING_APPROVAL` locally ([SalesInvoiceUseCases.ts:1695-1700, 2199-2230](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:1695)); the trigger is `AccountingPolicyRegistry.isApprovalRequiredForVoucherType` ([:87](../../backend/src/application/accounting/policies/AccountingPolicyRegistry.ts:87)).
- **No non-voucher subject can be approved** ([audit §E](../../docs/audit/platform-architecture-engine-vs-app-audit.md)).

## Target contract

```
interface ApprovalSubject { type: ApprovalSubjectType; id: string; payload: unknown; }
type ApprovalSubjectType =
  | 'accounting_voucher' | 'sales_invoice' | 'purchase_invoice' | 'purchase_order'
  | 'inventory_adjustment' | 'pos_manager_override'
  | 'price_override' | 'discount_override' | 'tax_override' | 'below_cost_sale';

interface IApprovalEngine {
  evaluate(subject, context): Promise<{ decision: 'APPROVED'|'REJECTED'|'PENDING'; requiredApprovers: string[]; gates: GateResult[] }>;
}
```

- The engine **decides**; the **module decides what action is blocked** until resolution.
- The current FA/CC logic becomes **one registered policy plug-in** ("ledger custody/financial approval") keyed to `accounting_voucher` — not the whole engine.
- Accounting still **posts only after** the relevant approval resolves when policy requires it — same `ApprovalRequiredPolicy` gate, now fed by the engine's decision.

## Scope — files

**Create:**
- `backend/src/application/system-core/approval/ApprovalEngine.ts` (implements `IApprovalEngine`; subject registry + plug-in policies).
- `backend/src/application/system-core/approval/plugins/LedgerCustodyApprovalPlugin.ts` — wraps existing `ApprovalPolicyService` for `accounting_voucher`.
- `backend/src/application/system-core/approval/ApprovalSubjectRegistry.ts`.

**Edit (re-home, no behavior change):**
- `SubmitVoucherUseCase` + `AccountingPolicyRegistry.isApprovalRequiredForVoucherType` — call the engine for `accounting_voucher` rather than the service directly (adapter from 250a).
- Leave SI/PI `PENDING_APPROVAL` mechanics in place for now (a later phase can unify them) — but route their "is approval required?" question through `IApprovalEngine`.

## Out of scope

- Building the actual price/discount/tax/below-cost override capture + UI (Commercial Core [250l] + POS V1 features).
- Unifying the two status vocabularies (voucher vs document) — later cleanup.

## Tests

- **T6 — generic approval subject:** the engine evaluates a non-voucher subject (e.g. `price_override` or `below_cost_sale`) and returns `APPROVED|REJECTED|PENDING`; a stub module blocks the action until resolved.
- **T10 — approval gates posting:** posting is rejected unless the relevant subject is `APPROVED`, driven by the engine (today's `ApprovalRequiredPolicy` behavior, now engine-fed). Preserve existing voucher-approval tests green (no behavior change for vouchers).

## Acceptance criteria

- [ ] `IApprovalEngine` + subject registry exist; FA/CC is a plug-in for `accounting_voucher`.
- [ ] Existing voucher approval behavior unchanged (all current approval tests green).
- [ ] T6 + T10 pass.
- [ ] typecheck + build clean.

## Definition of Done

- [ ] Commit: `feat(system-core): subject-agnostic approval engine; FA/CC as plugin [250e]`
- [ ] `planning/done/250e-approval-engine.md` report.

## CTO audit gate

Reject if the engine is still voucher-only, if FA/CC logic was duplicated rather than wrapped, or if any existing approval behavior changed (this phase is a seam, not a redesign).
