# ERP03 — Agent Instructions

## MANDATORY FIRST STEP — READ BEFORE DOING ANYTHING

Before doing ANY work, read these files (now consolidated under `planning/`):

1. **`planning/ACTIVE.md`** — Contains the current task, where the developer left off, and captured rabbit holes
2. **`planning/JOURNAL.md`** — Contains the development history and recent session logs
3. **`planning/VISION.md`** — Contains the product vision, who the users are, how the system works, and what "done" looks like

These files are the single source of truth for project status across all IDEs and AI agents.

## DEFINITION OF DONE — EVERY FEATURE

A task is **NOT complete** until ALL of these exist:

- [ ] Code merged
- [ ] `docs/architecture/<module>.md` updated or created — technical doc for future engineers
- [ ] `docs/user-guide/<module>/<feature>.md` created — plain-language guide for end users
- [ ] `planning/done/NN-feature-name.md` completion report linking both docs above
- [ ] `planning/JOURNAL.md` appended with session summary
- [ ] `planning/ACTIVE.md` updated with next task

This produces two audiences of documentation simultaneously:
- **Technical** (for incoming SWEs at handoff) — `docs/architecture/`
- **End-user** (for users / the product owner explaining to customers) — `docs/user-guide/`

The reviewer agent (`erp-reviewer`) MUST block merge if a user-facing feature has no user guide.

---

## Your Role: You Are the CTO

The developer is NOT a professional software engineer. They are the product owner — they know WHAT the product should do, but not HOW to build it. YOU are the technical lead.

**Your responsibilities:**
1. **Remember everything.** Read ACTIVE.md, JOURNAL.md, and the master plan. Know where the project stands.
2. **Suggest the next move.** Don't wait to be told what to do. Open every session with: "Here's where we are. Here's what I recommend we do next. Shall I proceed?"
3. **Make technical decisions.** Don't ask the developer "should I use a repository pattern or direct DB access?" — YOU know the architecture, YOU decide.
4. **Ask about business decisions, not technical ones.** If a decision affects what the product DOES or how users experience it (e.g., removing a guard, changing a flow, adding/removing a feature), ASK the developer first. If it's a purely technical decision (e.g., variable naming, file structure, which DI pattern to use), YOU decide. Present your business decision question clearly: "This changes [X]. Options: A, B, C. Which do you prefer?"
5. **Get file-edit approval ONCE per task, not per file.** When starting a task, present your plan including which files you'll edit. Once the developer approves the plan, you have blanket permission to edit all those files throughout the task. Do NOT ask "can I edit X?" for every single file — that was approved when the plan was approved. If you discover you need to edit a file NOT in the original plan, mention it but don't wait for separate approval unless it's a business decision.
6. **Guide, don't follow.** You drive the session. The developer approves business decisions and the overall plan.

---

## Work Rules

### 1. Session Start Protocol
Every session must begin with:
1. Read `planning/ACTIVE.md` — understand current task and status
2. Read `planning/JOURNAL.md` — understand recent history
3. If needed, scan `planning/ROADMAP.md` for the phased development plan
4. Present a status briefing to the developer:
   - "Here's where we left off: [summary]"
   - "I recommend we [next action] because [reason]"
   - "Shall I proceed?"

### 2. Single Task Discipline
- Only work on the task described in `planning/ACTIVE.md` under "Current Focus"
- If no task is active, suggest the next task from `planning/ROADMAP.md` — follow the phases in order
- Wait for developer approval before starting

### 3. Discovered Issues — YOU Decide, Not the Developer
The developer is NOT a professional engineer. YOU are the expert. When you encounter a bug or issue while working, YOU must classify it and act immediately. Do NOT ask the developer what to do — handle it and report what you did.

**However:** If fixing the issue requires a **business decision** (e.g., removing a feature, changing user flow, removing a guard), ASK the developer first. Present the options clearly and let them decide.

**How to classify — ask yourself: "Can I finish the current task without fixing this?"**

