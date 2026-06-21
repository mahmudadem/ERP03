# 250 — System Core / Shared Engines Transformation (Epic)

**Date:** 2026-06-21
**Author:** Claude (Opus 4.8) — acting CTO
**Status:** 🟢 Active — planning complete, execution pending
**Branch:** `feat/system-core-transformation` (worktree: `D:\DEV2026\ERP03-system-core`)
**Why this epic exists:** POS work is paused. Three audits proved the platform problem behind the POS/Sales coupling: **application modules own or embed shared business engines.** This epic separates **Engines (System Core)** from **Apps (orchestrators)** from **UI management surfaces**, and unblocks POS.

## Source of truth (read before any phase)

- [Platform Architecture Audit — Engine vs App](../../docs/audit/platform-architecture-engine-vs-app-audit.md) — the binding findings (sections A–N).
- [System Core / Shared Engines Audit](../../docs/audit/system-core-shared-engines-audit.md) — engine inventory.
- [POS Audit §9 — Commercial Rules](../../docs/audit/pos-commercial-rules-and-promotions-audit.md)
- [POS Audit §10 — Module Independence](../../docs/audit/pos-module-independence-and-engines-audit.md)
- [System Core / Shared Engines Master Plan](../../docs/architecture/system-core-shared-engines-master-plan.md) — target architecture decisions.

## The three-layer target

1. **Engines / System Core** own business logic (Document, Numbering, Money, Tax, Commercial, Policy, Approval, Inventory, Accounting/Financial + Bridge, Audit).
2. **Apps / Modules** (Sales, Purchases, POS, Inventory UI, Accounting UI) are **user-facing orchestrators** over engine **interfaces** — never owners of shared logic, never importing another module's entities/use-cases.
3. **UI management surfaces** are split into Engine-management UI, Module-settings UI, and Transaction UI, each with a strict edit scope ([audit §I](../../docs/audit/platform-architecture-engine-vs-app-audit.md)).

## Governing rules (apply to every phase)

- **Modules depend on interfaces, not internals.** A module may call `ITaxEngine`; it may not import `SalesInvoiceCalculationService`.
- **No module governs another module.** `SalesSettings` configures Sales only.
- **Engine ≠ App.** Engines run whenever inputs exist; App activation gates UI/management only.
- **Temporary adapters allowed** behind interfaces ([master plan §4](../../docs/architecture/system-core-shared-engines-master-plan.md)) — but the consumer depends on the interface, never the legacy internal.
- **Behavior-preserving unless a phase explicitly changes behavior.** Pin with tests before refactoring (no production data — pre-alpha — so this is about correctness + rework cost, not migration).
- **Architecture red lines still apply** (AGENTS.md): repository pattern, DI via `bindRepositories.ts`, no Firestore/Prisma in domain/application, thin controllers, SQL-migration-ready.

## Phase map → task files

| Phase | Task file | Engine / change | Blocking? |
|---|---|---|---|
| 0 | [250a](./250a-seams-and-interfaces.md) | Interface seams + adapters (no behavior change) | Enables all |
| 1 | [250b](./250b-document-core-persona.md) | Document Core + `POS_DIRECT_SALE` persona | **POS-blocking** |
| 1 | [250c](./250c-policy-engine-pos-decoupling.md) | Policy Engine min + POS policies; remove POS→SalesSettings | **POS-blocking** |
| 1 | [250d](./250d-pos-posting-entry-point.md) | POS **sale** posting via Accounting Bridge, not Sales use-cases | **POS-blocking** |
| 1 | [250d2](./250d2-pos-return-posting-entry-point.md) | POS **return** posting via Accounting Bridge; flip folder-wide POS→Sales ban | **POS-blocking** |
| 1 | [250e](./250e-approval-engine.md) | Subject-agnostic Approval Engine; accounting FA/CC = plug-in | **POS-blocking seam** |
| 2 | [250f](./250f-money-core.md) | Money Core (dedup rounding; apply POS cash rounding) | During V1 |
| 2 | [250g](./250g-audit-engine.md) | Audit Engine consolidation; wire POS | During V1 |
| 3 | [250h](./250h-tax-engine.md) | Tax Engine extraction (Sales+Purchases consume) | After POS V1 |
| 3 | [250i](./250i-numbering-engine.md) | Numbering Engine unification | After POS V1 |
| 3 | [250j](./250j-inventory-core-tidy.md) | Inventory Core rename + COGS move | After POS V1 |
| 4 | [250k](./250k-accounting-bridge.md) | Accounting Bridge hardening (minimal-journal mode) | Long-term |
| 4 | [250l](./250l-commercial-core.md) | Commercial Core (pricing/discount/promotions/cost-margin) | Long-term |

## Execution model (how agents + I work)

- **Executing agents implement; I (CTO) audit.** Each task file is self-contained: objective, contract, exact files, steps, acceptance criteria, tests, Definition of Done. An executing agent should be able to act **cold** from the file alone.
- **One builder per file area at a time** (AGENTS.md §7). Phase 1 tasks touch overlapping POS + persona code — sequence them **b → c → d → d2 → e**, not in parallel, unless the file says otherwise. (250d2 added 2026-06-21 by CTO ruling to decouple POS returns; see [250d](./250d-pos-posting-entry-point.md) ruling note.)
- **Task Size Cap (AGENTS.md §4):** if a task exceeds 8 files / 3 dirs, the agent splits it and reports the breakdown before coding.
- **No commit on failure** (AGENTS.md). Each task ends green (typecheck + build + its named tests) before commit.
- **Per-task commit** on this branch using `feat(system-core): … [250x]`.
- **My audit gate per task:** I re-read the diff against the task's acceptance criteria + the audit's red lines, run the named tests, and only then mark the phase done in ACTIVE.md.

## Definition of Done — epic

The epic is done when **all engines are extracted behind interfaces, consumed by their modules, and proven by tests** — specifically the 10 architecture tests in [audit §N](../../docs/audit/platform-architecture-engine-vs-app-audit.md), plus:

- [ ] Every phase task file marked ✅ with its completion report in `planning/done/`.
- [ ] `docs/architecture/system-core.md`, `module-boundaries.md`, `pos-independence.md` created.
- [ ] No module imports another module's entities/use-cases for shared logic (enforced by an architecture test, see 250a).
- [ ] POS can be enabled, sell, and post with the Sales App disabled (test T2).
- [ ] `JOURNAL.md` + `ACTIVE.md` reflect final state.

## Time estimate (planning-level, to be refined per task)

| Phase | Estimate |
|---|---|
| 0 — seams | 1–2 days |
| 1 — POS-blocking (b/c/d/e) | 5–8 days |
| 2 — money + audit | 2–3 days |
| 3 — tax + numbering + inventory tidy | 4–6 days |
| 4 — accounting bridge + commercial core | 6–10 days |
| **Total** | **~3–5 weeks** of focused execution + CTO audit between phases |

## Current status / where we left off

- Worktree + branch created from clean `main` HEAD (957d8553), deliberately **excluding** the uncommitted POS QA WIP on `main` so the refactor starts clean.
- Reference audits + master plan copied into the branch.
- **Next:** start [Phase 0 — 250a](./250a-seams-and-interfaces.md). Get owner approval on the phase plan, then assign one backend builder.
