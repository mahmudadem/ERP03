# Brief: POS Terminal Layout Implementation

**For:** Implementation agent  
**From:** Codex  
**Date:** 2026-06-27  
**Target branch:** `codex/pos-terminal-layout`  
**Task file:** `planning/tasks/273-pos-terminal-layout-restructure.md`

## Context

The owner wants a separate experimental branch for POS terminal layout restructuring. This branch exists so the layout can be accepted or reverted without touching operational POS fixes.

## Implementation Order

1. Read `planning/ACTIVE.md`, `planning/JOURNAL.md`, `planning/VISION.md`, `planning/PRIORITIES.md`, and `planning/tasks/273-pos-terminal-layout-restructure.md`.
2. Confirm branch is `codex/pos-terminal-layout`.
3. Inspect the current POS terminal page and its child components.
4. Restructure layout only.
5. Verify visually in browser at desktop, tablet, and narrow widths.

## Layout Concept

Use one viewport-bound terminal frame:

- full available app height, approximately `h-[calc(100vh-98px)]`
- `flex flex-col`
- `overflow-hidden`
- compact spacing

Top header:

- one fixed compact row
- left side: terminal, session/shift, cashier, date/time, client/customer
- right side: operation icons/buttons

Main workspace:

- two-column grid
- left catalog area around 58 percent width
- right cart/checkout area around 42 percent width
- both columns use `min-h-0` and independent internal scrolling

Left catalog:

- fixed search/scanner area
- fixed horizontal category bar
- scrollable product/result grid
- fixed bottom action area

Right cart:

- fixed cart header
- scrollable cart lines
- fixed totals and payment block
- large green Pay button

## Red Lines

- Do not edit backend files.
- Do not edit data models or API contracts.
- Do not implement barcode scanner fixes.
- Do not implement credit sale.
- Do not implement multiple item barcodes.
- Do not change posting/accounting/inventory behavior.
- Do not touch report selector work.
- Do not mix changes from `codex/pos-fixes-batch`.

## Acceptance Criteria

- No body-level terminal page scroll.
- Product grid scrolls independently.
- Cart lines scroll independently.
- Header and operational buttons remain reachable.
- Totals and Pay button remain visible.
- Existing POS actions still work.
- No text overlap at tested viewports.
- The diff is limited to frontend layout/styling and necessary locale labels.

## Required Checks

- frontend typecheck
- frontend build
- browser visual QA at desktop/tablet/narrow widths
- verify cart overflow
- verify product grid overflow
- verify payment button remains visible

## Deliverables

- One focused branch: `codex/pos-terminal-layout`.
- One or more focused commits after verification.
- Completion report and planning updates only after tests pass.
