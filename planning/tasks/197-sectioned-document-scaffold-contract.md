# Task 197 - Sectioned Native Document Scaffold Contract

**Date:** 2026-06-09  
**Owner:** Codex  
**Estimated time:** 0.8-1.2h  
**Status:** In progress

## Goal

Make the native document scaffold a real shared layout contract, not only a shared visual shell. Sales and Purchases document pages should share fixed named sections while each page supplies its own inputs, actions, and data.

## Scope

- Add named body slots to `DocumentDetailScaffold`: `control`, `header`, `lines`, `secondary`, `attachments`, `custom`.
- Add named rail slots: `info`, `readiness`, `settlement`, `totals`, `custom`.
- Add named footer slots: `totals`, `actions`.
- Add per-section `show` / `preserveSpace` flags.
- Keep old `children`, `sideRail`, `footerSummary`, and `footerActions` paths compatible by normalizing them through the scaffold section pipeline.
- Document the contract for future Sales/Purchases pages.

## Out of Scope

- No posting, settlement, tax, inventory, approval, period-lock, AP/AR, or ledger logic changes.
- No backend API or data model changes.
- No redesign of Sales Invoice internals in this slice.

## Acceptance Criteria

- `DocumentDetailScaffold` exports section contracts.
- Pages can opt into strict `sections`, `railSections`, and `footerSections`.
- Legacy scaffold consumers still compile and render through the same normalized pipeline.
- Architecture and user-facing docs explain the static section structure.
- Frontend typecheck and production build pass.
