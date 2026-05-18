# AI Assistant Fixing Plan — Agent Execution Prompt

Copy everything below the line and paste it as your prompt to the executing agent.

---

## Your Task

You are executing a pre-approved, CTO-audited fixing plan for the ERP03 AI Assistant subsystem. The plan is split across two documents:

1. `docs/architecture/ai-assistant-fixing-plan.md` — Phases 1-5
2. `docs/architecture/ai-assistant-fixing-plan-part2.md` — Phases 6-9

## Mandatory Rules

1. **Read both plan documents FULLY before writing any code.**
2. **Follow the plan EXACTLY.** Every task specifies: files to touch, exact changes, and acceptance criteria. Do not invent features, refactor beyond scope, or skip tasks.
3. **Work ONE phase at a time, in order.** Do not jump ahead.
4. **After completing each phase**, run `tsc --noEmit` on backend and `npm run build` on frontend to verify. Fix any type errors before moving to the next phase.
5. **After completing each phase**, update `ACTIVE.md` with what was done and what phase is next.
6. **Do NOT modify any files outside of what the plan specifies** unless it's a direct import/type dependency required by the planned change.
7. **Do NOT rename, reorganize, or "improve" existing code** that isn't mentioned in the plan.
8. **If you encounter a blocker** (e.g., a dependency doesn't exist, a file path is wrong, a type doesn't match), STOP and report the exact issue. Do not work around it silently.
9. **All new user-facing strings in frontend** must go into `frontend/src/i18n/` translation files, never hardcoded.
10. **The CTO will audit your work** by diffing against the plan. Any unplanned change will be flagged and may be reverted.

## Phase Order

```
Phase 1: Business Model Fix (remove PLATFORM_MANAGED → credit system)
Phase 2: Security Hardening (prompt injection, concurrent locks)
Phase 3: Core Architecture (overflow guard, truncation, god class breakup)
Phase 4: Prompt & Skill Improvements (language, keywords, lightweight mode)
Phase 5: Certification (auto-certify, behavioral tests)
Phase 6: UX (streaming, quick actions, conversations, feedback, errors, wizard)
Phase 7: Operational (per-user limits, retention, dashboard, entitlement)
Phase 8: Testing (real provider smoke tests)
Phase 9: Deployment prep (checklist verification)
```

## How To Start

1. Read `ACTIVE.md` and `JOURNAL.md` for current project status.
2. Read `docs/architecture/ai-assistant-fixing-plan.md` completely.
3. Read `docs/architecture/ai-assistant-fixing-plan-part2.md` completely.
4. Start with Phase 1, Task 1.1.
5. Present your plan for Phase 1 and ask for approval before writing code.

## Important Context

- Backend: Express + TypeScript at `backend/`
- Frontend: React + TypeScript + Vite at `frontend/`
- Repository pattern: interfaces in `backend/src/repository/interfaces/`, Firestore implementations in `backend/src/infrastructure/firestore/repositories/`
- Register new repositories in `backend/src/infrastructure/di/bindRepositories.ts`
- The project has NEVER been deployed. This is pre-alpha work.
- Branch: `feat/ai-proposal-sandbox`

Begin.
