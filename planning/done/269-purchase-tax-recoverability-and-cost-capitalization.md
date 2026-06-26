# Task 269 - Purchase Tax Recoverability and Cost Capitalization

**Status:** Complete  
**Date:** 2026-06-26  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Estimated time:** 3-5 hours  
**Actual time:** ~2.6 hours

## Technical Developer View

Task 269 added purchase-side tax recoverability to Tax Code master data and Purchase Invoice posting.

Changed files:

- `backend/prisma/schema.prisma`
- `backend/src/domain/shared/entities/TaxCode.ts`
- `backend/src/application/shared/use-cases/TaxCodeUseCases.ts`
- `backend/src/infrastructure/prisma/repositories/shared/PrismaTaxCodeRepository.ts`
- `backend/src/domain/purchases/entities/PurchaseInvoice.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/tests/application/shared/TaxCodeUseCases.test.ts`
- `backend/src/tests/application/purchases/PurchaseInvoiceGoldenVoucher.test.ts`
- `frontend/src/api/sharedApi.ts`
- `frontend/src/modules/settings/pages/TaxCodesPage.tsx`
- `docs/architecture/settings.md`
- `docs/architecture/purchases.md`
- `docs/user-guide/settings/tax-codes.md`
- `docs/user-guide/purchases/README.md`
- `planning/tasks/269-purchase-tax-recoverability-and-cost-capitalization.md`

Backend behavior:

- `TaxCode.purchaseTaxTreatment` supports `RECOVERABLE` and `NON_RECOVERABLE`.
- Missing/old tax codes default to `RECOVERABLE`, preserving existing purchase voucher output.
- Tax-code lock rules now treat `purchaseTaxTreatment` as accounting-critical after posted usage.
- Purchase Invoice line normalization capitalizes purchase tax into `lineTotalDoc/Base` only when treatment is `NON_RECOVERABLE`.
- Recoverable purchase tax still posts as a separate tax debit.
- Non-recoverable purchase tax posts no separate tax line; inventory/expense debit equals gross cost.
- Direct stock PI movements use the adjusted `lineTotalBase`, so non-recoverable purchase tax flows into movement cost and average cost.

Frontend behavior:

- Tax Codes list shows **Purchase Treatment** beside **Price Basis**.
- Add/edit modal has a required **Purchase Tax Treatment** dropdown:
  - Recoverable - post purchase tax separately.
  - Non-recoverable - include purchase tax in item/expense cost.
- Locked used tax codes disable treatment edits, backed by the backend lock.

## End-User View

Users can now model two real purchase-tax cases:

- If the tax is recoverable, the bill shows tax separately and item/expense cost stays net of tax.
- If the tax is not recoverable, the tax becomes part of the item or expense cost.

This is separate from inclusive/exclusive price basis. Inclusive/exclusive decides whether the entered price already includes tax. Recoverable/non-recoverable decides whether purchase tax is posted separately or included in cost.

For stock purchases, non-recoverable tax increases the stock movement cost and blended average cost. Sales tax behavior is unchanged.

## Verification

Passed:

```powershell
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchaseInvoiceGoldenVoucher.test.ts
npm --prefix backend test -- --runInBand src/tests/application/shared/TaxCodeUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
npm --prefix backend test -- --runInBand src/tests/application/sales/SalesInvoiceGoldenVoucher.test.ts
npm --prefix frontend run typecheck
```

Final backend/frontend builds were run after documentation updates as part of the commit gate.

## Known Follow-Ups

- Partly recoverable purchase tax is out of scope for v1.
- Purchase Return direct/no-source UX remains tracked separately in Task 271.
- Stock negative valuation/reporting remains tracked separately in Task 270.
