# Task 198 - Native Document Header Density Standard

**Date:** 2026-06-09  
**Owner:** Codex  
**Estimated time:** 0.8-1.3h  
**Status:** In progress

## Goal

Make native document header inputs match the compact Sales Invoice standard instead of letting every page define its own input size and grid density.

## Scope

- Add shared header density primitives to `DocumentDetailScaffold`.
- Default document headers to a two-row, five-column grid on wide layouts.
- Use compact `h-9` controls, `text-xs` inputs, and `text-[10px]` labels.
- Keep large free-text fields such as notes/reasons outside the compact header grid.
- Apply the standard to the main Sales/Purchases document pages already touched by the scaffold parity pass.

## Accounting Boundary

UI/layout only. No posting, tax, inventory valuation, settlement, approval, AP/AR, period-lock, audit, or ledger behavior changes.

## Acceptance Criteria

- Shared header primitives exist in `DocumentDetailScaffold`.
- SI and PI use the same five-column header grid.
- SO, DN, Quote, PO, GRN, SR, and PR main header cards use the compact grid rhythm.
- Frontend typecheck and build pass.
