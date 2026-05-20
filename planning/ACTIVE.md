# 🎯 Current Focus

**Task:** Sales & Purchases completion roadmap — **decisions locked, awaiting "go" signal for Phase A**
**Status:** 📋 PLAN READY
**Branch:** `fix/project-responsiveness`
**Plan:** [planning/tasks/sales-and-purchases-completion-roadmap.md](./tasks/sales-and-purchases-completion-roadmap.md)

## Where we are

All six P0 architectural gaps from the alpha-readiness plan are closed (tasks 102-107). The next task is **feature-completing Sales first, then Purchases parity, then ship alpha** — no fixed deadline, manual QA gate after every phase.

## Decisions locked (2026-05-20)

| # | Question | Answer |
|---|---|---|
| 1 | Launch market for Purchases | **Defer** — no region-specific features in alpha |
| 2 | Salesperson + commissions | **In scope** — Phase A |
| 3 | Recurring invoices | **Both** — templated + scheduled, Phase D |
| 4 | Customer portal | **Defer to V2** |
| 5 | E-invoice clearance (Fatoora/IRN/SDI) | **Defer** — re-add per launch market |

## Sequence

1. **Phase A** — Sales master data + pricing (price lists, customer groups, credit settings, salesperson+commissions, tax refinement) — 4-5 days
2. **Phase B** — Sales operational (quotations, credit enforcement, promotions, backorder, scheduling) — 5-6 days
3. **Phase C** — Sales finance & reporting (AR aging, customer statements, ledger, sales reports, backend P&L, inventory valuation) — 7-9 days
4. **Phase D** — Sales auditability (GL Impact UI, period lock, audit log, recurring invoices, return enhancements, attachments, email) — 8-10 days
5. **Phase E** — Sales cross-cutting cleanup (closes PR2/PR5/PR6 follow-ups + round-trip tests + reconciliation) — 6-8 days
6. **⏸ Sales QA cycle** — 1-2 weeks
7. **Phase F** — Purchases parity (mirror Sales work onto PI/GRN/PR) — 4-5 days
8. **Phase G** — Purchases-specific (three-way match + vendor master polish only; landed cost/WHT deferred) — 3-4 days
9. **⏸ Purchases QA cycle** — 1 week
10. **Phase H** — Final hardening (perf, security deploy, reconciliation, backup, docs) — 1 week

**Total: ~2.5 months** (was 3 months — Phase G pruning saved ~2 weeks)

## Next action

User signals **"start Phase A"** → I begin with price lists + customer groups (the foundation everything else needs).

## Previous task

**Alpha-readiness P0 remediation** — all 6 PRs complete. See completion reports 102-107 in `planning/done/`.
