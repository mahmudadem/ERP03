# Native Invoice Source Contract Completion Report

**Date:** 2026-05-04
**Task:** Fix native Sales/Purchase invoice Save & Post failing with `formType is required`
**Estimate:** 45 min
**Actual:** 45 min
**Status:** Done

## Technical Developer View

Native invoice pages were saving through the same create endpoints as Forms Designer documents, but they did not send `formType`, `voucherType`, or `persona`. The API validator therefore rejected native create-and-post requests before the backend could resolve the document.

The fix adds a separate invoice `source` field:
- `native` for native module pages
- `default_form` for system/default designer forms
- `custom_form` for cloned/custom designer forms

Backend Sales and Purchases invoice entities now persist `source`. Create validators allow missing form identity only when `source = native`; default/custom requests remain strict. Create use cases resolve native invoices to `linked` when source document references exist, otherwise `direct`. Service/mixed-line native analysis is intentionally not implemented yet.

Files changed:
- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/domain/purchases/entities/PurchaseInvoice.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/api/validators/sales.validators.ts`
- `backend/src/api/validators/purchases.validators.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/api/dtos/PurchaseDTOs.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/hooks/useVoucherActions.ts`
- `1-TODO/65-invoice-selector-settlement-e2e-test-plan.md`

## End-User View

Users can now use the normal Sales Invoice and Purchase Invoice pages without choosing a designer form first. The system records that the document came from the native screen, then decides internally whether it is a direct or linked invoice based on the document data.

Custom and default designer forms still work as before, and the system now records whether the document came from a default form or a custom cloned form.

## Verification

- `npm run build` in `backend/` passes.
- `npm run build` in `frontend/` passes.
- `npm test -- --runTestsByPath src/tests/application/sales/SalesInvoiceSettlementPosting.test.ts src/tests/application/purchases/PurchaseInvoiceSettlementPosting.test.ts` passes: 8/8 tests.

## Follow-Up

Manual E2E still needs to confirm native/default/custom invoice saves in the browser. Native service-only or mixed stock/service invoice persona detection is deferred until the backend line-analysis rule is explicitly designed.