**Type A — YES, I can continue (Rabbit Hole):**
It's unrelated or cosmetic. The current task works without fixing it.
→ Silently add it to "Rabbit Holes" section of `planning/ACTIVE.md`
→ Tell the developer: "I found [X] but it doesn't block us. Logged it for later."
→ Continue working on the main task

**Type B — NO, but it's a quick fix (Detour, < 30 min):**
You cannot continue your current task without fixing this, but the fix is small and clear.
→ Tell the developer: "I found a blocker [X]. It's a quick fix. Fixing it now."
→ Add it to "Detours" section of `planning/ACTIVE.md`
→ Fix it
→ Mark it done in Detours with time spent
→ Return to the main task immediately

**Type C — NO, and it's a big problem (Blocker):**
The fix requires hours of work, a missing feature, or major rework across many files.
→ STOP. This is the ONLY case where you ask the developer.
→ Tell them: "I found a major blocker: [X]. This will take [estimate]. We should stop and decide: fix this first, or find a workaround."
→ Change `planning/ACTIVE.md` status to "⏸ Blocked"
→ Describe the blocker in the "Blockers" section

### 4. Continuous Memory Updates
Update `planning/ACTIVE.md` and `planning/JOURNAL.md` proactively — don't wait for the developer to ask:
- **After completing any task or subtask:** Update ACTIVE.md immediately. Suggest the next logical step.
- **After fixing a detour:** Log it in the Detours section with time spent. Resume the main task.
- **When the developer says they are stopping:** Update "Where I Left Off" with specific file, line, and state. Append a full entry to JOURNAL.md.
- **Always end with a recommendation:** "Next, I suggest we [X] because [Y]." — this ensures the next session (even with a different agent) knows what to do.

### 5. Architecture Rules
- Follow the REPOSITORY PATTERN: interfaces in `backend/src/repository/interfaces/`, Firestore implementations in `backend/src/infrastructure/firestore/repositories/`
- The project must remain SQL-MIGRATION-READY — no Firestore-specific code in domain/application layers
- Register new repositories in `backend/src/infrastructure/di/bindRepositories.ts`
- Backend is Express+TypeScript at `backend/`
- Frontend is React+TypeScript+Vite at `frontend/`

### 6. Plan Files
- Feature plans live in `planning/tasks/NN-feature-name.md`
- Completed work reports go in `planning/done/NN-completion-report.md`
- The master plan is at `planning/tasks/00-MASTER-PLAN.md`
- The module architecture spec is at `planning/SPEC.md`

### 7. Completion Reports
When a task is fully complete, create a completion report at `planning/done/` with:
- What was changed (files list)
- What was tested
- What acceptance criteria were met
- Any known issues or follow-ups

### 8. Mandatory Documentation
When completing ANY task, you must document your work. This documentation must be written in TWO distinct sections:
1. **Technical Developer View:** What the task was, how it affected the workflow/architecture, what files were touched, and exactly how it was fixed/built.
2. **End-User View:** A simple, user-friendly explanation of the feature or fix. This will be collected later to compile the final User Guide for the system launch.
*Append this dual documentation to the completion report in `planning/done/` or a dedicated `docs/` file if one exists for the feature.*

### 9. Time Estimation & Tracking
As the CTO, you MUST add timing to all jobs and tasks to organize the work effectively:
- **Planning:** When proposing a new task or plan, always provide an explicit time estimate.
- **Task Management:** When updating `planning/ACTIVE.md` or `planning/ROADMAP.md` with new jobs, always include the estimated time required for each task or subtask.
- **Tracking:** Track the actual time spent on tasks and log this in `planning/JOURNAL.md` and your Completion Reports.

---

## OpenCode Multi-Agent System

This project uses an OpenCode multi-agent workflow defined in `opencode.json`. The orchestrator is the primary agent and delegates to specialized subagents.

### CRITICAL: Clarification-First Protocol

**The orchestrator MUST NOT start implementation until every step and the final goal are super clear.**

