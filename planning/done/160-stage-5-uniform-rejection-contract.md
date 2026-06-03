# Task 160 — Posting Authority Stage 5: Uniform Rejection Contract

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** main (worktree `D:/DEV2026/ERP03-posting-authority`)
**Time spent:** ~1h
**Linked plan:** [`planning/briefs/20260603-posting-authority-fix-plan.md`](../briefs/20260603-posting-authority-fix-plan.md) — Stage 5
**Linked architecture doc:** [`docs/architecture/posting-authority.md`](../../docs/architecture/posting-authority.md) §2 Law 5, §8

---

## Definition of Done — Checklist

- [x] Code merged (this commit)
- [x] `docs/architecture/posting-authority.md` conformance row flipped to ✅
- [x] User guide — N/A (internal error-contract change; the richer response is consumed by the UI)
- [x] This completion report links the architecture doc
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Built

Law 5 — "every guard signs its refusal." A single uniform shape,
`RejectionContract { guard, code, message, fieldHints, policyId?, correlationId? }`, that every guard
rejection maps onto, so an API consumer always sees **which** guard refused and **why** — regardless of
which error subclass was thrown.

### Files Changed

**New**
- `backend/src/domain/shared/errors/RejectionContract.ts` — the `RejectionContract` type + the
  `toRejectionContract(err)` mapper.
- `backend/src/domain/shared/errors/__tests__/RejectionContract.test.ts` — 6 tests (one per family + null).

**Changed**
- `backend/src/domain/shared/errors/AppError.ts` — added `GuardName` type; added optional `guard` to the
  `AppError` interface; `createPostingError` now takes an optional `guard` (defaults to `'accounting'`,
  since policy violations come from the accounting registry).
- `backend/src/domain/accounting/errors/PeriodLockedError.ts` — tags `guard: 'accounting'`.
- `backend/src/domain/accounting/errors/PersonaNotAllowedError.ts` — tags `guard: details.module`
  (sales/purchases; persona governance is module-owned).
- `backend/src/errors/errorHandler.ts` — computes `toRejectionContract(err)` once and surfaces
  `guard` + `code` consistently on the `PeriodLockedError`, `PostingError`, and `AppError`/`BusinessError`
  responses. **Added a `CreditLimitExceededError` branch (422)** — the active handler previously had no
  branch for it, so credit rejections fell through to the 500 unknown handler; they now return a proper
  422 with the uniform contract.

### Guard attribution map

| Error family | Guard | Code example |
|---|---|---|
| `PeriodLockedError` | accounting | `PERIOD_LOCKED` |
| `PersonaNotAllowedError` | sales / purchases (its module) | `PERSONA_NOT_ALLOWED` |
| `PostingError` (policy violations) | accounting (or `appError.guard`) | `APPROVAL_REQUIRED`, … |
| `CreditLimitExceededError` | sales | `CREDIT_LIMIT_EXCEEDED` |
| `BusinessError` / `AppError` | inferred from `ErrorCode` prefix (`ACC`/`VOUCH`→accounting, `CREDIT`→sales, `PURCH`→purchases, `STOCK`/`INV`→inventory, else `system`) | `VOUCH_005`, … |
| unknown / infrastructure | — (`toRejectionContract` returns `null`; generic handling) | — |

### Architecture / Behavior

- All additive: `guard` is optional everywhere, so existing error construction and responses keep
  working; the field is *added* to responses, never removed.
- The only HTTP-status change is the new credit branch (500→422), which matches both the dormant
  `api/errors/errorHandler.ts` intent and `CreditLimitExceededError.statusCode = 422`.

### Verification

- [x] `cd backend && npx tsc --noEmit` — clean.
- [x] `npx jest --testPathPatterns="RejectionContract"` — 6/6 green.
- [x] **Full backend suite** — `npx jest` → **139 suites, 1307 passed, 0 failed.** (One AI-certification
  test is flaky under parallel load — passes in isolation and on re-run; unrelated to this change.)

### Known Issues / Follow-ups

- Controllers that catch `CreditLimitExceededError` themselves (some Sales paths) shape their own
  response; those are unaffected. The new handler branch is the safety net for any that don't.
- The dormant `backend/src/api/errors/errorHandler.ts` is not the registered handler
  (`backend/src/api/server/index.ts` wires `backend/src/errors/errorHandler.ts`). Left as-is.

---

## 2. End-User View

When the system refuses to post or save something, the error now consistently tells you which part of
the system refused (e.g. *Accounting — period locked*, *Sales — credit limit exceeded*) and gives a
stable code, so messages are clearer and support can diagnose faster. No workflow changes.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
