# Completion Report: Invoice Party+Account Selector Contract
**Date:** 2026-05-04  
**Agent:** Codex (CTO Mode)  
**Estimate:** 2h  
**Actual:** 1.8h

## Files Changed

### Frontend
- `frontend/src/components/shared/selectors/PartyAccountSelector.tsx` (NEW)
- `frontend/src/components/shared/selectors/PartySelector.tsx`
- `frontend/src/components/shared/selectors/index.ts`
- `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- `frontend/src/designer-engine/components/DynamicFieldRenderer.tsx`
- `frontend/src/designer-engine/types/FieldDefinition.ts`
- `frontend/src/modules/tools/forms-designer/types.ts`
- `frontend/src/modules/tools/forms-designer/mappers/documentMapper.ts`
- `frontend/src/modules/accounting/voucher-wizard/types.ts`
- `frontend/src/modules/accounting/voucher-wizard/mappers/uiToCanonical.ts`
- `frontend/src/pages/super-admin/pages/VoucherTemplateEditorPage.tsx`
- `frontend/src/hooks/useVoucherActions.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/context/CompanyAccessContext.tsx` (detour fix)

### Backend
- `backend/src/seeder/seedSystemVoucherTypes.ts`
- `backend/src/tests/seeder/seedSystemVoucherTypes.test.ts`

### Session Memory
- `ACTIVE.md`
- `JOURNAL.md`

## What Was Tested
- `npm test -- --runTestsByPath src/tests/seeder/seedSystemVoucherTypes.test.ts` (backend) ✅
- `npm run build` in `backend/` ✅
- `npm run build` in `frontend/` ✅

## Acceptance Criteria Met
- ✅ Two dedicated components exist for invoice party/account selection:
  - `customer-account-selector`
  - `vendor-account-selector`
- ✅ Composite selector renders party and account inputs in one control.
- ✅ Party selection auto-suggests AR/AP account from party defaults.
- ✅ Account remains editable by user.
- ✅ Seeder templates for required forms are updated:
  - `sales_invoice_direct`, `sales_invoice_linked`, `sales_invoice_service`
  - `purchase_invoice_direct`, `purchase_invoice_linked`, `purchase_invoice_service`
- ✅ New selector types are preserved through frontend mapper/type pipeline.

## Technical Developer View
This task introduced a reusable composite selector pattern for invoice headers where party and settlement account must be captured together in one UI control. The implementation used a shared base (`PartyAccountSelector`) plus role-specific wrappers (`CustomerAccountSelector`, `VendorAccountSelector`) so behavior is explicit and deterministic per document family.

`GenericVoucherRenderer` was extended to detect `customer-account-selector` / `vendor-account-selector` field types and synchronize header data on every change:
- party field (`customerId` / `vendorId`)
- dedicated linked account field (`customerAccountId` / `vendorAccountId`)
- compatibility field (`receivablePayableAccountId`)

Seeder templates were updated only for invoice personas (not SO/PO/DN/GRN/SR/PR) per current accounting decision scope. Frontend contracts and mappers were updated so these custom field types do not collapse to text during design/save/load flows.

Detour fixed: a TSX generic parse ambiguity (`async <T>`) in `CompanyAccessContext.tsx` blocked frontend build; converted to `async <T,>`.

## End-User View
When creating Sales or Purchase invoices, the party field now appears as one combined control:
- choose the customer/vendor
- choose the linked account in the same place

After selecting a party, the system suggests a default account automatically (if configured), and the accountant can still change it before saving. This reduces manual steps and makes invoice entry closer to real cashier/accounting workflow.

## Known Follow-up
- Manual browser E2E is still required to validate the full interactive flow in Sales and Purchases invoice forms.
- Settlement/posting flow can next consume `receivablePayableAccountId` directly from form header values to avoid duplicate entry.
