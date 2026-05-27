# Brief: Phase E — Sales cross-cutting cleanup

**For:** OpenCode (orchestrator → backend/frontend builders)
**From:** Claude Code (session with Mahmud)
**Date:** 2026-05-24
**Branch:** `feat/phase-e-sales-cleanup` (already created)
**Worktree:** `D:\DEV2026\workTrees\ERP03-phase-e`
**Parent branch:** `feat/phase-a-sales-master-data` @ `77df7533`

---

## Context

Sales Phases A–D are complete and committed. Mahmud and Claude Code are doing manual QA on Phase D in the main worktree (`D:\DEV2026\ERP03`). You take Phase E in parallel from your own worktree so our dev servers don't churn during QA.

Phase E is the cross-cutting cleanup pass that closes carried-forward gaps before we hand Sales to QA in its entirety.

## Hard rules — read before doing ANYTHING

1. **Work only in your worktree** — `D:\DEV2026\workTrees\ERP03-phase-e`. Never `cd` into `D:\DEV2026\ERP03`.
2. **No servers, no emulator.** Do NOT start `vite`, `nodemon`, the Firebase emulator, or anything that binds a port. The main worktree is running them. Use **unit tests only** for verification (`npm test` in backend).
3. **Do NOT edit these files** — they belong to the coordinating session and will conflict on merge:
   - `planning/ACTIVE.md`
   - `planning/JOURNAL.md`
   - `planning/PRIORITIES.md`
   - `planning/QA-QUEUE.md`
   - Instead, record progress at the bottom of THIS brief under "Progress log".
