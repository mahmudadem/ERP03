# Task 257 — Route POS manager overrides through the Approval Engine

**Status:** ✅ IMPLEMENTED (2026-06-22) on branch `feat/pos-readiness-and-negative-stock`.
Implemented directly on top of the in-flight Task 251 override-flag work (which is present,
uncommitted, in the same working tree) per owner direction — there was no *concurrent*
diverging edit to collide with, so the original "wait until 251 merges" caveat was waived.

**Origin:** CTO audit of merged POS work (PR #35 / Task 251) against the owner's full POS
requirements spec (2026-06-22). This is the gate-#8 deviation from the owner's confirmation list.

## Plain-language problem

When a cashier does something sensitive (void a paid line, large discount, price override,
tax override), POS is supposed to require a **manager's approval**.

Today the system only checks *"is the manager-approval box ticked?"* — it trusts the screen.
It does **not** verify that:
- a **real manager** (not the cashier) approved it,
- that approver has authority to approve that action,
- and it cannot **hold** the sale PENDING a real approval.

The required behavior is a real approval workflow, not a trust-the-token gate.

## Technical finding

- POS calls `IPolicyEngine.resolve(scope:'pos', action:'managerOverride')`
  ([PolicyEngine.ts `resolvePosManagerOverride`](../../backend/src/application/system-core/PolicyEngine.ts)).
  That resolver only answers: (a) does `CashierRolePolicy.managerOverrideActions` require approval
  for this action? and (b) is an `approvedOverrideId`/`approvedOverride` token present on the request?
  If required **and** a token is present → allow. It performs **no** approver-identity, authority,
  or self-approval check, and never produces a PENDING state.
- The token is produced client-side by `frontend/src/modules/pos/components/ManagerOverrideCapture.tsx`.
  The trust boundary is the screen, not an engine.
- The shared **Approval Engine** ([IApprovalEngine.ts](../../backend/src/application/system-core/contracts/IApprovalEngine.ts))
  is a real workflow: `evaluate(subject, context) → { decision: APPROVED|REJECTED|PENDING, requiredApprovers, gates }`.
  Its `ApprovalSubjectType` union **already reserves** `'pos_manager_override'`, `'price_override'`,
  `'discount_override'`, `'tax_override'` — so the engine was designed to own these actions.
- POS currently reaches the Approval Engine for **only** one case: `below_cost_sale`
  (via `CommercialCore.validateCostMargin`). The four manager-override actions do not.

## Why it's deferred, not fixed now

- Pre-alpha, no production data, no real cashiers — nothing is leaking today
  (see memory `project_no_production_data`).
- The fix edits the exact override-flag path the other agent is currently wiring; doing both at
  once guarantees a merge conflict.

## Acceptance criteria

- [x] POS manager overrides (`VOID_LINE`, `PRICE_OVERRIDE`, `DISCOUNT_OVERRIDE`,
      `TAX_OVERRIDE`, `RETURN`, `REPRINT`) route through `IApprovalEngine.evaluate(...)` with the
      already-reserved subject types — not a token-presence check. The `approvedOverrideId`
      token is now minted by `CreatePosManagerOverrideUseCase` **only on an APPROVED decision**.
- [x] Self-approval is rejected (approver ≠ acting cashier), via `PosManagerOverrideApprovalPlugin`.
- [x] Approver authority is enforced by the engine — the plugin checks `pos.override.approve`
      against the server-side RBAC permission resolver, not a client token.
- [x] A required-but-unapproved override yields PENDING (no approver) / REJECTED — no silent allow;
      the use-case throws and mints no token.
- [x] `below_cost_sale` unchanged (no plugin; keeps the generic `requiresApproval → PENDING` fallback).
- [x] Policy Engine still decides **whether** approval is required; the Approval Engine decides
      **who** approves and the outcome. Seam documented in `docs/architecture/pos.md` §6a + a
      `PolicyEngine.resolvePosManagerOverride` comment.
- [x] Tests: required→PENDING; APPROVED by a valid manager allows + mints token; self-approval REJECTED;
      unauthorized approver REJECTED; plugin subject-type ownership.
- [x] Architecture doc + completion report + JOURNAL/ACTIVE updated.

## Delivered scope / notes

- New permission `pos.override.approve` ("Approve POS manager overrides (manager)") in
  `PermissionCatalog.ts`. Owners/admins (`*`) and any role granted this permission can approve.
- `PosManagerOverrideApprovalPlugin` registered on the shared `ApprovalEngine` in DI with an
  authority resolver bound to `PermissionChecker.hasPermission(approverUserId, companyId,
  'pos.override.approve')`.
- The use-case takes the Approval Engine as an **optional** collaborator (enforces when present;
  the production controller always passes it). This preserves the existing constructor for
  callers/tests that don't exercise approval.
- **Not in scope (follow-up):** persisting REJECTED/PENDING attempts as their own audit rows
  (today a blocked attempt throws before any token/audit-create); surfacing PENDING as a held
  approval the manager later resolves asynchronously (current flow is synchronous at the till).

## Accounting/ERP impact

Control hardening only. No GL posting, tax, COGS, valuation, settlement math, or period-lock
behavior changes — this only governs whether a sensitive action is permitted and by whom.
