# ERP03 — Agent Priorities

> **All agents read this file at session start.**
> It is the single source of truth for what to work on next.
> After completing any item, update this file and append to `planning/JOURNAL.md`.

---

## 🔴 Current Priority (work this first)

**Visual QA + commit report 136 + design note** (~15 min)
- Code is in. Confirm `Documents` is now `Forms`, the new `Default Forms` group renders activated defaults, and cloned forms still appear under their user-chosen group.
- Commit the sidebar policy change and the migration design note together.

---

## 🟡 Up Next (May-30 roadmap, in order)

1. **Native → Default forms migration — first voucher type** (Sales Invoice (Direct), ~1 day to start). Drives item #5. Follow [tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md): fill in the capability matrix for SI Direct, identify the smallest missing Field Library component, ship it, repeat. Single-voucher-type slices, no big-bang.
2. **#3 Shared Account Selector standardization + filtering** — selector contract exists ([done/64](./done/64-invoice-party-account-selector-contract.md)); project-wide enforcement is unstarted. Folded into [Task 132](./tasks/132-ux-layout-production-hardening.md) Phases 0.5 + 5.
3. **#6 + #7 design notes** — Cost & historical-margin layer, Per-party item history + price-source engine. Architectural pair, neither has a spec. Single design doc covering line-snapshot data shape before either is built.
4. **#2 + #4 UI consistency / maturity pass** — Task 132 implementation phases. Last because it touches the same files the above work would change.
5. **Task 135 — Field Library drift warnings** (~2-4 hours): add `fieldVersionsSeen` and company-form drift notices. Closes Task 135.
6. **Phase F — RFQ** (~2-3 hours): Request for Quotation — procure-to-pay workflow parity.
7. **Phase G — Purchases-specific** (three-way match + vendor master, ~3–4 days)

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
| Antigravity | Phase F - Purchase Price Lists | 2026-05-28 | ✅ Done |
| Codex | Task 135 - Field Library Phase C1 | 2026-05-30 | ✅ Done |
| Codex | Task 135 - Field Library Phase C2 | 2026-05-30 | ✅ Done |
| Claude (Opus 4.7) | Sidebar form grouping policy + migration design | 2026-05-30 | ✅ Done (pending QA + commit) |

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

_Last updated: 2026-05-30 by Claude Opus 4.7 (sidebar form grouping policy implemented; migration design note saved; visual QA + commit next)_
