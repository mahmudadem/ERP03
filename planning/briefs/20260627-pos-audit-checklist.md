# Brief: POS Branch Audit Checklist

**For:** Codex audit after implementation  
**Date:** 2026-06-27  
**Branches to audit:** `codex/pos-fixes-batch`, `codex/pos-terminal-layout`

## Audit Sequence

1. Audit `codex/pos-fixes-batch`.
2. Audit `codex/pos-terminal-layout`.
3. Confirm no cross-contamination between branches.
4. Run verification commands.
5. Report findings before any merge.

## POS Fixes Branch Audit

Check scope:

- branch includes scanner, notes, multiple barcodes, report selectors, credit sale, settings, and i18n fixes
- branch does not include terminal layout redesign
- branch does not implement deferred posting policy

Check architecture:

- item additional barcodes are shared item/catalog behavior
- barcode uniqueness is backend-enforced and company-scoped
- POS lookup searches all item barcodes
- credit sale is backend-enforced
- credit sale requires named customer
- credit sale does not bypass receivable/accounting controls
- stock remains through inventory core
- accounting remains through accounting bridge
- no raw id report filters remain where selector UX is required
- no new hardcoded frontend English remains in touched POS files

Check financial impact:

- immediate stock and accounting posting behavior remains current default
- credit sale creates correct receivable exposure
- partial/zero payment paths do not distort cash totals
- Z Report and shift reports still reconcile actual payments
- notes are audit-visible but do not affect posting

Run tests:

- backend focused POS/item tests
- `SystemCoreBoundaries.test.ts`
- frontend typecheck
- frontend build
- report compliance script

Manual QA:

- scanner from body
- scanner from search
- scanner does not trigger Pay/F12
- manual add sound/focus
- barcode add sound/focus
- notes persist
- duplicate barcode rejection
- Z Report shift selector
- credit sale disabled/enabled paths
- Arabic POS pages checked for new untranslated English

## Terminal Layout Branch Audit

Check scope:

- branch changes only POS terminal layout/frontend styling
- no backend/data/API/accounting/inventory changes
- no scanner/credit/barcode/report selector fixes mixed in

Check UX:

- no body-level POS terminal scroll
- product grid scrolls independently
- cart lines scroll independently
- totals and Pay button stay visible
- top header remains compact
- no text overlap desktop/tablet/narrow
- existing POS actions still work

Run checks:

- frontend typecheck
- frontend build
- browser visual QA screenshots or notes

## Merge Recommendation Rule

Do not recommend merge if:

- backend tests fail
- frontend build fails
- accounting bridge or inventory core boundaries are bypassed
- credit sale can be forced without setting/permission/customer
- duplicate barcodes can be saved
- report selectors still require unknown raw ids for normal user workflows
- terminal layout branch includes backend or data-model changes
