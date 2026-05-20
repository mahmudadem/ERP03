# 🎯 Current Focus

**Task:** Phase A (sales master data & pricing) — **CODE + DOCS COMPLETE; awaiting Phase A manual QA**
**Status:** ✅ COMPLETE (pending live browser QA)
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [planning/tasks/sales-and-purchases-completion-roadmap.md](./tasks/sales-and-purchases-completion-roadmap.md)
**Done report:** [planning/done/108-phase-a-master-data-pricing.md](./done/108-phase-a-master-data-pricing.md)

## Where we are

Phase A of the sales completion roadmap is built, type-clean, and unit-tested (94 new tests). Delivered: price lists with tiered pricing, customer groups, customer credit settings, salespersons + commission ledger, tax-inclusive pricing fix, full backend API, and the frontend pages + customer-card extension.

Two commits so far on the path:
- `8012c41a` on `fix/project-responsiveness` — the 6 alpha-readiness P0 PRs + roadmap
- Phase A work is currently **uncommitted** on `feat/phase-a-sales-master-data` (47 files)

## Before Phase B — manual QA gate

Run the live browser checks in the done report (§ "Manual QA gate"): price-list auto-pricing, volume tiers, tax-inclusive math, commission accrual, customer-card fields. The roadmap makes this the accountant's acceptance gate for Phase A.

## Known follow-ups carried into Phase B

- Wire `AccrueCommissionForInvoiceUseCase` to be called automatically after `postSI` (endpoint exists; controller call missing).
- Credit-hold enforcement at SO confirm (Phase B proper).
- `GetEffectivePrice` does not walk customer-group price-list inheritance yet.
- 3 pre-existing `SendChatMessageUseCase` test failures (AI-assistant credits) — unrelated, flagged for separate fix.

## Sequence (remaining)

1. ✅ **Phase A** — Sales master data + pricing — DONE (this report)
2. **Phase B** — Sales operational (quotations, credit-limit enforcement, promotions, backorder UX, delivery scheduling) — 5-6 days
3. **Phase C** — Sales finance & reporting — 7-9 days
4. **Phase D** — Sales auditability (GL Impact UI, period lock, recurring invoices, etc.) — 8-10 days
5. **Phase E** — Sales cross-cutting cleanup — 6-8 days
6. **⏸ Sales QA cycle** — 1-2 weeks
7. **Phase F** — Purchases parity — 4-5 days
8. **Phase G** — Purchases-specific (three-way match + vendor master) — 3-4 days
9. **⏸ Purchases QA cycle** — 1 week
10. **Phase H** — Final hardening — 1 week

## Next action

User runs Phase A browser QA, then signals **"start Phase B"**. First Phase B item: Quotations entity (Quote → SO conversion).
