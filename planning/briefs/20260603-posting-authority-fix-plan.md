# Fix Plan: Posting Authority & Guard Consistency
**For:** the next builder agent (continuation) — and `erp-reviewer` before any risky stage
**From:** Claude (Opus 4.8)
**Date:** 2026-06-03
**Spec:** [docs/architecture/posting-authority.md](../../docs/architecture/posting-authority.md) — read it first; this plan makes the ❌/⚠️ rows true.
**Worktree/branch:** authored on `main` in `D:/DEV2026/ERP03-posting-authority`.

## Why this exists

A long design review (Mahmud + Claude) established the target "one guard at the ledger door"
architecture and exposed concrete gaps. The most important: **source modules forge an "APPROVED"
stamp on their voucher before the guard sees it, which silently defeats the approval policy.** A
prior attempt (the Sales + Purchases "approval before posting" slices, commits `cc37e78e`,
`7fc4ce7e`) added approval as **per-module document gates** — useful machinery, but the wrong
*layer*: the decision must live in Accounting and be enforced by the guard, not bolted in front of
each module. This plan corrects that and closes the related gaps.

**No production data exists** (pre-alpha) — so there are **no migrations/backfills**; replace
freely.

## Verified current state (don't re-investigate — confirmed this session)

- `backend/.../accounting/services/SubledgerVoucherPostingService.ts` — builds the voucher with
  `VoucherStatus.APPROVED` **unconditionally**, then `.post()`, then runs `validatePostingPolicies`
  (the registry). → the **forged stamp**: `ApprovalRequiredPolicy` checks `status === APPROVED`, so
  it always passes for source modules.
- Manual path (`application/accounting/use-cases/VoucherUseCases.ts`) does **not** forge it — real
  `DRAFT → PENDING → APPROVED` workflow; approval is earned. **This is the reference behaviour.**
- `ApprovalRequiredPolicy` (`domain/accounting/policies/implementations/`) — checks
  `ctx.status === VoucherStatus.APPROVED`. Lives in the registry, run by the guard.
- Approval decision today = **per-module flags**: `SalesSettings.requireApprovalBeforePosting`,
  `PurchaseSettings.requireApprovalBeforePosting`, plus document-level "park as `PENDING_APPROVAL`"
  gates in `PostSalesInvoiceUseCase` / `PostPurchaseInvoiceUseCase` and `Approve*InvoiceUseCase`.
  (Inventory was intentionally **not** done — reverted.)
- Period lock = **two implementations**: `PeriodLockService` (override-aware, used by Sales path)
  **and** `PeriodLockPolicy` (registry). `config.allowPeriodLockOverride` is accounting config ✅.
  `assertCanOverridePeriodLock` lives in `SalesController.ts` (should be a courtesy pre-check, not
  the authority).
- Ledger write (`FirestoreLedgerRepository.recordForVoucher` / Prisma equivalent) runs only
  `validateCore` + `validateAccounts` (iron laws) — **no policies**. Direct callers bypass the
  rulebook.
- `backend/src/tests/architecture/AccountingBoundary.test.ts` still **fails** (Sales/Purchases
  reporting use direct voucher/ledger repos) — pre-existing, F8.
- Credit limit = correctly Sales-owned (`application/sales/services/CreditCheckService.ts`,
  `CreditOverride`); **zero** `creditLimit` references in accounting. ✅ Protect this.

## Staged plan

Each stage is independently mergeable and independently verifiable. Do them in order; do **not**
batch behavioural stages. Run `erp-reviewer` before Stage 1 and Stage 4.

### Stage 0 — Spec + guardrails (no behaviour change) — **STARTED THIS SESSION**
- ✅ `docs/architecture/posting-authority.md` written.
- ✅ This plan.
- ✅ `backend/src/tests/architecture/PostingAuthority.test.ts` — locks what's already correct
  (accounting ignorant of credit-limit; subledger consults the registry) and marks the targets as
  `it.todo(...)` so they're a visible checklist without breaking CI.
- **Acceptance:** new test file green (todos are pending, not failing). Done = the next agent has a
  red/green target list.

### Stage 1 — Kill the forged "approved" stamp (root cause) — ✅ DONE 2026-06-03
- `SubledgerVoucherPostingService`: added `approved?: boolean` to `PostSubledgerVoucherInput`. The
  policy context's `status`/`isApproved` are now **derived from the caller's real approval state**
  (`approved !== false`), not from the status the service stamps on the voucher. So an active
  `ApprovalRequiredPolicy` now **rejects** an unapproved subledger posting before any ledger write.
- **Safe-by-default:** `approved` omitted → treated as approved → existing callers unchanged.
- Tests: behavioural proof in `SubledgerVoucherPostingServicePolicy.test.ts` (reject-when-unapproved;
  post-when-default); architecture guardrail in `PostingAuthority.test.ts` flipped from todo → active.
  Verified: backend typecheck clean; Sales/Purchases posting suites still green (no regression).
