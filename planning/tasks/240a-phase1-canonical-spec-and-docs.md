# Phase 1 (Epic 240) — Canonical spec + docs (NO production code)

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** nothing · **Parallel-safe:** yes
**Type:** documentation only. Do not change any runtime behavior.

## Objective
Make the architecture docs the single source of truth for the **three inventory accounting modes**, the per-mode **document behavior**, the **item costing data model**, and **report-time valuation** — and correct the historical doc that conflated "SIMPLE" with periodic.

## Background (read epic 240 §1–§5 first)
Today both shipped modes (`INVOICE_DRIVEN`, `PERPETUAL`) are *perpetual* accounting; the legacy enum `PERIODIC` was remapped to `INVOICE_DRIVEN` and true periodic was never built. Epic 240 adds a real periodic mode. This phase only writes that down.

## Files to change
- `docs/architecture/inventory.md` — add canonical sections:
  - **Three modes** table (epic §1): Periodic/Simple, Invoice-driven, Perpetual/Accurate; the two axes (accounting method vs document workflow).
  - **Document behavior per mode** (epic §2): the DN/SO/GRN/PO/Invoice/Return/Adjustment/Opening table + the "invoice moves quantity only if no DN/GRN did" no-double-count rule.
  - **Item costing data model** (epic §3): `CostPoint` / `ItemCostingStats`, extensible `extra` map, FX fields, `InventoryPricingPolicy`.
  - **Report-time valuation & Trading account** (epic §5).
- `docs/audit/inventory-accounting-model-audit.md` — append a dated **2026-06-18 addendum**: clarify that the 2025 doc's "SIMPLE = INVOICE_DRIVEN" is *perpetual*, NOT periodic; `PERIODIC` becomes a real third mode per epic 240; the SIMPLE/ACCURATE labels in §10–§13 of that audit are superseded by epic 240 §1.

## Acceptance
- A reader can determine, from `docs/architecture/inventory.md` alone, what each of the three modes posts and how inventory is valued in each.
- No code, no test, no behavior change.

## Definition of Done
- `planning/done/240a-phase1-canonical-spec-and-docs.md` report.
- `planning/JOURNAL.md` entry + `planning/ACTIVE.md` updated.
