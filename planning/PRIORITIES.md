# ERP03 — Agent Priorities

> **All agents read this file at session start.**
> It is the single source of truth for what to work on next.
> After completing any item, update this file and append to `planning/JOURNAL.md`.

---

## 🔴 Current Priority (work this first)

**Phase E — Sales cross-cutting cleanup** (~6–8 days)
- Branch: `feat/phase-a-sales-master-data`
- Promotion evaluator auto-invoked in SO/SI creation
- Credit check on direct SIs (not just SO confirm)
- Backorder / partial-fulfillment frontend UX
- Quote sequence numbering (replace `Q-<timestamp>` fallback)
- AI-assistant test suite stabilization (4 failing tests)
- See `planning/tasks/sales-and-purchases-completion-roadmap.md` for full spec

---

## 🟡 Up Next (in order)

1. **Sales QA Cycle** — user (Mahmud) manually tests all Sales features
   - See `planning/QA-QUEUE.md` for what's ready to test

2. **Phase F — Purchases parity** (~4–5 days)

3. **Phase G — Purchases-specific** (three-way match + vendor master, ~3–4 days)

---

## 🚫 Do NOT work on (deferred / blocked)

| Item | Reason |
|------|--------|
| Full free-canvas invoice designer | Deferred — controlled template model in use |
| Email delivery execution | Follow-up channel, deferred post-D.8 |
| `record_change_logs` Firestore index | Ready, awaiting production deploy |

---

## 🔒 Task Lock (prevent collisions between agents)

If you are starting work on a priority item, record it here so other agents don't duplicate:

| Agent | Task | Started | Status |
|-------|------|---------|--------|
| _(none active)_ | — | — | — |

**How to use:**
1. Before starting, add a row with your agent name, task, and today's date
2. When done, mark Status = ✅ Done and move the item to `planning/done/`
3. Update `planning/ACTIVE.md` and append to `planning/JOURNAL.md`

---

## 📋 Carry-forward Rabbit Holes

These are known issues that don't block current work. Do not fix unless specifically tasked:

- Commission accrual auto-wired (B.0) — not yet auto-invoked in SO/SI
- Credit-hold enforcement live (B.2) — not on direct SIs
- `record_change_logs` composite index in `firestore.indexes.json` — needs production deploy
- D.2 period-lock override UI missing on SO detail page (History button present, no posting)
- AI-assistant: 3 test failures in `SendChatMessageUseCase` + 1 in `AiModelCertificationUseCase`

---

_Last updated: 2026-05-24 by Claude Code (D-phase commit + Phase E activation)_
