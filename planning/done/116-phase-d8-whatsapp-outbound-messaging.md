# Task 116 — Phase D.8 Outbound Messaging (WhatsApp-First)

**Date:** 2026-05-22  
**Owner:** Codex (CTO mode)  
**Scope:** Sales roadmap Phase D.8  
**Related plan:** `planning/tasks/sales-and-purchases-completion-roadmap.md`

---

## Summary

Completed Phase D.8 using a WhatsApp-first delivery model:

- Added outbound invoice send flow from Sales Invoice detail page
- Implemented backend provider abstraction for outbound channels
- Integrated Meta WhatsApp Cloud API as the first provider
- Kept architecture ready for email as a follow-up channel without Sales-layer refactor

---

## Technical Developer View

### Architecture and contracts

- Added messaging provider contract:
  - `backend/src/application/sales/services/IInvoiceMessagingProvider.ts`
- Added provider implementation:
  - `backend/src/infrastructure/messaging/MetaWhatsAppCloudProvider.ts`
- Added use case:
  - `backend/src/application/sales/use-cases/InvoiceMessagingUseCases.ts`
- Added DI wiring:
  - `diContainer.invoiceMessagingProvider` in `backend/src/infrastructure/di/bindRepositories.ts`
  - Env config:
    - `WHATSAPP_CLOUD_ACCESS_TOKEN`
    - `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
    - optional `WHATSAPP_CLOUD_API_VERSION` (default `v22.0`)
    - optional `ERP_APP_BASE_URL` for default deep link text

### API changes

- Added endpoint:
  - `POST /tenant/sales/invoices/:id/send-whatsapp`
- Files:
  - `backend/src/api/routes/sales.routes.ts`
  - `backend/src/api/controllers/sales/SalesController.ts`
  - `backend/src/api/validators/sales.validators.ts`

### Use-case rules

`SendSalesInvoiceWhatsappUseCase` enforces:
- invoice must exist and be `POSTED`
- recipient phone must be valid E.164
- message length <= 4096
- fallback recipient from customer phone when explicit `toPhoneNumber` is not provided

### Frontend changes

- Added Sales Invoice detail action: **Send via WhatsApp** (posted invoices)
- Added modal fields:
  - recipient phone
  - optional document URL
  - editable message text
- Files:
  - `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
  - `frontend/src/api/salesApi.ts`
  - `frontend/src/locales/en/common.json`
  - `frontend/src/locales/ar/common.json`
  - `frontend/src/locales/tr/common.json`

### Documentation updates

- Technical doc updated:
  - `docs/architecture/sales.md`
- End-user doc added:
  - `docs/user-guide/sales/invoice-whatsapp-sharing.md`
  - linked from `docs/user-guide/sales/README.md`

---

## End-User View

You can now send a posted sales invoice directly through WhatsApp:

1. Open a posted invoice.
2. Click **Send via WhatsApp**.
3. Confirm recipient phone and message, then send.

The system validates phone format and sends immediately through your configured WhatsApp business channel.

---

## Verification

- `npm --prefix backend run build` ✅
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/InvoiceMessagingUseCases.test.ts` ✅

---

## Acceptance Criteria Check

- [x] Invoice can be sent from inside app via outbound channel
- [x] Backend enforces validation and posted-invoice gate
- [x] Provider abstraction in place for future channels
- [x] Technical architecture documentation updated
- [x] End-user documentation added

---

## Known Follow-ups

- Email channel remains deferred and should be added as another provider path under the same abstraction.
- D.6 document attachments remains open and is now the last Phase D work item.

---

## Time

- **Estimated:** 1.5-2.5 hours  
- **Actual:** ~1.9 hours