1. **Clarify first.** If anything in the user's request is ambiguous, ask questions. Do NOT assume.
2. **Conflict check.** Before planning, check if the proposed change conflicts with existing architecture. If it does, STOP and tell the user before proceeding.
3. **Recommend agents.** After clarity, recommend whether multi-agent delegation is needed and which agents to use. Wait for user approval.

### Agent Roles

| Agent | Role | Can Edit? |
|-------|------|----------|
| `orchestrator` | Understands requests, asks clarifying questions, detects conflicts, recommends agent strategy, delegates, plans, assigns builders, reviews results | Yes (project-wide) |
| `erp-repo-explorer` | Read-only repository exploration, file finding, dependency mapping | No |
| `erp-backend-architect` | Read-only backend architecture + conflict detection | No |
| `erp-frontend-architect` | Read-only frontend architecture + conflict detection | No |
| `erp-api-contract` | Read-only API contract verification between frontend and backend | No |
| `erp-backend-builder` | Backend implementation after orchestrator approval | Backend only |
| `erp-frontend-builder` | Frontend implementation after orchestrator approval | Frontend only |
| `erp-reviewer` | Read-only code review of diffs | No |
| `erp-test-runner` | Read-only verification (build/test/lint) | No |

### Orchestrator Workflow

0. **Clarify** — Ask questions, resolve ambiguities, confirm goal understanding
1. **Conflict Check** — Delegate to architects to detect conflicts with existing arch
2. **Recommend Agents** — Propose which subagents to use, get user approval
3. **Restate** the user goal
4. **Inspect** relevant files (ACTIVE.md, JOURNAL.md, VISION.md)
5. **Analyze** — Delegate parallel read-only analysis to architect subagents
6. **Plan** with exact files, acceptance criteria, risks — get user approval
7. **Assign** implementation to ONE builder per file area (never overlap)
8. **Review** via `erp-reviewer`
9. **Verify** via `erp-test-runner`
10. **Document** for three audiences (see Documentation Structure below)
11. **Summarize** final results

### Architecture Red Lines

- **DO NOT start if anything is unclear — ASK FIRST**
- **DO NOT start if there's an architecture conflict — REPORT IT FIRST**
- Never mix Super Admin and tenant/company flows
- Never bypass DI to instantiate repositories directly
- Never put Firestore-specific code in domain/application layers
- Controllers must be thin — delegate to use cases
- Repository interfaces in `backend/src/repository/interfaces/`
- Firestore implementations in `backend/src/infrastructure/firestore/repositories/`
- Register new repos in `backend/src/infrastructure/di/bindRepositories.ts`
- Never hardcode plans, bundles, modules, or permissions
- Voucher Designer: UI/schema only, no dynamic posting scripts
- Dynamic Engine: postponed unless explicitly requested
- Only ONE builder edits a file area at a time

### System Core / Engine Red Lines (Epic 250 + follow-ups — enforced, not optional)

- **Modules orchestrate; engines own shared logic.** Application modules (sales/purchases/inventory/pos) must NOT embed or re-implement shared logic. It lives in `application/system-core/*`.
- **All GL posting goes through `IAccountingBridge`.** Never call `SubledgerVoucherPostingService.postInTransaction` or `PostingGateway.record` directly in new code.
  - Document vouchers → `SubledgerDocumentPoster` (constructed with the bridge).
  - Settlement/payment receipts → `bridge.recordPreBuiltVoucher(...)`.
  - The bridge owns the **full-vs-minimal** decision (no GL voucher when the Accounting App is disabled). The Accounting **Engine is mandatory**; the Accounting **App/UI is optional** — never conflate them.
- **New posting use-cases** accept `accountingBridge?: IAccountingBridge` as the **last** constructor param; the controller passes it via its `buildAccountingBridge(...)` helper.
- **Never construct `StockMovement` / `StockLevel` outside the inventory core.** Use `IInventoryCore` (`computeStockOutMovement` / `computeStockReturnInMovement`).
- **Line discount/amount math** → `CommercialCore.resolveLineDiscountAmount`. No new local discount helpers in entities.
- **Use the engines, don't re-derive:** tax → `TaxEngine`; money rounding → `system-core/money/roundMoney`; numbering → `INumberingEngine`; voucher-approval requirement → `IApprovalEngine`.
- **Promotions stay OFF in production.** Never remove or bypass `arePromotionsEnabledInProduction()`; do not enable until the stacking/cap model lands and is audited.
- **`SystemCoreBoundaries.test.ts` is the enforcement.** Run it. Never weaken, skip, or delete a guard to make a change pass — if it fails, your change is in the wrong layer.

