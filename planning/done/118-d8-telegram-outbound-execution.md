# Task 118 — D.8 Telegram Outbound Execution

**Date:** 2026-05-23  
**Owner:** Codex (CTO mode)  
**Scope:** Sales roadmap D.8 follow-up (Telegram execution)  
**Related plan:** `planning/tasks/sales-and-purchases-completion-roadmap.md`

---

## Summary

Implemented Telegram invoice outbound messaging using the same tenant-scoped sender-account architecture introduced in Task 117.

This keeps multi-tenant identity isolation intact while expanding outbound channels.

---

## Technical Developer View

### Backend architecture

- Extended provider contract for Telegram dispatch:
  - `backend/src/application/sales/services/IInvoiceMessagingProvider.ts`
- Extended tenant account resolver contract:
  - `backend/src/application/sales/services/ICompanyMessagingResolver.ts`
- Extended resolver implementation:
  - `backend/src/infrastructure/messaging/SalesSettingsMessagingResolver.ts`
- Extended provider implementation with Telegram Bot API:
  - `backend/src/infrastructure/messaging/MetaWhatsAppCloudProvider.ts`
- Added Telegram send use case:
  - `backend/src/application/sales/use-cases/InvoiceMessagingUseCases.ts`

### API changes

- Added endpoint:
  - `POST /tenant/sales/invoices/:id/send-telegram`
- Files:
  - `backend/src/api/routes/sales.routes.ts`
  - `backend/src/api/controllers/sales/SalesController.ts`
  - `backend/src/api/validators/sales.validators.ts`

### Use-case controls

Telegram send enforces:
- invoice exists and is `POSTED`
- selected/default Telegram sender account exists for company and has credentials
- destination is valid (`chat_id` numeric or `@username`)
- message length <= 4096 chars

### Frontend changes

- Added invoice action: **Send via Telegram** on posted invoices.
- Added modal fields:
  - sender account
  - recipient chat ID/username
  - optional document URL
  - editable message
- Files:
  - `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
  - `frontend/src/api/salesApi.ts`
  - `frontend/src/locales/en/common.json`
  - `frontend/src/locales/ar/common.json`
  - `frontend/src/locales/tr/common.json`

### Documentation updates

- Architecture:
  - `docs/architecture/sales.md`
- End-user docs:
  - `docs/user-guide/sales/invoice-telegram-sharing.md`
  - `docs/user-guide/sales/README.md`

---

## End-User View

Users can now send a posted Sales Invoice through Telegram directly from the invoice page:

1. Open posted invoice.
2. Click **Send via Telegram**.
3. Select sender account.
4. Enter recipient chat ID or `@username`.
5. Send and receive success confirmation with Telegram message ID.

---

## Verification

- `npm --prefix backend run build` ✅
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/InvoiceMessagingUseCases.test.ts` ✅

---

## Acceptance Criteria Check

- [x] Telegram channel can send posted invoices from inside app
- [x] Tenant-scoped sender-account isolation preserved
- [x] Credentials resolved securely from encrypted tenant settings
- [x] Architecture and user-guide docs updated

---

## Known Follow-ups

- Email outbound execution remains deferred.
- D.6 document attachments remains the final open item in Phase D.

---

## Time

- **Estimated:** 1-2 hours  
- **Actual:** ~1.4 hours

