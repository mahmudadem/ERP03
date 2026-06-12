# Completion Report - Task 197 Sectioned Native Document Scaffold Contract

**Date:** 2026-06-09  
**Owner:** Codex  
**Actual time:** ~0.9h  
**Status:** Complete

## Technical Developer View

### What changed

- `frontend/src/components/shared/DocumentDetailScaffold.tsx`
  - Added exported body slot types: `control`, `header`, `lines`, `secondary`, `attachments`, `custom`.
  - Added exported rail slot types: `info`, `readiness`, `settlement`, `totals`, `custom`.
  - Added exported footer slot types: `totals`, `actions`.
  - Added `DocumentScaffoldSection` with `show`, `preserveSpace`, `title`, `action`, `content`, and `className`.
  - Added `sections`, `railSections`, and `footerSections` props.
  - Normalized legacy `children` and `sideRail` through scaffold `custom` slots so older consumers keep working while still passing through one section rendering path.
  - Kept rail drawer, pinned rail, RTL mirroring, and footer behavior centralized in the scaffold.

- `docs/architecture/document-scaffold.md`
  - New architecture contract for native document body, rail, and footer sections.

- `docs/architecture/sales.md` and `docs/architecture/purchases.md`
  - Added notes explaining the section contract and accounting boundary.

- `docs/user-guide/sales/README.md` and `docs/user-guide/purchases/README.md`
  - Added plain-language explanation of consistent document anatomy and per-page hidden sections.

### Important implementation note

The scaffold contract is now in place and backwards-compatible. Existing pages that still pass older `children` / `sideRail` props are normalized through `custom` slots; newly edited pages should progressively supply strict `control`, `header`, `lines`, `secondary`, `attachments`, `info`, `readiness`, `settlement`, and `totals` slots directly. This prevents a risky all-at-once JSX move while still establishing the single shared layout contract.

### Accounting / ERP boundary

Presentation only. No posting, settlement, tax, AP/AR, inventory valuation, approval, period-lock, audit, or ledger behavior changed.

## End-User View

Sales and Purchases document screens now have one standard page anatomy: controls, header details, line table, secondary work area, optional attachments, right rail, and footer actions. Some documents show more sections than others. For example, invoices can show settlement and totals while delivery or goods receipt documents can hide settlement, but the page still feels consistent.

## Verification

- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed, including `check:reports`, `check:no-confirm`, `check:sod-approve`, TypeScript, and Vite build.

## Follow-Up

- Split the remaining legacy `custom` body content on each document page into direct strict section props during the next visual cleanup pass.
- Run manual Classic + Windows mode QA for SI, PI, SO, DN, SR, PO, GRN, PR, and Quotes.
