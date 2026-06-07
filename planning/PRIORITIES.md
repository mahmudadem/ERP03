# ERP03 — Agent Priorities

> **All agents read this file at session start.**
> It is the single source of truth for what to work on next.
> After completing any item, update this file and append to `planning/JOURNAL.md`.

---

## 🔴 Current Priority (work this first)

**Task 167 Apex shell production candidate migration** — the shell strategy has pivoted away from patching Apex styling onto the legacy shell. Apex should be hardened separately, validated against real tenant/RBAC/data contracts, and only then cut over as the main tenant shell.

Concrete next step: **[Task 167](./tasks/167-apex-shell-production-migration.md) Slice 3D** — add an Apex tenant-shell feature flag and run full role/module/empty-tenant cutover QA now that Sales, Purchases, Inventory, Settings/RBAC, AI, and Company Settings native mounting slices are complete. See [planning/briefs/20260605-apex-route-page-coverage-matrix.md](./briefs/20260605-apex-route-page-coverage-matrix.md). Estimated 2-4 hours.

---

## 🟡 Up Next (v1, in order)

1. **Task 167 Slice 3D** — Apex feature flag integration, role/bundle navigation permissions checks, empty data checks.
2. **Task 132 remaining chrome work** — resume only after the Apex route strategy is clear, because the shell direction has changed from legacy-shell styling to Apex-native hardening.
3. **Native QA passes** — once chrome is stable, retest every native voucher flow per module (Sales → Purchases → Accounting → Inventory). One module per session. Findings into `planning/done/138-…` reports.
4. **Native UI-mode per-voucher polish** — hardcoded web-mode + Windows card/window-mode renderings for each native voucher page. Task 132 Phase 4.5 standard.
5. **#3 Shared Account Selector standardization + filtering** — selector contract exists ([done/64](./done/64-invoice-party-account-selector-contract.md)); enforcement folds into Task 132 Phases 0.5 + 5.
6. **[Task 176](./tasks/176-unified-line-items-table-skins.md) — Unified line-items table: one component, two skins.** PI is the only voucher using `ClassicLineItemsTable`; migrate SI / SO / SR / PR / GVR so every voucher shares the same table with a user-flippable Classic/Modern skin. Five sessions, one voucher per session.
7. **[Task 177](./tasks/177-si-pi-detail-page-redesign.md) — SI & PI detail page redesign (compact layout, shared table for SI, fixed Settlement card, posted-view treatment, severity-driven ErrorModal, fix SI phantom empty rows).** Last visual blocker before SI/PI ship. All math, posting, tax-account, approval, and error contracts are already correct — this is purely the layout/visual polish layer. UI agent only.
8. **[Task 178](./tasks/178-subledger-document-poster-refactor.md) — `SubledgerDocumentPoster` refactor (backend).** Consolidate the duplicated middle layer of SI / PI / SR / PR posting into one service so future cross-cutting bugs are one-place fixes, not four. ~1–2 days. **Should land before Phase F + G** so they don't add a 5th and 6th parallel copy.
8b. **[Task 179](./tasks/179-editing-posted-documents.md) — Editing posted documents.** Phase 0 ✅ done (non-financial fields editable on POSTED, financial blocked, PI audit added — report 181). Phases 1–6 open: financial-field flag, layered Mode A/B edit policy, `isFieldEditable` helper, first-class Reverse for SI/PI, Mode A amend-and-repost (depends on 178), edge-case guards. Backend + UI (177).
9. **Phase F — RFQ** (~2–3 hours): Request for Quotation — procure-to-pay parity. Still a v1 must-have for Purchases.
10. **Phase G — Purchases-specific** (three-way match + vendor master, ~3–4 days). v1 if buyer-critical, else defer.
11. **[Task 182](./tasks/182-purchases-parity-discounts-landed-costs.md) — Purchases parity: vendor discounts + landed costs.** PI is under-built vs SI (no line discounts, no charges/landed-cost capitalization). The substance behind Phase G's "make Purchases first-class". Rides on Task 178 (new posting entries go through the shared poster). NOTE: COGS stays sale-side — do not add it to PI.

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
| Codex | Task 132 - Settings/list standardization slices 143-145 | 2026-05-30 | ✅ Done |
| Codex | Task 132 - Raw date input cleanup | 2026-05-30 | ✅ Done |
| Antigravity | Sales Invoice Refinement Page (Detail & List) | 2026-05-31 | ✅ Done |
| Codex | Purchase direct invoicing governance fix | 2026-06-01 | ✅ Done |
| Codex | AI floating launcher settings toggle | 2026-06-02 | ✅ Done |
| Antigravity | Unify Windows UI MDI window wrappers & drag/resize | 2026-06-03 | ✅ Done |
| Antigravity | Stage 2b Posting-Authority decoupling & reactive approvals | 2026-06-03 | ✅ Done |
| Claude (Opus 4.7) | Posting-Authority Stages 2c / 3 / 4 / 5 / 6 / 7 (F8 reporting decoupling) | 2026-06-03 | ✅ Done |
| Antigravity | Register Apex Ledger mockup route /dev/apex-ledger | 2026-06-04 | ✅ Done |
| Antigravity | Integrate Apex Ledger mockup route with live APIs & AI | 2026-06-04 | ✅ Done |
| Antigravity | Re-wire Apex Ledger dashboard subrouting and Voucher parity | 2026-06-04 | ✅ Done |
| Antigravity | Compact Layout Mode Integration | 2026-06-04 | ✅ Done |
| Codex | Task 167 - Apex shell production candidate migration | 2026-06-04 | ✅ Done (Slice 1) |
| Antigravity | Task 167 Slice 2 - Apex route coverage & QA | 2026-06-04 | ✅ Done |
| Antigravity | Task 167 - Apex shell RTL layout support fixes | 2026-06-05 | ✅ Done |
| Codex | Task 167 Slice 3A - Apex route/page coverage matrix | 2026-06-05 | ✅ Done |
| Codex | Task 167 Slice 3B - Apex route/sidebar adapter | 2026-06-05 | ✅ Done |
| Codex | Task 167 Slice 3C-Sales - native page mounting inside Apex | 2026-06-05 | ✅ Done |
| Codex | Task 167 Slice 3C-Purchases/Inventory - native page mounting inside Apex | 2026-06-05 | ✅ Done |
| Codex | Task 167 Slice 3C-Settings/RBAC/AI - native page mounting inside Apex | 2026-06-06 | ✅ Done |
| Antigravity | RTL flyout positioning & Contrast sidebar preset visual hardening | 2026-06-05 | ✅ Done |


**How to use:**
1. Before starting, add a row with your agent name, task, and today's date
2. When done, mark Status = ✅ Done and move the item to `planning/done/`
3. Update `planning/ACTIVE.md` and append to `planning/JOURNAL.md`
4. Commit everything: `git add -A && git commit -m "feat: ..."`

---

## 📋 Carry-forward Rabbit Holes

These are known issues that don't block current work. Do not fix unless specifically tasked:

- Commission accrual auto-wired (B.0) — not yet auto-invoked in SO/SI
- Credit-hold enforcement live (B.2) — not on direct SIs
- `record_change_logs` composite index in `firestore.indexes.json` — needs production deploy
- D.2 period-lock override UI missing on SO detail page (History button present, no posting)
- AI-assistant: 3 test failures in `SendChatMessageUseCase` + 1 in `AiModelCertificationUseCase`

---

_Last updated: 2026-06-06 — Task 167 Slice 3C-Settings/RBAC/AI native page mounting inside Apex is complete. Next priority is Slice 3D feature flag and cutover QA._
