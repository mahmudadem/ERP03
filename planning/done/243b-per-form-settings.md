# Task 243-B — Per-Form Settings

**Date:** 2026-06-19  
**Branch:** `codex/243b-form-settings-plan`  
**Status:** Implemented; review/PR pending.

## Technical Developer View

Implemented Task 243-B as revised by the owner: settings belong to the actual form instance, not just to a document type.

Changed:

- `backend/src/repository/interfaces/designer/IFormSettingsRepository.ts`
- `backend/src/application/designer/use-cases/FormSettingsUseCases.ts`
- `backend/src/infrastructure/firestore/repositories/designer/FirestoreFormSettingsRepository.ts`
- `backend/src/infrastructure/prisma/repositories/designer/PrismaFormSettingsRepository.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/api/controllers/accounting/VoucherFormController.ts`
- `backend/src/api/routes/accounting.routes.ts`
- `backend/src/api/routes/sales.routes.ts`
- `backend/src/api/routes/purchases.routes.ts`
- `frontend/src/api/voucherFormApi.ts`
- `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- `docs/architecture/form-settings.md`
- `docs/architecture/pricing.md`
- `docs/user-guide/forms-management.md`
- `planning/tasks/243-pricing-policy-management.md`

The new repository contract persists namespace-based settings per form identity:

- `builtInFormKey` for built-in/native forms such as `native.sales.invoice`;
- `formId` for Form Designer default or cloned forms.

Forms Management now lists built-in/native forms alongside designer forms and exposes a Form Settings action. The modal uses vertical tabs with Account Defaults first and Pricing Behavior second. Account Defaults are persisted but not pushed into hidden posting-sensitive behavior in this slice.

Pricing Behavior applies a per-form default line price source to new draft Sales Invoice and Purchase Invoice native forms, and to Form Designer-rendered sales/purchase forms when a settings record exists for the renderer's form id.

Cloning a designer form through the backend clone endpoint copies the source form settings to the clone.

## End-User View

Company admins can open Forms Management and configure settings for each form.

For example:

- Native Sales Invoice can use **Last party price**.
- Wholesale Sales Invoice can use **Price list**.
- Retail Sales Invoice can use **Item default** or **Last party price**.

The setting is tied to the form the user opens. Two forms that both create a sales invoice can still have different defaults.

## Accounting / Control Impact

No ledger posting, tax, AR/AP, inventory valuation, stock movement, approval, period-lock, or voucher mutation rules changed.

Account defaults are stored as visible convenience defaults only. They must remain visible/editable on documents and pass normal validation before they are allowed to influence posting.

Pricing behavior remains strict per Task 242. If the selected source has no match, ERP03 leaves the price blank/manual instead of silently falling back to another source.

## Verification

- `npm --prefix backend run build` — passed.
- `npm --prefix frontend run typecheck` — passed.

## Remaining Work

- Task 243-C: right-click price-column per-document/session override.
- Task 243-D: parity sweep after 243-B/C, especially across more native forms beyond SI/PI and designer renderer paths.
- Account Defaults application should be expanded only after each target document field and posting validation path is confirmed.
