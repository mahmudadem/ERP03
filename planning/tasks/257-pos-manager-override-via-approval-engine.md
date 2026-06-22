# Task 257 — Route POS manager overrides through the Approval Engine

**Status:** 📋 OPEN — tracked follow-up. Do NOT start until the in-flight POS Terminal
price/discount-edit + Cashier Policy tab + `cashierRoleId`/override-flag plumbing work
has merged (it threads the same override flags this path consumes; concurrent edits will collide).

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

## Acceptance criteria (when picked up)

- [ ] POS sale/return manager overrides (`VOID_LINE`, `PRICE_OVERRIDE`, `DISCOUNT_OVERRIDE`,
      `TAX_OVERRIDE`, `RETURN`, `REPRINT`) route through `IApprovalEngine.evaluate(...)` with the
      already-reserved subject types — not a token-presence check.
- [ ] Self-approval is rejected (approver must differ from the acting cashier).
- [ ] Approver authority is enforced by the engine, not assumed from a client token.
- [ ] A required-but-unapproved override yields a blocking/PENDING decision (no silent allow).
- [ ] `below_cost_sale` continues to work unchanged (already on the Approval Engine).
- [ ] Policy Engine remains the place that decides **whether** approval is required; the Approval
      Engine decides **who** approves and the outcome. (Clarify the seam in the architecture doc.)
- [ ] Tests: required→PENDING when unapproved; APPROVED by a valid manager allows; self-approval REJECTED.
- [ ] Architecture/user docs + completion report + JOURNAL/ACTIVE updated (Definition of Done).

## Accounting/ERP impact

Control hardening only. No GL posting, tax, COGS, valuation, settlement math, or period-lock
behavior changes — this only governs whether a sensitive action is permitted and by whom.
