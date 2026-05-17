# 34 — GAP Audit Fixes (Phased Plan)

> **Priority:** P0 → P2 (phased)
> **Source:** [GAP Audit Report](../../.gemini/antigravity/brain/baa02fa0-9658-4c3d-ab11-3fcb6b93fe54/gap_audit_report.md)
> **Date:** 2026-03-04
> **Estimated Total Effort:** 5–8 days across 4 phases

---

## Overview

This plan addresses 12 findings from the GAP Audit. The fixes are **backend-only** (no frontend changes). They are organized into 4 phases, ordered by blast radius and accounting-integrity risk. **Each phase must be audited before starting the next.**

### Phase Summary

| Phase | Focus | Claims Fixed | Effort | Risk Level |
|-------|-------|-------------|--------|------------|
| **Phase 1** | Transaction Atomicity | B, C | 1 day | 🔴 P0 — Data corruption |
| **Phase 2** | Accounting Consistency | D, L, A | 2 days | 🔴 P0 — Wrong numbers / data loss |
| **Phase 3** | Governance & RBAC | E, G, I, J | 1–2 days | 🟡 P1 — Policy bypass / access |
| **Phase 4** | Missing Features & Stubs | F, H, K | 1–3 days | 🟢 P2 — Tech debt / missing |

---

## Phase Dependency Graph

```
Phase 1 (tx atomicity) ──→ Phase 2 (consistency) ──→ Phase 3 (governance) ──→ Phase 4 (tech debt)
```

Phases MUST be executed in order. Phase 2 depends on Phase 1 fixes being in place (P&L migration depends on ledger atomicity being correct first).

---

## Workflow

1. **Executor Agent** implements one phase at a time
2. Executor creates completion report at `1-TODO/done/34-phase-N-completion-report.md`
3. **Auditor Agent** verifies the phase against acceptance criteria
4. Only after PASS ✅ does the next phase begin

---

## Phase Details

Each phase is a self-contained plan file:

| Phase | Plan File |
|-------|-----------|
| 1 | [34a-phase1-transaction-atomicity.md](./34a-phase1-transaction-atomicity.md) |
| 2 | [34b-phase2-accounting-consistency.md](./34b-phase2-accounting-consistency.md) |
| 3 | [34c-phase3-governance-rbac.md](./34c-phase3-governance-rbac.md) |
| 4 | [34d-phase4-missing-features.md](./34d-phase4-missing-features.md) |
