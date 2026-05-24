# Completion Report: Phase D.4 — Recurring Invoices

**Date:** 2026-05-22
**Task:** Sales completion roadmap — Phase D.4 Recurring Invoices (templated + scheduled)
**Status:** ✅ COMPLETE

---

## What Was Built

Phase D.4 adds recurring invoice support with two modes:
1. **Templated (Clone):** One-click "clone this invoice" to create a recurring template from an existing Sales Invoice
2. **Scheduled:** Automatic invoice generation on a cadence (WEEKLY/MONTHLY/QUARTERLY/ANNUALLY) with pause/resume/cancel, end-date or max-occurrence limits, and missed-run catchup

## Files Changed

### Backend (new files)
| File | Purpose |
|------|---------|
| `backend/src/domain/sales/entities/RecurringInvoiceTemplate.ts` | Domain entity with validation, state transitions (pause/resume/cancel/advance), serialization |
| `backend/src/repository/interfaces/sales/IRecurringInvoiceTemplateRepository.ts` | Repository interface + barrel export |
| `backend/src/infrastructure/firestore/repositories/sales/FirestoreRecurringInvoiceTemplateRepository.ts` | Firestore implementation with mapper |
| `backend/src/application/sales/use-cases/RecurringInvoiceUseCases.ts` | 7 use cases: Create, Update, Pause, Resume, Cancel, Generate, CloneToTemplate |
| `backend/src/api/controllers/sales/RecurringInvoiceController.ts` | HTTP controller with 8 handlers |
| `backend/src/tests/application/sales/RecurringInvoiceUseCases.test.ts` | 19 unit tests |

### Backend (modified files)
| File | Change |
|------|--------|
| `backend/src/repository/interfaces/sales/index.ts` | Added export for IRecurringInvoiceTemplateRepository |
| `backend/src/api/routes/sales.routes.ts` | Added 8 new routes for recurring invoices |
| `backend/src/infrastructure/di/bindRepositories.ts` | Added import + DI getter for recurringInvoiceTemplateRepository |

### Frontend (new files)
| File | Purpose |
|------|---------|
| `frontend/src/modules/sales/pages/RecurringInvoicesPage.tsx` | Full page with list, status filter, create modal, pause/resume/cancel actions, generate button |

### Frontend (modified files)
| File | Change |
|------|--------|
| `frontend/src/api/salesApi.ts` | Added recurring invoice types (RecurringInvoiceTemplateDTO, RecurrenceFrequency, etc.) + `recurringInvoiceApi` object with 9 methods |
| `frontend/src/router/routes.config.ts` | Added lazy import + route for `/sales/recurring-invoices` |

### Documentation
| File | Change |
|------|--------|
| `docs/architecture/sales.md` | Added "Sales recurring invoices (Phase D.4)" section with architecture, API endpoints, key files |
| `docs/user-guide/sales/recurring-invoices.md` | New user guide with step-by-step instructions |

## What Was Tested

### Unit Tests (19 new, all passing)
- **Entity tests (10):** creation, validation (invalid frequency, empty lines), state transitions (pause/resume/cancel/advance), completion logic (maxOccurrences, endDate), serialization
- **Use case tests (9):** CreateRecurringInvoiceTemplate, Pause (active + not-active), Resume (paused + not-paused), Cancel, Generate (with templates + empty), CloneInvoiceAsTemplate

### Type Check
- Backend `tsc --noEmit`: ✅ clean
- Frontend `tsc --noEmit`: ✅ clean

### Full Test Suite
- 1197 passed, 3 failed (pre-existing `SendChatMessageUseCase` AI credit failures — unrelated)
- 0 regressions

## Acceptance Criteria Met

- [x] Templated recurring invoices (clone from existing SI)
- [x] Scheduled recurring invoices (WEEKLY/MONTHLY/QUARTERLY/ANNUALLY)
- [x] Day of month/week targeting
- [x] End date and max occurrences limits
- [x] Pause/resume/cancel lifecycle
- [x] Auto-completion when limits reached
- [x] Missed-run catchup (generate all due)
- [x] Generated invoices created as DRAFT
- [x] Invoice number sequence incremented correctly
- [x] Frontend list page with status filter and actions
- [x] Frontend create modal with line editor
- [x] Backend type-clean
- [x] Frontend type-clean
- [x] Unit tests passing
- [x] Architecture documentation updated
- [x] User guide created

## Known Issues / Follow-ups

- Generated invoices are created with hardcoded `uom: 'Unit'` and `trackInventory: false` — should resolve from item master in a follow-up
- No automatic background scheduler (Cloud Functions cron) — generation is manual via "Generate Due" button

## Next Steps

- Phase D.5: Sales-return enhancements (refund vs credit note, restocking fees, return reasons)
- Phase D.6: Document attachments
- Phase D.7: Multiple invoice templates
- Phase D.8: Email integration
- Or Phase E: Cross-cutting cleanup (PostingLog on DN+SR, FX on payments, idempotency, integration tests)

---

## Manual QA Script — Operator View (run sequentially)

**Pre-req:** Backend + frontend dev servers running. Logged in as admin with at least one posted Sales Invoice and one active customer with items on file.

### Test 1 — Create a recurring template by cloning an invoice
1. Open **Sales → Invoices**.
2. Open any posted invoice from the list.
3. Click **Clone as Recurring Template** (or the recurring icon in the action bar).
4. In the dialog: set Frequency = **Monthly**, Day of month = **1**, Start date = today, leave End date empty.
5. Click **Save**.
- **Expected:** success toast appears and a new template shows up under **Sales → Recurring Invoices** with status **Active**.

### Test 2 — Create a scheduled template from scratch
1. Open **Sales → Recurring Invoices**.
2. Click **New Recurring Invoice**.
3. Pick a customer, add at least one line item, choose **Weekly** frequency, set max occurrences = **3**.
4. Save.
- **Expected:** template appears in list with status **Active**, frequency **Weekly**, and remaining = 3.

### Test 3 — Pause and resume a template
1. In the Recurring Invoices list, find the template from Test 2.
2. Click **Pause** in its row.
3. Confirm status changes to **Paused**.
4. Click **Resume**.
- **Expected:** status returns to **Active**. List filter "Status: Paused" hides it after resume.

### Test 4 — Generate due invoices manually
1. In **Sales → Recurring Invoices**, click **Generate Due** in the page header.
2. Wait for the success toast.
3. Open **Sales → Invoices** and sort by date desc.
- **Expected:** one new **Draft** invoice exists for each template that had a due run, with the correct customer and line items.

### Test 5 — Cancel a template
1. In **Sales → Recurring Invoices**, click **Cancel** on a template you no longer need.
2. Confirm in the prompt.
- **Expected:** status changes to **Cancelled** and Pause/Resume actions disappear for that row.

### Results

| # | Test | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Clone invoice as recurring template | | |
| 2 | Create scheduled template | | |
| 3 | Pause and resume | | |
| 4 | Generate due invoices | | |
| 5 | Cancel template | | |

