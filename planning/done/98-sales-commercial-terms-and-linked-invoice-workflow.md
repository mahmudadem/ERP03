# Task 98 - Sales Commercial Terms and Linked Invoice Workflow

**Completed:** 2026-05-17  
**Task:** Sales Standalone / Simple / Operational workflow contract - direct invoice commercial terms, payment abstraction, and operational linked invoice alignment  
**Agent:** Codex (CTO Mode)  
**Actual time:** ~2.9h across implementation, verification, and documentation
**QA follow-up:** 2026-05-18, ~1.7h

---

## Summary

This slice made the existing Sales Invoice flow materially more usable and corrected the main operational workflow gap.

Completed outcomes:

- direct Sales Invoice now supports canonical line discount and document charges
- Sales payment methods now map to hidden settlement accounts for standalone Sales
- direct invoice UI now supports discount, charges, and pay-now flows
- operational linked invoice creation now loads stock lines from posted Delivery Notes instead of guessing from Sales Order remaining quantity
- service linked lines still come from remaining Sales Order quantity

QA follow-up on 2026-05-18 fixed three manual-test blockers:

- sales invoice vouchers now show gross revenue, separate discount debit, separate charge revenue, and tax instead of only net totals
- sales payment receipt vouchers now reject non-posting/header accounts at the backend accounting validation gate, for both inline invoice settlement and later Record Payment
- ledger repositories now call the Accounting `VoucherValidationService` as a final defense before ledger persistence
- opening a receipt voucher from the voucher list now resolves a receipt form first instead of falling back to a cloned Journal Voucher form

---

## Technical Developer View

### What changed

#### 1. Direct invoice commercial terms foundation

Implemented canonical invoice math and posting support for:

- line discount (`discountType`, `discountValue`)
- charge rows / additions
- tax on discounted bases
- totals that include discounted lines plus charges

Primary files:

- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/application/sales/services/SalesInvoiceCalculationService.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/api/validators/sales.validators.ts`

#### 2. Sales payment abstraction

Added Sales-facing payment method mapping through `SalesSettings.paymentMethodConfigs`.

Supported methods:

- `CASH`
- `BANK_TRANSFER`
- `CHECK`
- `CREDIT_CARD`
- `OTHER`

This allows standalone Sales to work without forcing users to enter raw settlement-account IDs.

Primary files:

- `backend/src/domain/sales/entities/SalesSettings.ts`
- `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`
- `backend/src/application/sales/use-cases/PaymentSyncUseCases.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `frontend/src/api/salesApi.ts`

#### 3. Direct invoice UI pass

Updated the native Sales invoice page to expose:

- line discount controls
- charge rows
- pay-now settlement rows
- payment method driven settlement input

Primary file:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`

#### 4. Operational linked invoice alignment

Added a dedicated read contract so linked stock invoicing uses posted Delivery Notes.

New backend contract:

- `GetInvoiceableLinkedSalesSourceUseCase`
- `GET /tenant/sales/orders/:id/invoiceable-linked-source`

Behavior:

- stock lines come from posted DN lines with `dnLineId`
- already-invoiced quantity is subtracted per `dnLineId`
- service lines come from remaining SO quantity
- linked stock warehouse is inherited from DN

Primary files:

- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/api/routes/sales.routes.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`

#### 5. DTO cleanup

Removed duplicate `SalesPaymentMethodConfigDTO` declaration from backend DTOs.

#### 6. Manual QA blocker fixes

The revenue voucher now records:

- debit AR for the final invoice total
- debit Sales discount/expense for line discounts
- credit gross item revenue
- credit charge/addition revenue
- credit tax payable

Receipt settlement vouchers now run `VoucherValidationService.validateCore()` and `validateAccounts()` before ledger writes. This makes Accounting the final authority: a HEADER account cannot be posted even if the UI or a crafted API request sends it.

Root cause of the manual-test failure:

- the Accounting validation service did not approve the HEADER account,
- the Sales settlement code bypassed the validation service by building a posted `VoucherEntity` and calling `ledgerRepo.recordForVoucher()` / `voucherRepo.save()` directly,
- the later Record Payment path had the same pattern,
- both paths are now validated before ledger, voucher, payment-history, or invoice-status writes,
- the ledger repository itself now runs `VoucherValidationService.validateCore()` and `validateAccounts()` before persistence, so future bypass attempts fail at the final boundary using the Accounting engine rule set.

The Sales invoice settlement UI now uses the shared `AccountSelector` for AR and settlement account overrides, so users select valid posting accounts instead of typing free-form account codes.

`VouchersListPage` now resolves the voucher form by `type`/`voucherType` before falling back to Journal Voucher. This prevents receipt vouchers from opening in an unrelated cloned JV form.

---

## Files Changed

- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/domain/sales/entities/SalesSettings.ts`
- `backend/src/application/sales/services/SalesInvoiceCalculationService.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`
- `backend/src/application/sales/use-cases/PaymentSyncUseCases.ts`
- `backend/src/domain/accounting/services/VoucherValidationService.ts`
- `backend/src/infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository.ts`
- `backend/src/infrastructure/prisma/repositories/accounting/PrismaLedgerRepository.ts`
- `backend/src/seeder/verifyAccountAccess.ts`
- `backend/src/seeder/verifyCostCenterPolicy.ts`
- `backend/src/seeder/verifyPolicies.ts`
- `backend/src/seeder/verifyPolicyErrorModes.ts`
- `backend/src/seeder/verifyProductionHardening.ts`
- `backend/src/seeder/verifyReverseReplace.ts`
- `backend/src/api/controllers/sales/SalesController.ts`
- `backend/src/api/routes/sales.routes.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/api/validators/sales.validators.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/accounting/pages/VouchersListPage.tsx`
- `backend/src/tests/domain/sales/SalesInvoice.test.ts`
- `backend/src/tests/application/sales/SalesPostingUseCases.test.ts`
- `backend/src/tests/application/sales/SalesPaymentSyncUseCases.test.ts`
- `backend/src/tests/application/sales/SalesInvoiceSettlementPosting.test.ts`
- `backend/src/tests/application/sales/GetInvoiceableLinkedSalesSourceUseCase.test.ts`
- `backend/src/tests/infrastructure/accounting/LedgerRepositoryGuard.test.ts`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/README.md`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/tasks/95-sales-standalone-operational-workflow-contract.md`

---

## Verification

Commands run:

- `npx tsc --noEmit -p backend/tsconfig.json --pretty false` ✅
- `frontend: npm run typecheck -- --pretty false` ✅
- `backend: npm test -- --runTestsByPath src/tests/application/sales/GetInvoiceableLinkedSalesSourceUseCase.test.ts src/tests/application/sales/SalesPostingUseCases.test.ts src/tests/application/sales/SalesPaymentSyncUseCases.test.ts src/tests/application/sales/SalesInvoiceSettlementPosting.test.ts src/tests/domain/sales/SalesInvoice.test.ts` ✅
- `backend: npm run test -- SalesPostingUseCases SalesInvoiceSettlementPosting` ✅ — 22/22
- `backend: npm run test -- LedgerRepositoryGuard SalesInvoiceSettlementPosting SalesPaymentSyncUseCases` ✅ — 18/18
- `backend: npm run test -- "SalesPostingUseCases|SalesInvoiceSettlementPosting|SalesPaymentSyncUseCases|SalesDocumentNumberUniqueness|DocumentPolicyResolver"` ✅ — 65/65
- `backend: npm run test -- "LedgerRepositoryGuard|SalesPostingUseCases|SalesInvoiceSettlementPosting|SalesPaymentSyncUseCases|SalesDocumentNumberUniqueness|DocumentPolicyResolver"` ✅ — 69/69
- `backend: npx tsc --noEmit --pretty false` ✅
- `frontend: npm run typecheck -- --pretty false` ✅

Focused backend result:

- 5 suites passed
- 31 tests passed

Manual browser QA:

- Not run in this task

---

## Acceptance Criteria Met

- `sales_invoice_direct` supports discount, charges, and pay-now contract
- invoice vouchers keep discount and charge accounting lines visible
- receipt settlement vouchers block non-posting/header accounts before ledger write
- ledger persistence runs Accounting engine validation and blocks invalid vouchers/non-posting accounts even if a caller bypasses the normal posting service
- receipt vouchers open with a receipt form instead of a JV clone when `formId` is missing
- standalone Sales can use payment methods without mandatory raw account IDs
- operational linked invoice stock lines source from posted Delivery Notes
- linked stock lines carry `dnLineId`
- linked stock warehouse is not chosen manually in the invoice UI
- architecture doc updated
- end-user guide created
- completion report created

---

## Known Follow-ups

1. Manual QA still needed for:
   - direct invoice with discount + charge + pay-now
   - SO -> DN -> linked SI
   - mixed stock + service order
   - partial delivery / partial invoicing

2. Free goods / promotions are still deferred.

3. Price lists are still deferred.

---

## End-User View

Sales users can now do two practical invoice workflows more safely:

- In **simple direct invoicing**, they can add discounts, add extra charges, and record immediate payment using business payment methods like Cash or Bank Transfer.
- In **operational invoicing**, the system now invoices stock items only from what was actually delivered on posted Delivery Notes, which prevents invoicing undelivered goods by mistake.

Discounts and additions now also appear clearly in the accounting voucher. If a user records a payment, the payment account must be a real posting account such as a cashbox or bank, not a header account.

This means the Sales app now behaves more like a real market-standard workflow for both small direct-invoice businesses and warehouse-driven operational businesses.

---

## Linked Docs

- Architecture: [docs/architecture/sales.md](D:/DEV2026/ERP03/docs/architecture/sales.md)
- User guide: [docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md](D:/DEV2026/ERP03/docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md)
