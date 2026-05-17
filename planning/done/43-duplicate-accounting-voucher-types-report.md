# 43 — Duplicate Accounting Voucher Types Completion Report

**Date:** 2026-04-27  
**Agent:** Codex  
**Status:** ✅ Done

## Summary
Fixed duplicate Accounting voucher type/form entries caused by legacy default forms and canonical default forms both existing for the same logical voucher code.

The API now dedupes only system/default/locked forms by logical `module + canonical voucher code`. Custom user-created copies remain visible.

## Files Changed
- `backend/src/domain/designer/services/VoucherFormDeduper.ts`
- `backend/src/domain/designer/services/__tests__/VoucherFormDeduper.test.ts`
- `backend/src/infrastructure/firestore/repositories/designer/FirestoreVoucherFormRepository.ts`
- `backend/src/application/accounting/use-cases/InitializeAccountingUseCase.ts`
- `backend/src/application/system/services/CompanyVoucherTemplateSyncService.ts`
- `backend/src/application/system/services/__tests__/CompanyVoucherTemplateSyncService.test.ts`
- Generated backend `lib/` files were updated by `npm run build`

## What Was Fixed
- Legacy Accounting default forms with bad `typeId=ACCOUNTING` no longer cause duplicate visible voucher types.
- Future Accounting initialization uses canonical voucher codes for default form `baseType` and `typeId`.
- Company voucher template sync no longer creates another default form when an equivalent legacy default already exists.
- Legacy and canonical system templates such as `JOURNAL` and `journal_entry` are treated as the same logical default.
- User-created copies remain visible because dedupe only applies to system/default/locked forms.

## Verification
- `npm test -- VoucherFormDeduper`
- `npm test -- CompanyVoucherTemplateSyncService`
- `npm run build` in `backend/`
- `npm run build` in `frontend/`
- Firestore emulator repository check confirmed no duplicate default logical keys are returned for tested companies.

## Acceptance Criteria Met
- Accounting voucher list no longer returns duplicate default entries from the repository.
- New companies or re-initialized modules should not create the bad `typeId=ACCOUNTING` defaults.
- Existing user/custom form copies are not hidden.
- Future system template sync is guarded against creating equivalent duplicate defaults.

## Known Follow-Up
The physical duplicate default documents still exist in Firestore. They are hidden by the repository now. A later cleanup script can remove obsolete duplicate default docs after confirming no posted vouchers reference them.
