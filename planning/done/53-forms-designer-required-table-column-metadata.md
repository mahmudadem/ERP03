# Forms Designer Required Table Column Metadata Fix

**Date:** 2026-04-30  
**Task:** Fix Super Admin vs Forms Designer required-column mismatch  
**Status:** Done  
**Estimated Time:** 30-45 minutes  
**Actual Time:** 0.5h

## Summary

The Journal Voucher official template in Super Admin correctly marks table columns like Account, Side, and Amount as required. Forms Designer was not showing those `REQ` badges and was incorrectly showing `REQ` on Parity.

## Root Cause

Forms Designer used the same mandatory-field lookup for header fields and table columns.

That caused two problems:

- `Parity` uses the field id `exchangeRate`. Since `exchangeRate` is required in the voucher header, the table column inherited the header required status incorrectly.
- `Account`, `Side`, and `Amount` are required table columns, but the table-column metadata was not consistently preserved through initialization and mapper paths.

## Files Changed

- `frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx`
- `frontend/src/modules/tools/forms-designer/mappers/documentMapper.ts`
- `frontend/src/modules/tools/forms-designer/types.ts`
- `frontend/src/designer-engine/types/VoucherTypeDefinition.ts`
- `frontend/src/modules/accounting/voucher-wizard/mappers/canonicalToUi.ts`
- `frontend/src/modules/accounting/voucher-wizard/services/voucherWizardService.ts`
- `backend/src/application/accounting/use-cases/InitializeAccountingUseCase.ts`
- `backend/src/domain/designer/entities/VoucherTypeDefinition.ts`
- `backend/src/repository/interfaces/designer/IVoucherFormRepository.ts`
- `ACTIVE.md`
- `JOURNAL.md`

## Technical Developer View

### Fix

- Split Forms Designer required detection by scope:
  - Header/layout fields use `headerFields`.
  - Table columns use `tableColumns` and `lineFields`.
- Added a fallback to `availableTableColumns` for clones or edited forms where the original template lookup is unavailable.
- Updated table-column toggle/add code so newly selected columns preserve metadata instead of becoming `{ id, labelOverride }` only.
- Preserved `mandatory` and `required` when Accounting initialization creates company voucher forms.
- Extended frontend/backend table-column types to carry metadata: `type`, `required`, `mandatory`, `readOnly`, `calculated`, and `autoManaged`.
- Updated canonical/UI and save mappers to carry the same metadata.

## End-User View

Forms Designer now shows the same required markers as the official Super Admin template. For Journal Voucher, Account, Side, and Amount are shown as required table columns. Parity is no longer shown as required just because the header exchange rate is required.

## Acceptance Criteria Met

- Required status for table columns comes from table metadata, not header metadata.
- Required table columns remain protected from being toggled off in the field picker.
- Table column metadata survives clone/edit/save mapping.
- Frontend build passes.
- Backend build passes.

## Testing

- Ran `npm run build` in `frontend/`.
- Ran `npm run build` in `backend/`.
- Both passed.

## Known Issues / Follow-Ups

- Existing company forms that were created before this fix may already have lost `mandatory` metadata. A fresh module initialization/reseed or a small metadata repair script may be needed for old records if they do not reload from the official catalog.
