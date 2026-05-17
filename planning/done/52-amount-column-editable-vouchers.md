# Amount Column Editable in New/Cloned Vouchers

**Date:** 2026-04-30  
**Task:** Bug fix for JV/PV/RV amount column read-only behavior  
**Status:** Done  
**Estimated Time:** 30-45 minutes  
**Actual Time:** 0.6h

## Summary

The previous fix preserved `readOnly: false` through the mapper chain, but the renderer still normalized the accounting `amount` column to `lineTotal`. Since `lineTotal` is always rendered as a calculated display cell, the Amount column remained effectively disabled in new and cloned vouchers.

## Files Changed

- `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- `frontend/src/modules/accounting/voucher-wizard/types.ts`
- `ACTIVE.md`
- `JOURNAL.md`

## Technical Developer View

### Problem

`GenericVoucherRenderer.normalizeTableColumnId()` treated `amount` as an alias for `lineTotal`. That was correct for product-document total aliases, but wrong for Accounting voucher forms where `amount` is a real user-entered value.

The earlier `readOnly` fix did not fully work because rendering uses this condition before choosing an input:

```tsx
normalizedColId === 'lineTotal'
```

Once `amount` became `lineTotal`, the cell rendered as calculated text instead of an editable input.

### Fix

- Removed `amount` from the aliases that normalize to `lineTotal`.
- Kept `total`, `totalDoc`, and `lineTotalDoc` mapped to `lineTotal` for calculated document line totals.
- Added `amount` to the numeric `AmountInput` render branch in both table styles.
- Normalized column type casing so `"NUMBER"` columns also render as numeric amount inputs.
- When editing `amount`, if the row has `side: Debit` or `side: Credit`, synced the debit/credit alias fields so equivalent/base amount calculations stay coherent.
- Added missing optional fields to `TableColumnConfig`: `fieldId`, `type`, `readOnly`, `calculated`, and `autoManaged`.

## End-User View

Users can now type directly into the Amount column when creating or cloning Journal Vouchers, Payment Vouchers, Receipt Vouchers, and Opening Balance forms. Calculated total fields still stay protected from manual editing.

## Acceptance Criteria Met

- New voucher Amount column is no longer rendered as a calculated total cell.
- Cloned voucher Amount column uses the same editable rendering path.
- Explicit `readOnly: false` remains respected.
- Calculated `lineTotal` style columns remain read-only.
- Frontend TypeScript build passes.

## Testing

- Ran `npm run build` in `frontend/`.
- Result: pass.

## Known Issues / Follow-Ups

- Manual browser QA is still needed against live seeded/cloned forms to confirm the exact JV/PV/RV/Opening Balance screens.
- The worktree had many pre-existing dirty files from prior sessions; this fix intentionally touched only the renderer, voucher-wizard type definition, and project memory files.
