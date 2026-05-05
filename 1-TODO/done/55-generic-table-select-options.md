# Completion Report — Generic Table SELECT Options

**Date:** 2026-04-30  
**Agent:** Codex (CTO Mode)  
**Actual Time:** 0.5h  
**Status:** Done

## Technical Developer View

### Task
Keep both accounting line-entry styles working (`debit + credit` and `side + amount`) and make `GenericVoucherRenderer` render table columns with `type: SELECT` using options from the seeded/template metadata.

### Root Cause
- The renderer had dedicated components for account/item/warehouse/currency cells but no generic table select cell.
- Table-column `options` were not part of all table column types and were dropped by several mapper/sync paths.
- The seeded `side` column did not define Debit/Credit options.

### Files Changed
- `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- `frontend/src/modules/accounting/voucher-wizard/types.ts`
- `frontend/src/modules/accounting/voucher-wizard/mappers/canonicalToUi.ts`
- `frontend/src/modules/accounting/voucher-wizard/mappers/uiToCanonical.ts`
- `frontend/src/modules/accounting/voucher-wizard/services/voucherWizardService.ts`
- `frontend/src/modules/tools/forms-designer/types.ts`
- `frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx`
- `frontend/src/modules/tools/forms-designer/mappers/documentMapper.ts`
- `frontend/src/designer-engine/types/VoucherTypeDefinition.ts`
- `backend/src/seeder/seedSystemVoucherTypes.ts`
- `backend/src/domain/designer/entities/VoucherTypeDefinition.ts`
- `backend/src/repository/interfaces/designer/IVoucherFormRepository.ts`
- `backend/src/application/accounting/use-cases/InitializeAccountingUseCase.ts`
- `backend/src/application/system/services/CompanyVoucherTemplateSyncService.ts`

### What Changed
- Added generic table `SELECT` rendering in both voucher table styles.
- Normalized template options from objects or primitive values into `{ value, label }`.
- Added a compatibility fallback for stale `side` select columns to show Debit/Credit.
- Added Debit/Credit options to the seeded `side` column.
- Preserved `options` through type definitions, initialization, template sync, wizard mappers, and forms designer mapper paths.

### Verification
- `npm run build` in `frontend/` passes.
- `npm run build` in `backend/` passes.

### Known Follow-Up
Existing persisted company voucher forms may still lack `options` metadata until reseeded or repaired. The renderer fallback covers stale `side` columns, but data repair is still recommended.

## End-User View

Voucher line tables can now show dropdown fields properly. If a template defines a `SELECT` column, the voucher screen will show a dropdown with the template’s options instead of a plain text box. This keeps both styles usable: Debit/Credit columns for the official Journal Voucher, and Side/Amount columns for older or custom forms.
