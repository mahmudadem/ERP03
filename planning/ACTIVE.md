# 🎯 Current Focus

**Task:** Sales completion roadmap — **Phases A ✅ B ✅ C ✅ D.2 ✅ D.3 ✅ D.4 ✅ D.5 ✅ D.6 ✅ D.7 ✅ D.8 ✅ + D.8 multi-tenant hardening ✅ + D.8 Telegram execution ✅**
**Status:** running phases autonomously (manual QA gates deferred per user instruction)
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [planning/tasks/sales-and-purchases-completion-roadmap.md](./tasks/sales-and-purchases-completion-roadmap.md)
**Done reports:** [108 — Phase A](./done/108-phase-a-master-data-pricing.md), [109 — Phase B](./done/109-phase-b-sales-operational.md), [110 — Phase C](./done/110-phase-c-sales-finance-reporting.md), [111 — Phase D.2+D.3](./done/111-phase-d-period-lock-audit-log.md), [112 — Phase D.4](./done/112-phase-d4-recurring-invoices.md), [113 — Phase D hardening audit](./done/113-phase-d-audit-hardening.md), [114 — Phase D.5 sales-return enhancements](./done/114-phase-d5-sales-return-enhancements.md), [115 — Phase D.7 invoice templates](./done/115-phase-d7-invoice-templates.md), [116 — Phase D.8 WhatsApp outbound messaging](./done/116-phase-d8-whatsapp-outbound-messaging.md), [117 — D.8 multi-tenant sender-accounts hardening](./done/117-d8-multitenant-messaging-hardening.md), [118 — D.8 Telegram outbound execution](./done/118-d8-telegram-outbound-execution.md), [119 — Phase D.6 invoice attachments](./done/119-phase-d6-invoice-attachments.md)

## Where we are

Phases A, B, C are built, type-clean, and unit-tested. Phase D control stack is now complete: D.2 Period Lock, D.3 per-record audit log, D.4 recurring invoices, D.5 sales-return enhancements, D.6 invoice attachments, D.7 controlled invoice templates, and D.8 outbound messaging.

Latest hardening (report 117) corrected D.8 architecture to true multi-tenant behavior:
- per-company sender accounts in `Sales Settings -> Communications`
- encrypted per-account credentials
- multiple sender accounts per company with default/active routing
- invoice send modal supports sender selection per message

Phase D is now functionally closed. Email delivery execution remains a follow-up channel under the tenant-scoped provider/account abstraction.

Commits on `feat/phase-a-sales-master-data`:
- `5949f314` — Phase A (master data & pricing)
- `4e9ce801` — Phase B.0–B.3 checkpoint
- `b9718462` — Phase B.4–B.6
- _(pending)_ — Phase C
- _(pending)_ — Phase C/D commits not yet finalized in this branch snapshot

## Carried-forward follow-ups

- Promotion evaluator built + tested but not auto-invoked in SO/SI creation.
- Credit check enforced at SO confirm only — not on direct SIs.
- Backorder / partial-fulfillment frontend UX deferred.
- Quote numbering uses a `Q-<timestamp>` fallback (no sequence in SalesSettings).
- Commission accrual auto-wired (B.0); credit-hold enforcement live (B.2).
- AI-assistant test failures currently present in full suite: 3 in `SendChatMessageUseCase` (credits/runtime-mode path) + 1 in `AiModelCertificationUseCase` (global recommended query expectation). Unrelated to Sales D8 but now tracked for stabilization.
- D.2 period-lock override UI wired on SI/DN/SR detail pages; SO detail page has History button but no posting (SO confirm already has credit-override flow).
- `record_change_logs` Firestore composite index added to `firestore.indexes.json` — must be deployed before production use.
- `PeriodLockService` is now wired into `buildAccountingPostingService()` — enforcement is live for all Sales posting paths.
- D.7 full free-canvas/sketch-board invoice designer is deferred; current model is controlled template selection via Forms Designer templates.

## Sequence (remaining)

1. ✅ **Phase A** — Sales master data + pricing — DONE (report 108)
2. ✅ **Phase B** — Sales operational — DONE (report 109)
3. ✅ **Phase C** — Sales finance & reporting — DONE (report 110)
4. ✅ **Phase D** — Sales auditability & control
   - ✅ D.1 GL Impact modal (pre-built, i18n fixed)
   - ✅ D.2 Period lock date (built + audited + 14 fixes applied)
   - ✅ D.3 Per-record audit log (built + audited + 14 fixes applied)
   - ✅ D.4 Recurring invoices (templated + scheduled, 19 tests)
   - ✅ D.5 Sales-return enhancements — DONE (report 114)
   - ✅ D.6 Document attachments — DONE (report 119)
   - ✅ D.7 Multiple invoice templates (controlled model) — DONE (report 115)
   - ✅ D.8 Outbound messaging — DONE as WhatsApp-first integration (report 116)
   - ✅ D.8 hardening — multi-tenant sender account isolation + encrypted per-company credentials (report 117)
   - ✅ D.8 follow-up — Telegram outbound execution (report 118)
5. **Phase E** — Sales cross-cutting cleanup — 6-8 days
6. **⏸ Sales QA cycle** — for the user when available
7. **Phase F** — Purchases parity — 4-5 days
8. **Phase G** — Purchases-specific (three-way match + vendor master) — 3-4 days
9. **Phase H** — Final hardening — 1 week

## Next action

Start Phase E cross-cutting cleanup next (estimated 6-8 days): close carried-forward operational gaps, stabilize broader regression signals, and prepare Sales for QA handoff. Email channel can be added later without refactor through the D.8 messaging provider abstraction.
