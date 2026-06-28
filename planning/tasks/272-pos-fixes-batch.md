# Task 272: POS Fixes Batch

**Status:** Ready for implementation handoff  
**Target branch:** `codex/pos-fixes-batch`  
**Owner:** Implementation agent  
**Reviewer:** Codex after implementation  
**Estimated time:** 2-3 focused days, split into logical commits

## Goal

Fix the current POS operational gaps without changing the terminal layout experiment and without changing the current immediate stock/accounting posting policy.

## Scope

1. Barcode scanner input must add products directly to the active cart from anywhere on the POS terminal.
2. Search focus must return automatically after barcode add, manual product add, and product selection.
3. Add light success audio:
   - one tone for barcode scanner adds
   - a different tone for manual/search/touch adds
4. Scanner input must not trigger POS keyboard shortcuts such as Pay/F12.
5. Add POS receipt/invoice notes and persist them with the sale/receipt record.
6. Add terminal setting to suppress the tablet virtual keyboard for search/scanner workflow.
7. Support multiple barcodes per item as shared catalog/item behavior, not POS-only behavior.
8. Enforce company-wide barcode uniqueness across primary and additional barcodes.
9. POS product search/scanner lookup must match any item barcode.
10. Replace raw shift id entry on Z Report with a shift selector.
11. Use selectors, not raw ids, on POS report filters that depend on registers, cashiers, receipts, or shifts.
12. Add controlled POS credit sale / sell-on-account flow behind POS settings and permissions.
13. Scan and fix hardcoded English in POS UI, especially reports, report initializer, shortcuts page, and shortcuts modal.

## Out of Scope

- Do not redesign the POS terminal layout. That belongs only on `codex/pos-terminal-layout`.
- Do not implement deferred posting policy modes in this task.
- Do not change current default POS posting behavior: stock and accounting remain immediate.
- Do not bypass system-core engines or accounting/inventory bridges.

## Architecture Rules

- Multiple barcodes belong to the item/catalog engine boundary and must be reusable outside POS.
- Barcode uniqueness must be enforced backend-side, company-scoped, and must check primary barcode plus additional barcodes.
- Credit sale must be enforced backend-side, not only hidden in the UI.
- Credit sale must require a real customer/party. It must not allow a walk-in customer or anonymous sale on account.
- Any AR/accounting posting must go through `IAccountingBridge`.
- Any stock movement must remain through `IInventoryCore`.
- Pricing must continue to use `CommercialCore.resolvePrice` / existing pricing source of truth.
- Tax must continue to use `TaxEngine`.
- Use shared selectors for master-data references. No raw id text inputs for shifts/registers/cashiers/receipts when a selector flow is required.
- Add every new user-facing frontend string to locale files. No hardcoded English in components.

## Suggested Commit Split

1. `feat(pos): harden scanner input and feedback [Task 272]`
2. `feat(pos): persist receipt notes [Task 272]`
3. `feat(catalog): support multiple item barcodes [Task 272]`
4. `feat(pos): replace report raw ids with selectors [Task 272]`
5. `feat(pos): add controlled credit sale flow [Task 272]`
6. `fix(pos): complete POS localization coverage [Task 272]`

Each commit must build and should keep reviewable scope. If a subtask expands beyond eight files across more than three directories, split it further.

## Acceptance Criteria

- Scanning a barcode while focus is outside the search box adds the matching product to cart.
- Scanning a barcode while focus is inside the search box still adds to cart and does not behave like text search.
- Scanner bursts do not activate Pay/F12 or other shortcuts.
- Manual add and barcode add both return focus to the POS search area.
- Barcode add and manual add play distinct, quiet success tones.
- POS notes are visible/editable before payment and persist on the saved sale/receipt/invoice record.
- A terminal setting can disable the virtual keyboard behavior for scanner/tablet terminals.
- Items can hold unlimited additional barcodes through an add/list/remove UI.
- Duplicate barcode save attempts are blocked across the company, including primary and additional barcode collisions.
- POS search and scanner lookup find items by any assigned barcode.
- Z Report uses a shift selector with open/active shifts prioritized and optional copyable id/reference.
- POS reports use selector-based filters where they depend on another record.
- Credit sale is available only when enabled in settings and permitted.
- Credit sale requires a selected customer and creates correct receivable/accounting behavior.
- POS hardcoded English scan is materially resolved for reports, initializer, shortcuts page, and shortcuts modal.

## Verification

Run focused backend tests for:

- item barcode uniqueness and item save/update behavior
- POS product search / bootstrap lookup
- POS sale completion, including credit sale and rejection cases
- POS reports/Z Report filters if backend contracts changed
- `SystemCoreBoundaries.test.ts`

Run frontend checks:

- typecheck
- build
- report compliance script
- locale JSON parse/build

Manual QA:

- scanner add from page body
- scanner add while search input is focused
- scanner input does not trigger F12/Pay
- manual product add sound/focus
- barcode product add sound/focus
- notes survive sale completion and reload/receipt view
- duplicate barcode rejected with clear message
- Z Report selector chooses an open shift and runs report
- POS credit sale blocked when disabled
- POS credit sale allowed when enabled with named customer

## Documentation Required

- Update `docs/architecture/pos.md`.
- Create/update item/catalog architecture docs if item barcode schema or search contracts change.
- Create/update POS user-guide docs for scanner workflow, notes, credit sale, report selectors, and barcode management.
- Add a completion report under `planning/done/` only after implementation, review, and tests are complete.
- Append implementation summary and actual time spent to `planning/JOURNAL.md`.
- Update `planning/ACTIVE.md` and `planning/QA-QUEUE.md` when ready for owner testing.