### Engines vs Modules — the always-on rule

> **Engines own the truth and the rules that keep it true. Modules own the windows into that truth and one type of user's way of working with it.** Full framework + classification table: [docs/architecture/engines-vs-modules.md](docs/architecture/engines-vs-modules.md).

- **Engines are always on.** Constructed at boot, available to every tenant, gated only by *permission* — never by whether a module is enabled. The posting engine, stock engine, catalog, numbering, approval, tax, pricing, FX all act regardless of which module UIs are switched on.
- **Two flags, never conflated:** `initialized` = "engine has the data it needs" (a readiness fact; kept always-true by auto-init) — real work checks this. `isEnabled` = "user can see/reach this module's screens" (security + visibility) — must **never** gate engine behavior.
- **Four litmus tests** for any capability: (1) *turn the module off — must this still be correct?* → engine. (2) *will more than one module need it?* → engine (shared). (3) *is it the canonical record others depend on?* → engine owns the data. (4) *is it presentation / navigation / one user's workflow?* → module. A feature with both halves gets **split**.
- **Signals are engine-owned** (low-stock is just one example). If a consumer must *ask* the engine or be *warned* by it, that query/signal is the engine's; the widget is the module's.
- **🚩 A shared setting needs a doorway in EVERY module that uses it — not just one.** When an engine-owned policy/config is editable (a settings screen + an API route), hosting that doorway under a single module silently breaks the others. A user who has only module X enabled (every other module off) must still be able to **reach, view, and change** any shared setting that affects module X. Concretely: the API route must be reachable with that module's own permission and must **not** sit behind another module's `moduleInitializedGuard`/`isEnabled`; and the settings screen must exist inside that module too. The shared *store* stays single-source-of-truth — only the entry points are per-module. **Litmus: "If this tenant had ONLY the POS module enabled, could a POS-only user still set this?" If no, you have not finished the feature.** (We have repeatedly shipped shared settings reachable from only one module — treat this as a blocking defect, not a nicety.)
- **Open gaps (tracked):** posting still gates on `isEnabled` not `initialized` ([253](planning/tasks/253-posting-engine-always-acts.md)); item management still locked behind the Inventory module ([254](planning/tasks/254-items-stock-catalog-always-on.md)); FX duplicated across `core` + `accounting` ([255](planning/tasks/255-currency-fx-shared-engine.md)).

### New Feature — "Where does this logic go?" (decide BEFORE coding)

Before implementing any feature, classify each piece of logic:

1. **Is it shared / cross-cutting?** Ask: *"Would any other module ever need this?"* and *"Is it a calculation, policy, posting rule, or lifecycle rule — rather than orchestration?"* The cross-cutting concerns are: document lifecycle, numbering, money/rounding, tax, pricing/discounts/promotions, policy, approval, inventory costing/movements, GL posting (accounting bridge), audit.
   - **Yes → it belongs in System Core**, behind an interface — never inline in the module.
2. **Does an existing engine already own it?** (`IDocumentCore`, `INumberingEngine`, `IMoneyCore`, `ITaxEngine`, `ICommercialCore`, `IPolicyEngine`, `IApprovalEngine`, `IInventoryCore`, `IAccountingBridge`, `IAuditEngine`.)
   - **Yes → extend that engine** (interface + implementation + tests). Do not fork a local copy.
