# Brief: Execute the System Core / Shared Engines transformation (Epic 250)

**For:** Codex
**From:** Claude Code (Opus 4.8, acting CTO)
**Date:** 2026-06-21

## Context

POS work is paused. Three code-verified audits proved a platform-wide problem: application modules **own or embed shared business engines** (Tax calc in Sales, no Document Core persona, accounting-only Approval, duplicated rounding, POS authorization stored in `SalesSettings`, etc.). We are separating **Engines (System Core)** from **Apps (orchestrators)** from **UI surfaces**.

This is an **owner-authorized exception to the 2026-06-13 feature freeze** (recorded in `PRIORITIES.md` / `ACTIVE.md` / `JOURNAL.md`). It is the current top priority.

**Where the work lives:** branch `feat/system-core-transformation`, worktree `D:\DEV2026\ERP03-system-core`, cut from clean `main` HEAD (957d8553). Do **not** work on `main` (it has uncommitted POS QA WIP that is intentionally excluded). `git checkout feat/system-core-transformation` (or work in the worktree) before doing anything.

## Read first (in this order)

1. [planning/tasks/250-system-core-transformation-epic.md](../tasks/250-system-core-transformation-epic.md) — the epic: phase map, governing rules, execution model, Definition of Done.
2. [docs/audit/platform-architecture-engine-vs-app-audit.md](../../docs/audit/platform-architecture-engine-vs-app-audit.md) — the binding findings (§A–N), incl. the 10 architecture tests in §N.
3. [docs/architecture/system-core-shared-engines-master-plan.md](../../docs/architecture/system-core-shared-engines-master-plan.md) — target architecture decisions (incl. §4 temporary-adapter rules).
4. The specific phase task file you are executing (`250a`–`250l`). Each is self-contained: objective, contract, exact files, steps, acceptance criteria, named tests, Definition of Done, CTO audit gate.

## Task — execute phases in order, one at a time

**Start with Phase 0: [250a](../tasks/250a-seams-and-interfaces.md)** (interface seams + adapters, zero behavior change). Then the strict order:

```
250a → 250b → 250c → 250d → 250e → 250f/250g → 250h/250i/250j → 250k → 250l
```

- **Phase 1 (250b→c→d→e) is sequential** — those tasks share persona/POS/posting code. Do not parallelize them.
- **One file area at a time** (AGENTS.md §7). If a task exceeds 8 files / 3 dirs, split it and note the breakdown in the task file before coding (AGENTS.md §4).
- **Honor the architecture red lines** (AGENTS.md §5): repository pattern, DI via `bindRepositories.ts`, no Firestore/Prisma in domain/application, thin controllers, SQL-migration-ready.
- **Behavior-preserving** unless the task explicitly changes behavior. Capture the test baseline before Phase 0 and keep counts steady except for the intended test inversions (e.g. T1 in 250b, T3 in 250c).

## Per-task workflow (every phase)

1. Implement exactly the scope in the task file.
2. Add/adjust the **named tests** for that task (mapped to audit §N — T1…T10).
3. Land green: `npm --prefix backend run typecheck` + `run build` + the task's named tests (+ frontend checks if you touched frontend). **No commit on failure** (AGENTS.md).
4. Write the completion report `planning/done/250x-*.md` (technical + end-user sections per AGENTS.md §8).
5. Commit on the branch: `feat(system-core): <summary> [250x]`.
6. Update `ACTIVE.md` (mark the phase done, point at the next) + append `JOURNAL.md`.
7. **STOP and hand back for CTO audit** before starting the next phase — UNLESS the unattended-run authorization below applies.

## Unattended-run authorization (2026-06-21, owner away)

For this run you MAY chain phases **250a → 250b → 250c → 250d → 250e** in one unattended session (still one task at a time, in order, committing per task with its tests green). **Hard-stop at the end of 250e** and hand back for CTO audit. Rules:

- **Do NOT proceed past 250e** (no Phase 2/3/4 unattended). 250e is the milestone: POS unblocked, proven by tests T1–T6/T10.
- **Any failure = immediate STOP.** If a task's named tests fail, its acceptance criteria can't be met, the build breaks, or you hit a design ambiguity not answered by the task file + audit, STOP at the last green commit and write the blocker into `ACTIVE.md` "Where I left off". Do **not** push forward into a dependent phase on a shaky base, and do **not** invent a design decision — leave it for the CTO.
- Per-task discipline still applies: green (typecheck + build + named tests) before each commit; no commit on failure; completion report per task.
- Leave a running summary in `ACTIVE.md` after each task so the CTO can audit the whole 250a–250e batch on return.

## Definition of Done (per phase = the task file's checklist; per epic = the epic file's checklist)

A phase is done when: its acceptance criteria pass, its named tests are green, its completion report exists, and the commit + planning-doc updates are on the branch. The **epic** is done when all 10 architecture tests (audit §N) pass and the three new architecture docs (`system-core.md`, `module-boundaries.md`, `pos-independence.md`) exist.

## Hand-back protocol

After each phase, leave `ACTIVE.md` "Where I left off" pointing at: the phase you finished, the commit hash, test results, and the next phase. The CTO (Claude) re-reads the diff against the task's acceptance criteria + audit red lines, runs the named tests, and either marks the phase done or returns it with specific rejections (see each task's "CTO audit gate").
