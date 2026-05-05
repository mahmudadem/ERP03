# Purchases Module Parity Completion Report

**Date:** 2026-05-02  
**Estimate:** 2-3h implementation + 0.5h QA  
**Actual:** 3.4h  
**Status:** Done, pending manual browser QA/reseed

## Technical Developer View

The Purchases module was brought into the same persona architecture used by Sales. Purchase system templates now use backend-aligned canonical fields, cloned company voucher types preserve `voucherType` and `persona`, dynamic Purchase documents route through Purchases APIs, and Purchase validation now has a runtime normalization layer equivalent to Sales.

Key fixes:
- Updated `seedSystemVoucherTypes.ts` Purchase templates from stale/generic fields to `vendorId`, `orderedQty`, `receivedQty`, `invoicedQty`, `returnQty`, `unitPriceDoc`, and `unitCostDoc`.
- Completed `purchase_invoice_direct`, `purchase_invoice_linked`, and `purchase_invoice_service` persona definitions with source, warehouse, UOM, tax, read-only totals, and line metadata.
- Fixed `PurchaseSettingsUseCases` clone behavior so company voucher types retain `voucherType: "purchase_invoice"` and the correct persona.
- Added Purchases document profiles and normalization for validator/runtime aliases.
- Fixed `DocumentValidatorFactory` so `purchase_invoice_*` is classified as Purchases before generic invoice/order/return Sales matching.
- Reworked `PurchaseValidator` to validate normalized purchase headers, source policy, warehouse policy, semantic quantities, and document totals.
- Updated `useVoucherActions` to route PI/PO/GRN/PR dynamic saves through `purchasesApi`, including Direct PI flexible-mode Save & Post.
- Fixed `PostPurchaseInvoiceUseCase` IN stock movement construction to satisfy the shared `StockMovement` entity contract.
- **Sidebar Fix:** Removed duplicate `purchases` entry in `moduleMenuMap.ts`; added "Overview" link. Cleaned up `useSidebarConfig.ts`.
- **Directory Consolidation:** Moved `modules/purchase/` contents into `modules/purchases/`; updated `routes.config.ts`.
- **Workflow Transition Guards:** Added `hasOpenOrders` (PO) and `hasUnpostedGoodsReceipts` (GRN) checks to `UpdatePurchaseSettingsUseCase`. Implemented in both Firestore and Prisma repos. Added `PURCHASES_TRANSITION_BLOCKED` error code.
- **Audit Fix (GRN Cancelled False Positive):** Changed `hasUnpostedGoodsReceipts` to only check for `DRAFT` status (was `!= POSTED`), allowing `CANCELLED` GRNs to exist without blocking workflow switch to SIMPLE.
- **Validator Tightening:** PI validator now requires `formType`, `voucherType`, and `persona` fields.
- **Navigation:** Added `useNavigate` to `PurchaseSettingsPage` for routing.
- **Tests:** Added 5 focused tests for `UpdatePurchaseSettingsUseCase` covering open PO blocking, unposted GRN blocking, allowed transitions, and cancelled GRN handling. Fixed test type errors in `PurchaseSettingsUseCases.test.ts` (builder-style mocks). Fixed GRN-blocking test to use `await expect(...).rejects.toThrow()` instead of try/catch. Updated error message from "draft or posted" to "draft goods receipts".
- **Codex Verification:** Rechecked the two post-audit P3 findings in source. Confirmed the GRN-blocking test now fails if the use case stops throwing, and confirmed the user-facing message matches the DRAFT-only guard.

## End-User View

Purchases now behaves like Sales for the main document forms. Users can work with Direct, Linked, and Service Purchase Invoice forms, and the system keeps the right document behavior behind each form. Purchase forms now use vendor, warehouse, quantity, price, tax, and source-document fields that match how purchasing actually works.

Direct Purchase Invoice can save and post through the Purchases workflow. Linked and Service Purchase Invoice forms are now recognized as purchase documents instead of being confused with Sales invoices.

The sidebar no longer shows duplicate Purchases entries and has a working Overview link. When switching Purchase Settings between Simple and Operational workflows, the system now correctly blocks the switch if there are open purchase orders or draft goods receipts — but cancelled receipts no longer falsely block the change.

