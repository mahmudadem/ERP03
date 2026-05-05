# Completion Report: Saved Voucher SELECT Choices Reopen Population

**Date:** 2026-04-30  
**Agent:** Codex (CTO Mode)  
**Estimate:** 0.3h  
**Actual:** 0.3h  
**Status:** Done

## Technical Developer View

### Task
Fix saved side+amount vouchers so table SELECT choices, especially the `side` column, repopulate when reopening an existing voucher.

### Root Cause
- Journal-style voucher save converts rows to canonical accounting lines with `side: Debit/Credit`.
- `buildFormData()` stripped `side` from `formData.detailLines`, so the saved form snapshot lost the user-facing dropdown value.
- Reopen hydration could derive debit/credit from canonical lines, but did not put a matching `side` value back on the row.
- The rendered `<select>` options use lower-case values (`debit`, `credit`), so capitalized canonical values did not auto-select.

### Files Changed
- `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- `backend/src/application/accounting/use-cases/VoucherUseCases.ts`
- `ACTIVE.md`
- `JOURNAL.md`

### Implementation
- Added `normalizeLineSideValue()` to normalize `Debit`, `Credit`, `DR`, `CR`, `debit`, and `credit` into select values.
- Normalized only the Side column's option values so older templates using capitalized option values still auto-select.
- Rehydrated row `side` from detail line data, metadata, or canonical voucher lines.
- Preserved normalized `side` in row metadata so stale and future saved vouchers can reopen consistently.
- Kept backend accounting lines canonical with `Debit`/`Credit` while carrying the UI select value in metadata.
- Updated backend form snapshot creation to keep `side` as a user-facing form field and only strip calculated accounting internals.

### Verification
- `npm run build` in `frontend/` passed.
- `npm run build` in `backend/` passed.

## End-User View

When a user selects Debit or Credit in a voucher line, saves the voucher, and opens it again later, the same dropdown choice now appears automatically. The voucher also keeps the correct debit/credit totals after reopening.

## Known Follow-Ups

Manual QA should confirm the behavior on an existing saved side+amount voucher and a newly saved one. Older vouchers that lost the form snapshot `side` can still recover from canonical accounting lines when those lines are available.