4. **Commit incrementally** — one commit per Phase E subtask, on `feat/phase-e-sales-cleanup`. Do NOT push (no upstream is set; we'll handle merging).
5. **Clarification-first protocol applies** (AGENTS.md §"OpenCode Multi-Agent System"). If anything in this brief is ambiguous, stop and write your question at the bottom of this file under "Questions for Claude Code / Mahmud" — do NOT guess.
6. **Architecture red lines** (AGENTS.md) — repository pattern, no Firestore in domain/application, register repos in `bindRepositories.ts`, controllers thin, i18n keys for any user-facing string.

## Task — Phase E subtasks (do in this order)

### E.1 — Quote sequence numbering *(small, isolated — do this FIRST as warm-up)*
Replace the `Q-<timestamp>` fallback with a real sequence.
- Add `quoteSequence` to `SalesSettings` (next number, prefix, padding) — mirror the existing invoice sequence pattern.
- Update `QuotationUseCases` (or equivalent) to consume the sequence atomically.
- Add unit test for sequence allocation + collision behavior.

### E.2 — AI-assistant test stabilization
Fix the 4 failing tests:
- 3 in `SendChatMessageUseCase` (credits / runtime-mode path)
- 1 in `AiModelCertificationUseCase` (global recommended query expectation)
Goal: full backend `npm test` is green.

### E.3 — Promotion evaluator auto-invocation
Promotion evaluator is built but not auto-invoked. Wire it into:
- `SalesOrderUseCases.createSalesOrder` — apply matching promotions at create time
- `SalesInvoiceUseCases.createSalesInvoice` (direct path) — same
Behavior: applied promotions stored on the document; manual override still possible. Tests for both paths.

### E.4 — Credit check on direct Sales Invoices
Today: credit check runs at SO confirm only. Extend it to direct SI creation (no SO).
- Reuse the existing credit-check service — do NOT duplicate logic.
- Same override flow as SO confirm.
- Test: direct SI on a credit-held customer is blocked / requires override.

### E.5 — Backorder / partial-fulfillment frontend UX
Backend supports partial fulfillment; frontend doesn't expose it cleanly.
- On Delivery Note detail: show shipped vs ordered per line, with a "create backorder DN" action when shipped < ordered.
- On SO detail: aggregated fulfillment status (% delivered).
- i18n keys in en/ar/tr.

**Note:** E.5 is the only frontend-heavy item. If it grows beyond ~6 files, stop and write a checkpoint in the Progress log — don't push further without checking in.

## Definition of Done (per subtask)

- Code committed on `feat/phase-e-sales-cleanup` with conventional commit message: `feat(sales): E.N — <description>`.
- `docs/architecture/sales.md` section updated for that subtask.
- `docs/user-guide/sales/<feature>.md` created/updated for user-facing changes (E.3, E.4, E.5).
- `planning/done/120-phase-e-sales-cleanup.md` created at the end with the dual technical/end-user write-up (one report covering all five).
- Backend `npm test` green after each commit.
- Progress logged below in this brief.

## Verification command

From your worktree only:
```
cd D:\DEV2026\workTrees\ERP03-phase-e\backend
npm test
```

No frontend dev server, no emulator.

---

## Progress log (OpenCode writes here)

### 2026-05-24 — E.1 Quote sequence numbering
- Replaced `Q-<timestamp>-<random>` fallback with proper sequence numbering mirroring SO/DN/SI/SR pattern
- Added `quoteNumberPrefix` and `quoteNumberNextSeq` to `SalesSettings` entity + DTOs
- Updated `generateDocumentNumber()` to support `'QT'` doc type
- Wired `CreateQuoteUseCase` and `ReviseQuoteUseCase` to use `ISalesSettingsRepository` for sequence allocation
- Added 5 new sequence tests (format, advancement, collision, custom prefix, revise)
- Updated frontend: `SalesSettingsDTO` types + numbering tab (5 docs now)
- Commit: `ea63437f`
- Tests: 17/17 Quote tests pass, 241/241 Sales tests pass

### 2026-05-24 — E.2 AI-assistant test stabilization
- Fixed 3 failing `SendChatMessageUseCase` tests (mock ledgers lacked `canAfford()` method)
- Added `canAfford()` to all 4 mock credit ledger objects
- Fixed assertion: `'No platform runtime credential'` → `'No platform runtime profile or provider credential'`
- AiModelCertificationUseCase tests were already passing (8/8)
- Commit: `fddba058`
- Tests: 35/35 SendChatMessage tests pass, 8/8 AiModelCertification tests pass

### 2026-05-24 — E.3 Promotion evaluator auto-invocation
- Wired `PromotionApplicationService` into `CreateSalesOrderUseCase` and `CreateSalesInvoiceUseCase`
- Direct SI persona only — linked/service invoices skip auto-evaluation
- Line discounts applied automatically with `appliedPromotionId`, `appliedPromotionName`, `appliedDiscountPct` on each line
- Free goods lines added with zero price
- Manual discounts take precedence (skipped by evaluator)
- New `AppliedPromotionInfo` shared type
- Added `appliedPromotions` summary on SO and SI entities
- 7 new unit tests covering all paths
- Commit: `1e88194b`
- Tests: 7/7 PromotionAutoApplication tests pass, 248/248 Sales tests total

### 2026-05-24 — E.4 Credit check on direct Sales Invoices
- Extended `CreditCheckService` to direct SI creation (persona === 'direct')
- Same enforcement pattern as SO confirm: BLOCK / WARN / OVERRIDDEN
- Override with `creditOverrideReason` creates audit `CreditOverride` record
- `CreditLimitExceededError` returns HTTP 422 with structured JSON
- Frontend: credit override dialog + WARN banner on `SalesInvoiceDetailPage`
- i18n keys added
- 7 new unit tests
- Commit: `815f674d`
- Tests: 7/7 CreditCheckOnDirectSI tests pass, 290/290 Sales+AI tests total

### 2026-05-24 — E.5 Backorder / partial-fulfillment frontend UX
- Delivery Note detail: added "Ordered" column when DN is linked to SO, amber "Partial" / green "Fulfilled" badges, "Create Backorder DN" button
- Sales Order detail: added "Fulfillment Progress" section with per-line progress bars and aggregate stats (view mode only, not DRAFT)
- i18n keys in en/ar/tr for fulfillment labels
- 5 files changed (under the 6-file budget)
- Commit: `64a10ac6`
- Frontend typecheck: clean
- Tests: 25/25 test suites, 290/290 tests pass

---

## Questions for Claude Code / Mahmud (OpenCode writes here)

<!-- Stop and ask here BEFORE guessing on anything ambiguous. -->