- **Deferred to Stage 2:** wiring each module to *pass its real approval state* (today the per-module
  approval gates from 133/134 still handle this). Stage 1 only makes the guard *capable* of
  enforcing it honestly. `erp-reviewer` recommended before Stage 2 wires the modules.

### Stage 2 — Centralize the approval decision (one rulebook + scope)
- Move the decision out of `SalesSettings`/`PurchaseSettings` into accounting policy config:
  `approvalRequired` (exists) **+** a scope/exemption list **by document type**
  (`approvalScope: { exemptTypes: string[] }` or similar) on `AccountingPolicyConfig`.
- `AccountingPolicyRegistry` builds `ApprovalRequiredPolicy` with the scope; the policy checks
  `ctx.voucherType` against the exemptions.
- Keep the document-level **park as `PENDING_APPROVAL`** as a *convenience pre-check* (reuse the
  machinery from `cc37e78e`/`7fc4ce7e`), but driven by **reading the central policy**, not a local
  flag. Retire `requireApprovalBeforePosting` from Sales/Purchases settings + DTOs + UI (no
  migration needed).
- Exemption changes must be change-logged.
- **Acceptance:** one accounting setting + per-type scope controls approval for all modules; Sales
  UI no longer carries its own approval flag; tests cover "exempt type posts; non-exempt parks".

### Stage 3 — Unify period lock
- Collapse to **one** authority: keep `PeriodLockPolicy` (registry/guard path) as the enforcer;
  reduce `PeriodLockService` to a thin adapter or remove it. One override-acceptance code path,
  driven by `allowPeriodLockOverride` (accounting).
- Demote `assertCanOverridePeriodLock` (Sales controller) to an optional courtesy pre-check; the
  **accounting guard is the authority** that accepts/rejects the override reason.
- **Acceptance:** a single period-lock implementation; identical result for the same locked date
  across manual / Sales / Purchases / Inventory; override accepted/denied solely by accounting.

### Stage 4 — Put the guard at the door (no bypass)
- Make the full policy set run at the single, mandatory choke point in front of the ledger write —
  either inside `recordForVoucher`, or a `PostingGateway` that is the **only** permitted caller of
  `recordForVoucher`.
- Add an architecture test forbidding direct `recordForVoucher` calls outside that gateway.
- Resolve F8 (`AccountingBoundary.test.ts`): either route Sales/Purchases reporting through an
  accounting read-model, or consciously scope the test to writes. (Product/arch decision — ask.)
- **Acceptance:** no path writes the ledger without the rulebook; `AccountingBoundary` + new bypass
  test green. **Risk: high — `erp-reviewer` first.**

### Stage 5 — "Each guard signs its refusal" (uniform typed errors)
- Define a rejection contract `{ guard, code, message, fieldHints }`. Map `PeriodLockedError`,
  `PostingError`, `BusinessError`+`ErrorCode`, `PersonaNotAllowedError`, credit errors onto it.
  Surface `guard` + `code` consistently in controller responses (ties into the error-category work
  the original diagnosis flagged).
- **Acceptance:** every policy/guard rejection is attributable; a test asserts the shape.

### Stage 6 — Vocabulary cleanup
- Purge the "ticket" metaphor from comments/docs; standardize on **override reason**
  (`{ reason, overriddenBy }`). No data shape change.

### Stage 7 — Future hooks (DO NOT BUILD — document only)
- Form/role request-gating for overrides (module grants the right to *ask*; AND-gated).
- Account-level caps at the accounting guard.

## No-go / cautions

- Do **not** build a dynamic posting engine (AGENTS.md red line).
- Do **not** weaken any guard to "make a test pass" — guards may only tighten (Law 4).
- Do **not** collapse module rules into accounting (credit limit stays in Sales).
- Keep stages atomic; never leave the ledger path half-wired across a merge.

## Status — where I left off / next agent starts here

- **Done:** Stage 0 (spec, this plan, guardrail test) + **Stage 1** (guard derives approval from the
  caller, not a forged stamp — safe-by-default; behavioural + guardrail tests green). Committed to `main`.
- **Next:** **Stage 2 — centralize the approval decision.** Move the on/off from Sales/Purchases
  `requireApprovalBeforePosting` flags into accounting policy config + per-type scope; have each
  module pass its **real approval state** (`approved`) into `SubledgerVoucherPostingService` (the
  Stage-1 hook is ready); keep the document-level "park as PENDING_APPROVAL" as the convenience
  pre-check, driven by the central policy. Retire the per-module flags. Run `erp-reviewer` first.
- Sales + Purchases per-module approval (`cc37e78e`, `7fc4ce7e`) remain on `main` and keep working
  in the meantime; Stage 2 migrates them. Inventory approval was deliberately not built.
- Guardrail checklist: `PostingAuthority.test.ts` now has Stage 1 active + Stages 2–4 as `it.todo`.
