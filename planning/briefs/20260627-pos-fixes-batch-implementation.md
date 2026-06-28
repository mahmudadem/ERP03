# Brief: POS Fixes Batch Implementation

**For:** Implementation agent  
**From:** Codex  
**Date:** 2026-06-27  
**Target branch:** `codex/pos-fixes-batch`  
**Task file:** `planning/tasks/272-pos-fixes-batch.md`

## Context

The owner tested POS and reported several operational blockers around scanner behavior, reports, credit sales, item barcodes, notes, tablet keyboard behavior, and untranslated POS UI. These fixes should ship together on one branch with logical commits, but the POS terminal layout redesign must remain separate.

Current expected POS posting behavior is immediate stock movement and immediate accounting posting. Do not change that behavior in this implementation.

## Implementation Order

1. Read `planning/ACTIVE.md`, `planning/JOURNAL.md`, `planning/VISION.md`, `planning/PRIORITIES.md`, and `planning/tasks/272-pos-fixes-batch.md`.
2. Confirm branch is `codex/pos-fixes-batch`.
3. Inspect current POS terminal, POS settings, POS reporting, item/catalog, and item repository contracts before editing.
4. Implement one subtask at a time with a focused commit after each verified subtask.
5. Keep the terminal layout redesign out of this branch.

## Work Packages

### 1. Scanner, Focus, Shortcuts, and Audio

Implement global scanner-burst handling on the POS terminal:

- Detect scanner-style input by rapid key timing and Enter suffix.
- Route scanner input directly to product lookup and cart add.
- Work when focus is outside search and when focus is inside search.
- Ignore normal human typing.
- Suppress POS shortcut actions while scanner burst is active.
- Refocus search after scanner add and manual add.
- Add two distinct quiet success tones:
  - barcode scanner add
  - manual/search/touch add

Add a terminal-level setting for virtual keyboard suppression on tablet/scanner terminals. Prefer a narrow POS terminal setting if one exists; otherwise extend POS settings with backend persistence.

### 2. Receipt / Invoice Notes

Add user-entered notes/comments to POS sale completion:

- visible/editable before payment
- saved with the POS sale/receipt/invoice record
- returned in receipt/detail APIs where appropriate
- included in print/receipt display if the existing receipt model supports it

Backend must accept and persist notes safely. Frontend-only state is not enough.

### 3. Multiple Item Barcodes

Implement additional barcodes as item/catalog behavior:

- item UI supports adding/removing/listing unlimited additional barcodes
- UI shows count/list clearly
- backend validates uniqueness company-wide
- uniqueness checks include primary barcode and all additional barcodes
- POS search/scanner lookup finds any barcode

Do not make this a POS-only table or POS-only field. Other modules must be able to use the same item barcode data later.

### 4. POS Report Selectors

Replace raw id entry where users cannot know the id:

- Z Report shift id becomes a shift selector
- open/active shifts appear first
- selector displays useful context: status, register, cashier, open/close time
- optional copy id/reference remains available
- apply the same selector rule to POS report filters for register, cashier, receipt, or shift dependencies

Use existing shared selector patterns where available. If no selector exists, create a reusable POS selector component rather than embedding one-off raw text inputs.

### 5. Credit Sale / Sell On Account

Add controlled POS credit sale:

- POS setting flag controls whether credit sale is allowed.
- Changing this flag requires POS settings permission.
- Cashier use of credit sale must be permission-aware or follow existing manager override policy if one exists.
- Credit sale requires a selected named customer.
- Walk-in/anonymous customer credit sale must be blocked.
- Backend must reject invalid credit-sale requests even if UI is bypassed.
- Payment UI should clearly separate paid-now tender from credit sale.
- Accounting/AR behavior must be correct and auditable.

Do not invent local posting logic. Use existing POS sale completion, receivable, and accounting bridge patterns.

### 6. POS Localization Scan

Scan POS frontend for hardcoded English, especially:

- POS reports
- POS report initializer
- shortcuts page
- shortcuts modal/dialog
- settings labels touched by this task

Move strings into the correct locale namespace and keep English, Arabic, and Turkish files structurally aligned.

## Red Lines

- No terminal layout redesign in this branch.
- No deferred posting policy implementation.
- No direct GL posting outside `IAccountingBridge`.
- No direct stock movement outside `IInventoryCore`.
- No raw id inputs where selector UX is required.
- No frontend-only enforcement for credit sale or barcode uniqueness.
- No hardcoded user-facing English in new/changed frontend code.

## Required Tests and Checks

Backend:

- focused item barcode tests
- focused POS search/bootstrap tests
- focused POS sale completion tests
- focused credit-sale reject/allow tests
- report tests if report contracts changed
- `SystemCoreBoundaries.test.ts`

Frontend:

- typecheck
- build
- report compliance check
- locale JSON validation through build/typecheck

Manual:

- scanner add from page body
- scanner add from search field
- scanner does not open Pay/F12
- manual add refocus and tone
- barcode add refocus and tone
- notes persist after completed sale
- duplicate barcode blocked
- Z Report selector runs a real shift
- credit sale disabled/enabled flows
- credit sale requires named customer

## Deliverables

- Logical commits on `codex/pos-fixes-batch`.
- Updated docs and user guide entries.
- Completion report only after tests pass.
- `planning/JOURNAL.md`, `planning/ACTIVE.md`, and `planning/QA-QUEUE.md` updated for handoff.
