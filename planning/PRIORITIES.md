# ERP03 — Agent Priorities

> **All agents read this file at session start.**
> It is the single source of truth for what to work on next.
> After completing any item, update this file and append to `planning/JOURNAL.md`.

---

## 🔴 Current Priority (work this first)

**v1 native QA + polish pass** — natives are the v1 surface. Before any new feature work, retest every native voucher flow per module and capture findings.

Concrete next step: pick a module (Sales recommended) and walk every native flow — create / edit / post / pay / cancel / void / send / attach / audit / period-lock override / credit override. Save findings in `planning/done/138-native-qa-pass-sales.md`.

---

## 🟡 Up Next (v1, in order)

1. **Native QA passes** — Sales, then Purchases, then Accounting, then Inventory. One module per session.
2. **Native UI-mode awareness** — hardcode web-mode + Windows card/window-mode renderings for each native page. Standard in [Task 132](./tasks/132-ux-layout-production-hardening.md) Phase 4.5.
3. **Task 132 phases (re-aimed for v1)** — shell cleanup, sidebar IA polish, settings taxonomy, action safety, RTL/i18n. Skip phases that imply default-driven UIs.
4. **#3 Shared Account Selector standardization + filtering** — selector contract exists ([done/64](./done/64-invoice-party-account-selector-contract.md)); project-wide enforcement still unstarted. Folded into Task 132 Phases 0.5 + 5.
5. **Phase F — RFQ** (~2–3 hours): Request for Quotation — procure-to-pay parity. Still a v1 must-have for Purchases.
6. **Phase G — Purchases-specific** (three-way match + vendor master, ~3–4 days). v1 if buyer-critical, else defer.

---

## ⏸ Deferred to v2 (preserved, no code removed)

- **Native → Default forms migration** ([tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md)) — all tiers, all voucher types.
- **SI Direct capability audit** ([tasks/137-si-direct-capability-audit.md](./tasks/137-si-direct-capability-audit.md)) — stays valid as the v2 starting point.
- **Task 135 — Field Library drift warnings** — only relevant once defaults are the primary surface.
- **#6 + #7 design notes** — Cost & historical-margin layer + Per-party item history / price-source engine. Architectural pair; revisit when v1 ships.

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
| Claude (Opus 4.7) | Sidebar form grouping policy + migration design | 2026-05-30 | ✅ Done (committed cbe52066) |
| Claude (Opus 4.7) | SI Direct capability audit | 2026-05-30 | ✅ Done (committed 29ff4aac) |
| Claude (Opus 4.7) | v1 strategy pivot + Default Forms sidebar hide | 2026-05-30 | ✅ Done (pending commit) |

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

_Last updated: 2026-05-30 by Claude Opus 4.7 (v1 strategy adopted: natives are headline surface, defaults deferred to v2; Default Forms sidebar group hidden)_