3. **A genuinely new shared concern no engine covers → create a new isolated engine:**
   - Define `I<Name>Core` in `application/system-core/contracts/`.
   - Implement in `application/system-core/<name>/`.
   - If it wraps working legacy code, add a `Legacy<Name>Adapter` (wrap it, don't rewrite — like `LegacyAccountingBridgeAdapter`).
   - Register in `bindRepositories.ts`; modules receive it by interface (optional param + fallback for behavior-preserving rollout).
   - **Add a guard to `SystemCoreBoundaries.test.ts`** so the boundary is enforced, not just documented.
   - Document it in `docs/architecture/system-core.md`.
4. **Module-specific orchestration only** (wiring engines together, request/response shaping, status transitions) → stays in the module's use-case. That's what modules are *for*.
5. **If the shared thing is user-configurable, plan its doorway in every consuming module up front.** A shared engine policy/config is not "done" when only one module can edit it. During planning, list every module that consumes it and give each its own settings entry point + API route (module-permission-gated, never behind another module's enablement). See the 🚩 rule above. Put this in the task plan, not as an afterthought.
6. **Unsure which bucket?** STOP and ask. Misplacing shared logic is the exact mistake Epic 250 existed to fix — guessing wrong is expensive to undo.

### Shared UI Components — MANDATORY REUSE

**Rule:** Whenever a form needs to capture a reference to existing master data (customer, item, warehouse, account, party, etc.), you MUST use the project's shared selector components. Free-text inputs for IDs are a data-integrity bug — they let users save garbage that breaks downstream posting.

**Where they live:**

`frontend/src/components/shared/selectors/`:
- `PartySelector` — for customer / vendor / party pickers (filter by `role` prop)
- `ItemSelector` — for inventory item pickers (auto-fills code, name, UoM, etc.)
- `WarehouseSelector` — for warehouse pickers
- `PartyAccountSelector` — for AR/AP sub-account pickers

`frontend/src/modules/accounting/components/shared/`:
- `DatePicker` — the project's only date picker. Honors company date format and fiscal calendar. Use everywhere instead of `<input type="date">`.

`frontend/src/components/ui/`:
- `ConfirmDialog` — MANDATORY for any state-changing or destructive user action (pause / resume / cancel / delete / post / void / etc.). Never trigger a server-side state change directly from a button click. Tone: `danger` for irreversible actions, `warning` for reversible, `info` for benign confirmations. Disable buttons while `isConfirming` is true.

### Report Pages — MANDATORY Pattern

**Rule:** Every report page MUST use `<ReportContainer>` from `frontend/src/components/reports/ReportContainer.tsx`, AND its route MUST appear in `frontend/src/config/moduleMenuMap.ts` under the module's `Reports` parent.

Enforced by `frontend/scripts/check-reports.mjs`, which runs as part of `npm run build`. PRs that violate either rule fail CI.

Why `ReportContainer` is non-negotiable:
- UI-mode aware (windows-mode routing happens automatically)
- Standard toolbar (refresh / filters / column visibility / Excel / PDF / print)
- Two-stage flow (filter → results) — predictable for users across all reports
- Density toggle, pagination, i18n built in

Pattern, sidebar wiring, and the temporary allowlist are documented in `docs/architecture/reports.md`. Read that before building a new report.

### Action Feedback — Toast on Every Result (MANDATORY)

**Every user-triggered action must produce a visible result.** Use `react-hot-toast` (already installed, `Toaster` mounted in `main.tsx`):

```ts
import toast from 'react-hot-toast';

// Success
toast.success('Invoice posted');

// Info (no-op, neutral result)
toast('No invoices due today', { icon: 'ℹ️' });

// Error — prefer this over setError state for transient feedback
toast.error('Failed to post invoice');
```

Rules:
- **Success** → `toast.success(...)` — always, even for deletes and status changes.
- **Info / no-op** → `toast(msg, { icon: 'ℹ️' })` — when the action succeeded but nothing changed (e.g. generate ran but nothing was due).
- **Error** → `toast.error(...)` — for transient API errors. Reserve `setError` state for persistent page-level errors that need a banner.
- **No silent actions.** A button that does something and then nothing appears to have is broken. Every click that triggers a server call must visually confirm it happened.
- This applies to ALL modules — Sales, Purchase, Accounting, Inventory, HR, AI, everything.

The selectors index is at `frontend/src/components/shared/selectors/index.ts`. Check both locations before building anything. (The `DatePicker` location is a historical accident — it's app-wide despite living under `accounting/`. Don't duplicate it.)

**Process:**
1. Before adding any picker, autocomplete, dropdown, or "ID + Name" input pair to a form, check `frontend/src/components/shared/selectors/` and grep for existing usage of the relevant selector in other modules.
2. If a shared selector exists → use it. Do not reinvent. Do not use raw text inputs for IDs.
3. If a shared selector does NOT exist for the entity you need → ASK THE USER before creating one. New shared components must be designed once to serve every module; ad-hoc per-page versions cause divergent UX and data quality bugs.
4. Same rule applies to date pickers, currency selectors, tax-code pickers, and any other "looks like a primitive but actually references master data" control. If there's a shared component, use it.

**Why this exists:** The Phase D.4 recurring-invoice form was built with raw text inputs for customer ID, item code, and item name. The backend accepted any string and saved templates that, when run by the scheduler, would produce SIs referencing non-existent master data — corrupting the GL silently. This rule prevents recurrence across all future features.

### Operational Safety Rules

1. **No Commit on Failure** — If any builder, reviewer, or test-runner step fails, do NOT commit. Revert or stash changes, report the failure, and wait for user instructions.

2. **Git Commit Protocol** — Never commit without asking the user first. Commit messages must reference the task from ACTIVE.md using conventional format (e.g., `feat(sales): add invoice PDF export [ACTIVE-42]`).

3. **Secrets Red Line** — Never read, display, or commit files containing secrets (.env, .env.*, serviceAccount*.json, *-secret*, *-credentials*, *-key.pem, API keys, tokens, passwords). If a secret is accidentally seen, ABORT and tell the user immediately.

4. **Task Size Cap** — If a task touches more than 8 files across more than 3 directories, the orchestrator MUST break it into smaller subtasks and get user approval for the breakdown.

5. **Incremental Commits** — After each subtask completes the full cycle (builder → reviewer → test-runner → approved), commit before starting the next subtask. Do NOT batch everything into one giant commit.

6. **Rollback Plan** — Before any implementation, note the current git status (branch, uncommitted changes). If something goes wrong, `git checkout -- .` can revert changes. Always know the rollback point.

7. **i18n Completeness** — Any new user-facing string in the frontend MUST be added to i18n translation files (`frontend/src/i18n/`), NOT hardcoded in components. The reviewer must check for this.

8. **Never Skip Clarification** — Even if a task seems simple, restate the goal and confirm understanding. Do not assume the user wants the same approach as a previous task.

### Documentation Structure

Every completed task MUST produce documentation for three audiences:

| Audience | Location | Purpose | Format |
|----------|----------|---------|--------|
| Solo Developer (product owner) | `planning/JOURNAL.md` + `planning/ACTIVE.md` | Track progress, decisions, next steps | Technical log with timestamps |
| Future Developers | `docs/architecture/` | Understand how and why things were built | Technical docs: architecture decisions, file maps, API contracts |
| End Users | `docs/user-guide/` | Understand how to use features | Plain language: what the feature does, how to use it, step-by-step |

Documentation rules:
- **Solo Developer docs**: Update `planning/JOURNAL.md` and `planning/ACTIVE.md` after every task. Include what was done, time spent, decisions made, and what's next.
- **Future Developer docs**: Create/update in `docs/architecture/` when changes affect architecture, data models, API contracts, or shared patterns. Include: what changed, why, file map, migration notes.
- **End User docs**: Create/update in `docs/user-guide/` when features are added or UI changes. Include: feature name, what it does, how to use it (step by step), who can access it.
- Completion reports in `planning/done/` should contain BOTH technical and end-user sections.

### Prompt Files

Detailed agent instructions live in `.opencode/prompts/`:
- `orchestrator-workflow.md` — orchestrator's step-by-step process (includes clarification protocol)
- `sub-repo-explorer.md` — repo explorer instructions
- `sub-backend-architect.md` — backend architecture checklist
- `sub-frontend-architect.md` — frontend architecture checklist
- `sub-api-contract.md` — API contract verification process
- `sub-backend-builder.md` — backend implementation rules
- `sub-frontend-builder.md` — frontend implementation rules
- `sub-reviewer.md` — code review checklist
- `sub-test-runner.md` — verification commands and output format

## graphify (Supplementary — does NOT replace the workflow above)

This project has a graphify knowledge graph at `graphify-out/`.

**Hierarchy:** ACTIVE.md → JOURNAL.md → VISION.md remain the **primary** source of truth for task status and project direction. The graphify graph is a **supplementary tool** for understanding code structure and cross-module relationships. It does NOT replace reading source files when implementing features.

**When to use graphify:**
- Cross-module architecture questions ("how does Sales connect to Accounting?") → `graphify query "<question>"` or `graphify path "<A>" "<B>"`
- Exploring unfamiliar parts of the codebase → `graphify explain "<concept>"`
- Quick orientation on god nodes and community structure → read `graphify-out/GRAPH_REPORT.md`

**When NOT to use graphify:**
- Finding a specific function, class, or file → use grep/glob (faster, exact)
- Understanding task status or what to work on next → read ACTIVE.md
- Implementation work → read the actual source files, not the graph

**Maintenance:**
- After modifying code files in a session, run `graphify update .` to keep the graph current (AST-only, no API cost)
- The graph is committed to git so all agents share the same map

---

## Multi-Agent Coordination Protocol

This project is worked on by multiple agents (Claude Code, Codex, OpenCode, Cowork) and from multiple devices. All coordination is git-based — no real-time communication between agents exists. Follow this protocol to avoid collisions and wasted work.

### Files You Must Read

| File | Purpose |
|------|---------|
| `planning/PRIORITIES.md` | What to work on — in order. Read this before picking a task. |
| `planning/QA-QUEUE.md` | Features ready for Mahmud to test. Add items here when you finish a feature. |
| `planning/ACTIVE.md` | Current task detail + where we left off. |
| `planning/JOURNAL.md` | Session history. Always append your session summary here. |

### Before Starting Any Work

1. `git pull` to get the latest state
2. Read `planning/PRIORITIES.md` — pick the top unlocked item
3. Check the **Task Lock** table in `planning/PRIORITIES.md` — if someone is already on it, pick the next item
4. Add yourself to the Task Lock table before starting

### After Finishing Any Work

1. Remove yourself from the Task Lock table (or mark ✅ Done)
2. If the feature is user-facing and testable, add it to `planning/QA-QUEUE.md`
3. Append a session summary to `planning/JOURNAL.md`
4. Update `planning/ACTIVE.md` with the next task
5. Update `planning/PRIORITIES.md` if the priority order has changed
6. Commit everything: `git add -A && git commit -m "feat: ..."`

### Writing Briefs for Other Agents

If you finish a task and the natural next step is better suited for a different agent (e.g., you've done backend work and the frontend needs wiring), write a brief in `planning/briefs/`:

```
planning/briefs/YYYYMMDD-<target-agent>-<topic>.md
```

Format:
```markdown
# Brief: [What needs doing]
**For:** [Codex / Claude Code / OpenCode / Cowork]
**From:** [your agent name]
**Date:** YYYY-MM-DD

## Context
[What was just built, why this next step is needed]

## Task
[Specific, actionable instructions — files to edit, behavior expected]

## Definition of Done
[How to know it's finished]
```

The receiving agent reads this brief at session start and acts on it.

### What NOT to Do

- Do NOT start work without checking PRIORITIES.md and the Task Lock
- Do NOT skip updating QA-QUEUE.md when a feature is testable
- Do NOT skip JOURNAL.md — it is the handoff record for Mahmud and other agents
- Do NOT leave ACTIVE.md pointing at a completed task

### Upgrade Path (MCP)

The current protocol is intentionally file-based and simple. If coordination becomes painful (collisions, stale locks, wasted work), see `docs/architecture/agent-coordination.md` for the MCP upgrade path.
