# Done — Task 257: POS manager overrides via the Approval Engine

**Date:** 2026-06-22
**Branch:** `feat/pos-readiness-and-negative-stock`
**Scope:** Control hardening — turn the POS manager-override gate from a trust-the-token check
into a real approval workflow.

## Summary

Previously POS only checked that a manager-approval *token* was present (`approvedOverrideId`),
trusting the screen. It never verified a real, authorised manager approved, never rejected
self-approval, and could not hold a decision PENDING. Now `CreatePosManagerOverrideUseCase`
routes each sensitive action through `IApprovalEngine.evaluate(...)`, and the token is **only
minted on an APPROVED decision**.

- **Policy Engine** still decides *whether* an action needs approval (`CashierRolePolicy`).
- **Approval Engine** (new `PosManagerOverrideApprovalPlugin`) decides *who* may approve and the
  outcome:
  - no approver → **PENDING**,
  - approver === acting cashier → **REJECTED** (no self-approval),
  - approver lacks `pos.override.approve` authority → **REJECTED** (checked server-side via the
    RBAC permission resolver),
  - distinct authorised manager → **APPROVED**.

`below_cost_sale` is unchanged (no plugin; keeps the generic fallback).

## Files changed

- `application/system-core/approval/plugins/PosManagerOverrideApprovalPlugin.ts` — **new** plugin
  + `subjectTypeForOverrideAction` mapper.
- `application/pos/use-cases/PosManagerOverrideUseCases.ts` — optional `IApprovalEngine`; evaluate
  before minting the token; throw on non-APPROVED (self / unauthorized / pending).
- `config/PermissionCatalog.ts` — new `pos.override.approve` permission.
- `infrastructure/di/bindRepositories.ts` — register the plugin on the shared `ApprovalEngine`,
  authority bound to `PermissionChecker.hasPermission(..., 'pos.override.approve')`.
- `api/controllers/pos/PosController.ts` — pass `diContainer.approvalEngine` into the use-case.
- `application/system-core/PolicyEngine.ts` — seam comment on `resolvePosManagerOverride`.
- `tests/application/pos/PosManagerOverrideUseCases.test.ts` — engine-backed use-case cases +
  direct plugin decision-matrix tests.
- `docs/architecture/pos.md` — §6a seam + new permission row.

## Verification

- `PosManagerOverrideUseCases.test.ts` green (use-case enforcement + plugin matrix).
- `src/tests/application/pos` + `src/tests/application/system-core` + `PermissionCatalogSyncService`
  — **23 suites / 144 tests green**.
- Backend `tsc --noEmit` + `tsc` build — clean.

## Manual QA script (owner-runnable)

Pre-req: a template-seeded tenant with POS entitled; a cashier role whose
`CashierRolePolicy.managerOverrideActions` includes (say) `PRICE_OVERRIDE`; one role that holds
`pos.override.approve` (the "manager") and one that does not.

1. **Self-approval blocked.** As the cashier, attempt a price override and approve it with the
   cashier's own user id. → Rejected: "A cashier cannot approve their own POS override…". No token,
   the sale stays blocked.
2. **Unauthorized approver blocked.** Approve with a user who lacks `pos.override.approve`.
   → Rejected: "The selected approver is not authorized to approve POS overrides." No token.
3. **Authorized manager approves.** Approve with a user holding `pos.override.approve` (≠ cashier).
   → A `mgr_override_…` token is issued and audited; the override sale completes.
4. **Whether-required still owned by policy.** Remove `PRICE_OVERRIDE` from the role's
   `managerOverrideActions`. → The price override no longer prompts for approval at all (Policy
   Engine decided it isn't required).
5. **Below-cost unchanged.** A below-cost POS line still routes through the Approval Engine as
   before (no behavior change).

## Follow-up

- Persist REJECTED/PENDING attempts as their own audit rows (today a blocked attempt throws
  before any token/audit-create).
- Asynchronous PENDING resolution (manager approves later) — current flow is synchronous at the till.
