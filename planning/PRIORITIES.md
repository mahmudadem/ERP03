# ERP03 — Agent Priorities

> **All agents read this file at session start.**
> It is the single source of truth for what to work on next.
> After completing any item, update this file and append to `planning/JOURNAL.md`.

---

## 🔴 Current Priority (work this first)

**Phase F — Purchase Price Lists** (~1-2 days)
- Branch: next branch after `codex/phase-f-vendor-groups`
- Add optional vendor/item price list master data for Purchases parity
- Keep pricing behavior explicit and auditable; do not silently alter posted PI amounts

---

## 🟡 Up Next (in order)

1. **Phase F — RFQ** (~2-3 hours)

2. **Phase G — Purchases-specific** (three-way match + vendor master, ~3–4 days)

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
| Codex | Phase F - PI Attachments | 2026-05-28 | ✅ Done |
| Codex | Phase F - Vendor Groups | 2026-05-28 | ✅ Done |

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

_Last updated: 2026-05-28 by Codex (Vendor Groups done; Purchase Price Lists next)_