## Files Changed

- `backend/src/seeder/seedSystemVoucherTypes.ts`
- `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/tests/seeder/seedSystemVoucherTypes.test.ts`
- `backend/src/tests/application/purchases/PurchaseSettingsUseCases.test.ts`
- `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts`
- `backend/src/tests/application/purchases/PurchaseReturnUseCases.test.ts`
- `backend/src/infrastructure/firestore/repositories/purchases/FirestoreGoodsReceiptRepository.ts`
- `backend/src/infrastructure/firestore/repositories/purchases/FirestorePurchaseOrderRepository.ts`
- `backend/src/infrastructure/prisma/repositories/purchases/PrismaGoodsReceiptRepository.ts`
- `backend/src/infrastructure/prisma/repositories/purchases/PrismaPurchaseOrderRepository.ts`
- `backend/src/repository/interfaces/purchases/IPurchaseOrderRepository.ts`
- `backend/src/repository/interfaces/purchases/IGoodsReceiptRepository.ts`
- `backend/src/errors/ErrorCodes.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/hooks/useVoucherActions.ts`
- `frontend/src/modules/accounting/document-runtime/types.ts`
- `frontend/src/modules/accounting/document-runtime/index.ts`
- `frontend/src/modules/accounting/document-runtime/purchases/PurchaseDocumentProfiles.ts`
- `frontend/src/modules/accounting/document-runtime/purchases/normalizePurchaseDocument.ts`
- `frontend/src/modules/accounting/validation/DocumentValidatorFactory.ts`
- `frontend/src/modules/accounting/validation/PurchaseValidator.ts`
- `frontend/src/config/moduleMenuMap.ts`
- `frontend/src/hooks/useSidebarConfig.ts`
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`
- `frontend/src/router/routes.config.ts`

## Tests and QA

- ✅ `npm test -- --runTestsByPath src/tests/seeder/seedSystemVoucherTypes.test.ts src/tests/application/purchases/PurchaseSettingsUseCases.test.ts src/tests/application/purchases/PurchasePostingUseCases.test.ts src/tests/application/purchases/PurchaseReturnUseCases.test.ts`
- ✅ `npm run build` in `backend/`
- ✅ `npm run build` in `frontend/`
- ✅ Codex recheck: `npm test -- --runTestsByPath src/tests/application/purchases/PurchaseSettingsUseCases.test.ts` in `backend/` — 6/6 pass
- ✅ Codex recheck: `npm run build` in `backend/` — passes

Manual browser QA was not run in this pass.

## Acceptance Criteria Met

- ✅ Purchase Invoice Direct/Linked/Service persona templates exist.
- ✅ Purchase templates use canonical purchase fields instead of generic Sales-style aliases.
- ✅ Company voucher type cloning preserves `voucherType` and `persona`.
- ✅ Purchase dynamic document saves route through Purchases APIs.
- ✅ Direct Purchase Invoice flexible mode uses create/update-and-post APIs.
- ✅ Purchase validator classification handles `purchase_invoice_direct|linked|service` as Purchases.
- ✅ Purchase posting and return tests pass against Firestore-safe write APIs.
- ✅ Sidebar has no duplicate Purchases entries; Overview link works.
- ✅ `modules/purchase/` consolidated into `modules/purchases/`.
- ✅ Workflow transition guards block OPERATIONAL→SIMPLE with open POs or draft GRNs.
- ✅ Cancelled GRNs do not falsely block workflow transitions.
- ✅ PI validator enforces `formType`, `voucherType`, `persona`.
- ✅ 5 regression tests cover `UpdatePurchaseSettingsUseCase` guard logic.
- ✅ Post-audit P3 cleanup verified: GRN-blocking test uses rejecting assertion; error text says draft GRNs only.

## Remaining Follow-Ups

- Reseed/sync system voucher templates into existing companies so stale Purchase forms are replaced.
- Browser QA Purchase Forms Designer, Direct PI Save & Post, Linked PI, Service PI, and Purchase Settings Governance save/load.
- Existing frontend build warnings about bundle size and stale browser data remain non-blocking.
