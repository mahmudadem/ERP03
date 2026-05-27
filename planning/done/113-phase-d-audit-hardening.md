# 113 — Phase D Audit Hardening (D.3 + D.4)

**Date:** 2026-05-22
**Task:** Audit implemented Phase D items for gaps/bugs and auto-fix
**Status:** ✅ Complete
**Time spent:** ~1.3h

---

## What Was Changed

### Backend
- Hardened recurring controller auth/context handling in `backend/src/api/controllers/sales/RecurringInvoiceController.ts`:
  - Enforced required tenant context (`req.user.companyId`)
  - Fixed user identity source to `req.user.uid` (with fallback) instead of non-existent `req.user.id`
  - Added explicit payload validation for create/clone requests (required fields + non-empty lines)
- Hardened sales audit-log controller context handling in `backend/src/api/controllers/RecordAuditController.ts`:
  - Enforced required tenant context via authenticated user (removed permissive fallback)
- Strengthened recurring template domain validation in `backend/src/domain/sales/entities/RecurringInvoiceTemplate.ts`:
  - Required non-empty template name
  - Validated `startDate`, `nextGenerationDate`, and optional `endDate` format (`YYYY-MM-DD`)
  - Enforced non-negative payment terms
  - Enforced recurring line quantity > 0
- Added update-level guard in `backend/src/application/sales/use-cases/RecurringInvoiceUseCases.ts`:
  - Explicitly rejects empty-line updates

### Frontend
- Completed recurring-invoices i18n in `frontend/src/modules/sales/pages/RecurringInvoicesPage.tsx`:
  - Replaced hardcoded labels/errors/actions with `t('sales.recurring.*')`
  - Added weekly `dayOfWeek` selection for template creation
- Closed D.4 functional gap by wiring clone-to-recurring from SI detail page in `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`:
  - Added **Clone to Recurring** action button
  - Added clone modal for schedule parameters
  - Integrated `recurringInvoiceApi.cloneToTemplate(...)`
- Added recurring translation keys in:
  - `frontend/src/locales/en/common.json`
  - `frontend/src/locales/ar/common.json`
  - `frontend/src/locales/tr/common.json`

### Documentation
- Updated architecture doc:
  - `docs/architecture/sales.md` (added post-implementation hardening notes for recurring/audit controls)
- Updated end-user doc:
  - `docs/user-guide/sales/recurring-invoices.md` (weekday behavior and actual clone button flow)
- Updated prior completion report:
  - `planning/done/112-phase-d4-recurring-invoices.md` (removed fixed known issues: missing clone button, missing i18n)

---

## Verification

- `backend` recurring tests:
  - `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/RecurringInvoiceUseCases.test.ts`
  - Result: ✅ pass (23 tests)
- `frontend` type check:
  - `npm --prefix frontend run typecheck`
  - Result: ✅ pass

---

## Acceptance Criteria Covered

- [x] Audit completed for already-built Phase D items (D.3/D.4 focus)
- [x] Found and fixed real gaps (identity/context bug + missing clone UI + i18n gap + validation gaps)
- [x] No regressions in recurring test suite
- [x] Architecture docs updated
- [x] End-user guide updated

---

## Technical Developer View

The highest-risk defect was identity extraction in recurring endpoints (`req.user.id` vs `req.user.uid`). In authenticated calls this could produce invalid actor metadata or runtime failures in template creation/updates. The fix aligns recurring controllers with established sales controller conventions, enforces company context explicitly, and prevents malformed payloads from reaching domain logic as 500-style failures.

Recurring behavior is now stricter and safer: invalid template names/dates/non-positive quantities are rejected early and deterministically. Frontend now fully supports the templated recurring path by exposing clone-from-invoice directly on Sales Invoice detail, keeping D.4 aligned with the phase scope.

## End-User View

Recurring invoices are now easier and safer to use:
- You can create a recurring template directly from a Sales Invoice using **Clone to Recurring**.
- When scheduling weekly recurrences, you can choose the weekday.
- Labels/messages are translated (English/Arabic/Turkish) instead of showing technical defaults.
- Invalid recurring settings are blocked with clear validation before saving.

---

## Next Recommendation

Proceed with **Phase D.5 — Sales Return Enhancements** (refund vs credit note, restocking fees, return reasons). Estimated effort: **1.5–2.5 days**.
