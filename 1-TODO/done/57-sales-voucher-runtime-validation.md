# Task 57 Completion Report: Sales Voucher Runtime Validation

**Date:** 2026-04-30  
**Agent:** Codex (CTO Mode)  
**Estimate:** 1.2h  
**Actual:** 1.4h  
**Status:** Done - Ready for QA

## Technical Developer View

### Task
Fix Sales voucher Save/Post being disabled when the template uses official semantic Sales field IDs instead of old generic line fields.

### Root Cause
The shared voucher window and `SalesValidator` still contained hardcoded assumptions:
- line quantity = `quantity`
- line price = `unitPrice`
- amount = `amount` / `lineTotal`
- warehouse rule is always line-level

The official Sales templates are more flexible:
- Direct invoice uses header warehouse and line amount semantics.
- Linked invoice can require source documents and line/source warehouse context.
- Service invoice does not require warehouse.
- Templates can use aliases such as `invoicedQty`, `unitPriceDoc`, `lineTotalDoc`, `soLineId`, and `dnLineId`.

### Architecture Change
Added a frontend runtime normalization layer:
- `document-runtime/sales/SalesDocumentProfiles.ts` resolves the document persona/profile.
- `document-runtime/sales/normalizeSalesDocument.ts` converts raw form data into normalized Sales header, active lines, totals, source refs, and warehouse context.
- `SalesValidator` validates normalized semantics instead of raw field IDs.

This keeps `VoucherWindow` generic and prevents the same bug from repeating whenever a new Sales template uses different field IDs.

Also fixed the Sales Invoice API contract:
- `formType` is the template/persona identifier, for example `sales_invoice_direct`.
- `voucherType` is the canonical business document type, `sales_invoice`.
- The frontend now sends those values separately.
- The backend now defensively normalizes official Sales Invoice persona form IDs before validating the use case.

Also fixed the Sales Invoice governance gate:
- Operational workflow mode still defaults to linked invoices.
- `allowDirectInvoicing: true` now explicitly allows the direct invoice persona.
- Company-level governance rules still have the final override, so an explicit company rule can allow or block a persona.

Also fixed a defensive frontend metadata issue:
- Sidebar document policy checks no longer assume `formType`, `baseType`, or `code` are strings.
- Stale/custom object-valued metadata is normalized through common identity fields (`id`, `value`, `code`, `key`, `name`, `label`) instead of crashing with `_a.trim is not a function`.

Follow-up fix for the repeated `_a.trim is not a function` Sales Invoice save crash:
- The first fix covered sidebar policy metadata only.
- The repeated crash came from selector objects still reaching the Sales Invoice save/domain path in fields that must be string IDs.
- `useVoucherActions` now converts selector objects into stable string refs before sending Sales/Purchase invoice payloads.
- `SalesInvoice` domain hydration now converts stale object-valued refs from older saved/custom documents before validation.

### Files Changed
- `frontend/src/modules/accounting/document-runtime/types.ts`
- `frontend/src/modules/accounting/document-runtime/index.ts`
- `frontend/src/modules/accounting/document-runtime/sales/SalesDocumentProfiles.ts`
- `frontend/src/modules/accounting/document-runtime/sales/normalizeSalesDocument.ts`
- `frontend/src/modules/accounting/validation/SalesValidator.ts`
- `frontend/src/modules/accounting/validation/useDocumentValidation.ts`
- `frontend/src/modules/accounting/components/VoucherWindow.tsx`
- `frontend/src/hooks/useVoucherActions.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/utils/documentPolicy.ts`
- `backend/src/application/common/services/DocumentPolicyResolver.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/tests/domain/sales/SalesInvoice.test.ts`
- `backend/src/tests/application/sales/SalesDocumentNumberUniqueness.test.ts`
- `ACTIVE.md`
- `JOURNAL.md`

### Validation Behavior Now
- Direct Sales Invoice requires customer, date, header warehouse, and at least one amount line.
- Linked Sales Invoice requires customer, date, source document context, and line warehouse or source line context.
- Service Sales Invoice requires customer, date, and amount line, but not warehouse.
- Delivery Note can validate item/quantity without requiring amount.
- Sales warnings and dynamic rules can read normalized aliases.

### UX Change
`VoucherWindow` now shows the first Save/Post blocker visibly in the footer beside totals. Users no longer need to hover the disabled button to understand why Save/Post is disabled.

### Tests
- `npm run build` in `frontend/` passed.
- `npm run build` in `backend/` passed.
- `npm test -- --runTestsByPath src/tests/domain/sales/SalesInvoice.test.ts src/tests/application/sales/SalesDocumentNumberUniqueness.test.ts` passed.
- `git diff --check -- frontend/src/hooks/useVoucherActions.ts frontend/src/api/salesApi.ts backend/src/domain/sales/entities/SalesInvoice.ts` passed, with only existing line-ending warnings.
- Added regression coverage for Operational mode + "Allow Direct Invoicing" + `sales_invoice_direct`.
- Fallback validator QA passed for:
  - Direct Sales Invoice with `quantity + unitPriceDoc`
  - Direct Sales Invoice missing warehouse
  - Linked Sales Invoice with `invoicedQty + unitPriceDoc + soLineId`
  - Linked Sales Invoice missing source context
  - Service Sales Invoice without warehouse
- Browser QA could not run in this session because the Browser plugin/Node REPL runtime failed before attaching to the in-app tab with a local missing-path error.

### Acceptance Criteria Met
- Direct Sales Invoice can satisfy the amount validator through `quantity * unitPriceDoc` or line total aliases.
- Direct Sales Invoice save payload no longer sends `sales_invoice_direct` as the canonical `voucherType`.
- Backend also accepts and normalizes `sales_invoice_direct` defensively if an older client sends it as `voucherType`.
- Sales Policy's "Allow Direct Invoicing" setting is respected by the backend governance check.
- Stale/custom document metadata cannot crash the sidebar policy resolver with `_a.trim is not a function`.
- Selector objects from customer/item/warehouse/tax/type fields are normalized before Sales Invoice save, preventing the repeated `_a.trim is not a function` crash.
- Older saved/custom Sales Invoice docs with object-valued refs can hydrate without crashing on `.trim()`.
- Save/Post blockers are visible in the voucher footer.
- The new validation path is profile-based and no longer depends on one fixed Sales line schema.
- Existing Accounting voucher approval/posting code was not changed.

### Known Follow-ups
- Manual UI QA is still required in the running app for Direct, Linked, and Service Sales Invoice personas.
- Purchases should receive the same runtime-profile pattern before adding more flexible Purchase templates.
- Backend Sales use cases already have persona validation; the frontend runtime should stay aligned with backend rules as new personas are added.

## End-User View

Sales invoices now understand the correct form type. A direct invoice asks for a customer, date, warehouse, and at least one priced line. A linked invoice asks for its source document details. A service invoice no longer asks for warehouse when it should not.

When Save/Post is disabled, the voucher footer now shows the reason directly, such as a missing warehouse, missing source document, or missing amount line. This makes the form easier to complete and reduces guessing.

When a user selects a customer, item, warehouse, tax code, or Sales Invoice form, the system now saves the selected ID correctly even if the UI control internally holds a richer object. Older documents with that richer object shape should also reopen without crashing.
