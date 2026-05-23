# Task 115 — Phase D.7 Multiple Invoice Templates (Controlled Model)

**Date:** 2026-05-22  
**Owner:** Codex (CTO mode)  
**Scope:** Sales roadmap Phase D.7  
**Related plan:** `planning/tasks/sales-and-purchases-completion-roadmap.md`

---

## Summary

Implemented Phase D.7 using the controlled-template approach:

- Invoice template selector on Sales Invoice create flow
- Customer-level default invoice template assignment
- Backend/DTO support to persist selected template ID on invoice (`voucherFormId`)
- Kept governance-safe `formType` behavior intact

Free-canvas/sketch-board style layout editing is explicitly deferred for a later update.

---

## Technical Developer View

### Architecture/contract changes

- Added `voucherFormId?: string` to SalesInvoice domain/DTO payload path.
- Added customer default template fields to Party:
  - `defaultSalesInvoiceTemplateId?: string`
  - `defaultSalesInvoiceFormType?: string`
- Updated Sales Invoice create payload handling to send both:
  - `voucherFormId` (selected concrete template)
  - `formType` (persona/governance token)

### Main files changed

- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/api/validators/sales.validators.ts`
- `backend/src/domain/shared/entities/Party.ts`
- `backend/src/application/shared/use-cases/PartyUseCases.ts`
- `frontend/src/api/salesApi.ts`
- `frontend/src/api/sharedApi.ts`
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/shared/components/PartyMasterCard.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/sales.md`
- `docs/user-guide/sales/README.md`
- `docs/user-guide/sales/invoice-templates.md`

### Behavior details

- Sales invoice template options are filtered by invoice persona context (`sales_invoice_direct` vs `sales_invoice_linked`).
- Auto-selection precedence:
  1. customer default template ID
  2. persona-matching default template
  3. first persona-matching template
- Manual selection is allowed and persisted.

---

## End-User View

You can now control invoice layout in two ways:

1. Set a default invoice template on each customer card.
2. Override template during invoice creation using the new **Invoice Template** dropdown.

This controls printable invoice appearance (logo/footer/terms/layout) while keeping document controls and posting logic unchanged.

---

## Verification

- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend run build` ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/domain/sales/SalesInvoice.test.ts` ✅

---

## Acceptance Criteria Check

- [x] Multiple invoice templates can be selected in SI create flow
- [x] Per-customer default template assignment exists
- [x] Selected template identity is persisted on invoice
- [x] Governance-compatible formType behavior remains intact
- [x] Technical + user documentation updated

---

## Known Follow-ups

- Full free-canvas/sketch-board template editing remains deferred.
- Phase D.8 email integration remains not started.

---

## Time

- **Estimated:** 3-5 hours  
- **Actual:** ~2.1 hours

