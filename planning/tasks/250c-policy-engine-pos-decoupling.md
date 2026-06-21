# 250c — Phase 1: Policy Engine (minimum) + POS decoupling from SalesSettings

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 1 · **Blocking:** 🔴 POS-blocking
**Depends on:** [250a](./250a-seams-and-interfaces.md), [250b](./250b-document-core-persona.md) · **Agent:** erp-backend-builder · **Estimate:** 2–3 days
**Status:** ⬜ Not started

## Objective

Move POS authorization out of `SalesSettings` into **POS-owned policy**, behind a shared `IPolicyEngine` that resolves with **most-restrictive-wins**. After this, POS can be authorized and operate without Sales being configured.

## Current state (proven)

- `UpdatePosSettingsUseCase` takes `ISalesSettingsRepository` and **mutates `SalesSettings.governanceRules`** — inserting/removing `pos_direct_sale_form_allow` ([PosSettingsUseCases.ts:99-119](../../backend/src/application/pos/use-cases/PosSettingsUseCases.ts:99)).
- At sale time POS is authorized via `DocumentPolicyResolver.isSalesInvoicePersonaAllowed(salesSettings, 'direct', { formType:'pos_sale' })` — i.e. **SalesSettings is the authority over POS**.
- The sync is wrapped in `if (salesSettings) { … }`: with Sales unconfigured, enabling POS **silently no-ops** then `PersonaNotAllowedError` blocks every sale ([POS §10 rule 5](../../docs/audit/pos-module-independence-and-engines-audit.md)).
- Precedence today is **most-specific-wins** ([DocumentPolicyResolver.ts:176-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:176)); target is **most-restrictive-wins**.

## Target contract

`IPolicyEngine.resolve(scope, action, context) → { allowed, requiresApproval, resolvedBy }` with **most-restrictive-wins**: a stricter scope tightens but never loosens a broader one; the only escape from a deny is an explicit approved override (routed to [250e Approval Engine](./250e-approval-engine.md)).

New POS-owned policy entities (minimal V1 — just enough to authorize POS direct sale and carry stricter-than-Sales rules):
- `POSPolicy` (company-level POS defaults, incl. `allowPosDirectSales`).
- `POSTerminalPolicy` (can be stricter than `POSPolicy`).
- `CashierRolePolicy` (can require approval for sensitive actions).

## Scope — files

**Create:**
- `backend/src/domain/pos/entities/POSPolicy.ts` (+ `POSTerminalPolicy`, `CashierRolePolicy` — may co-locate).
- Repository interface + Firestore + Prisma impls for POS policy (`repository/interfaces/pos/IPosPolicyRepository.ts`, `infrastructure/firestore/...`, `infrastructure/prisma/...`).
- `backend/src/application/system-core/PolicyEngine.ts` (implements `IPolicyEngine`; wraps persona resolver + posting policies + POS policy; most-restrictive-wins).

**Edit:**
- `backend/src/application/pos/use-cases/PosSettingsUseCases.ts` — **remove `ISalesSettingsRepository`**; `allowPosDirectSales` writes to `POSPolicy`, not `SalesSettings`.
- POS sale authorization (in `CompletePosSaleUseCase` / wherever persona is checked) — resolve against `IPolicyEngine` + `POSPolicy`, **not** `isSalesInvoicePersonaAllowed(salesSettings, …)`.
- `backend/src/infrastructure/di/bindRepositories.ts` — register POS policy repo + PolicyEngine.

## Out of scope

- Item/Promotion/Inventory policies (later phases / Commercial Core).
- Price/discount/tax override enforcement on the line (depends on Approval Engine 250e + Commercial Core 250l). Here we only need POS **authorization** to leave SalesSettings.

## Implementation steps

1. Define `POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy` entities + repo (Firestore + Prisma + DI).
2. Implement `PolicyEngine` with most-restrictive-wins; fold persona resolution + posting-policy checks behind it as plug-ins (adapter from 250a).
3. Rewire `UpdatePosSettingsUseCase` to persist `allowPosDirectSales` to `POSPolicy`; delete the `SalesSettings.governanceRules` write entirely.
4. Rewire POS sale authorization to `IPolicyEngine.resolve('pos', 'directSale', ctx)`.
5. Tests T3 + T4 (below).

## Tests

- **T3 — POSSettings isolation:** saving POS settings (incl. `allowPosDirectSales`) writes **nothing** into `SalesSettings`/`governanceRules`. Update [PosSettingsUseCases.test.ts](../../backend/src/tests/application/pos/PosSettingsUseCases.test.ts) (it currently asserts the SalesSettings write — **invert/replace** it).
- **T4 — most-restrictive-wins:** a `POSTerminalPolicy` deny overrides a permissive `POSPolicy`/Sales default; an explicit approved override is the only escape.
- Regression: enabling POS direct sale with **no SalesSettings present** succeeds (proves decoupling).

## Acceptance criteria

- [ ] `UpdatePosSettingsUseCase` no longer references `ISalesSettingsRepository`.
- [ ] POS authorization resolves via `IPolicyEngine` + `POSPolicy`.
- [ ] T3, T4, and the no-SalesSettings regression pass.
- [ ] typecheck + build clean; suite green.

## Definition of Done

- [ ] Commit: `feat(system-core): policy engine min + POS policy, drop SalesSettings coupling [250c]`
- [ ] `planning/done/250c-policy-engine-pos-decoupling.md` report.

## CTO audit gate

Reject if any POS code still reads or writes `SalesSettings`, if precedence is still most-specific-wins for POS, or if the old `pos_direct_sale_form_allow` rule is still produced.
