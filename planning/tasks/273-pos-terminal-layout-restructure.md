# Task 273: POS Terminal Layout Restructure

**Status:** Ready for implementation handoff  
**Target branch:** `codex/pos-terminal-layout`  
**Owner:** Implementation agent  
**Reviewer:** Codex after implementation  
**Estimated time:** 1 focused day

## Goal

Restructure the POS terminal page to use screen space more effectively while preserving existing behavior. This branch is intentionally isolated because the layout may be reverted independently.

## Scope

Apply the layout concept below to the POS terminal page. The exact measurements are not mandatory; the structure and ergonomics are.

1. Use a fixed viewport-height terminal frame around the POS page, roughly `h-[calc(100vh-98px)]`.
2. Prevent the main browser window from scrolling during terminal use.
3. Add a compact top header row with:
   - terminal name
   - session/shift status
   - cashier
   - live date/time
   - active client/customer context
   - operation buttons/icons for shift controls, recall sale, suspend draft, sync ledger, shortcuts, and settings
4. Split the main workspace into two columns:
   - left catalog/utilities column, about 58 percent width
   - right cart/checkout column, about 42 percent width
5. Left column structure:
   - fixed search/scanner area at top
   - horizontal category group bar
   - product/search result grid with independent vertical scroll
   - fixed bottom action area for void sale, custom item, quick discount, and client allocation
6. Right column structure:
   - cart header fixed at top
   - cart lines with independent vertical scroll
   - totals/pay block fixed at bottom
   - large green Pay button

## Out of Scope

- Do not implement barcode scanner fixes here.
- Do not implement audio feedback here.
- Do not implement credit sale here.
- Do not implement multiple item barcodes here.
- Do not change POS report behavior here.
- Do not change backend, API contracts, accounting, inventory, posting, settings, or data models.
- Do not edit the `codex/pos-fixes-batch` work.

## Design Constraints

- Preserve existing POS terminal behaviors and data flow.
- Keep touch controls large enough for cashier/tablet use.
- Avoid nested cards and decorative UI churn.
- Use existing component patterns and icon library.
- All text must remain localized.
- Text and controls must not overlap at desktop, tablet, or narrow widths.
- Use stable dimensions for cart rows, product tiles, buttons, and totals so dynamic content does not shift the layout.

## Acceptance Criteria

- The terminal page fits inside the visible app area without body-level scrolling.
- Catalog/product grid and cart lines scroll independently.
- Header, category bar, bottom action area, cart header, totals, and Pay button remain accessible.
- Existing product add, cart edit, discount, payment, shift, shortcut, and settings actions still work.
- Layout remains usable at common desktop and tablet widths.
- No backend or data-model files are changed.

## Verification

Run frontend checks:

- typecheck
- build
- report compliance script if build invokes it

Browser QA:

- desktop viewport
- tablet viewport
- narrow fallback viewport
- product grid overflow
- cart overflow
- Pay button visibility
- no text overlap
- no full-page scroll inside the terminal route

## Documentation Required

- Update POS architecture or UI notes only if a reusable layout pattern is introduced.
- Add a short user-guide note only if cashier-visible behavior changes.
- Add completion report only after implementation, review, and verification.
- Append actual time spent to `planning/JOURNAL.md`.
