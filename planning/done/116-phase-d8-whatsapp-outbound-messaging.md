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

---

## Manual QA Script — Operator View (run sequentially)

**Pre-req:** Backend + frontend dev servers running. WhatsApp Cloud credentials configured (env). At least one posted Sales Invoice exists. A test WhatsApp number you control is available to receive the message.

> Note: this report covers the initial WhatsApp send. Multi-tenant sender selection is covered in report 117.

### Test 1 — Send action only appears on posted invoices
1. Open **Sales → Invoices**.
2. Open a **Draft** invoice.
3. Look at the action bar.
4. Open a **Posted** invoice.
- **Expected:** **Send via WhatsApp** button is hidden on the draft and visible on the posted invoice.

### Test 2 — Send a posted invoice successfully
1. From a posted invoice, click **Send via WhatsApp**.
2. In the modal, confirm/enter the recipient phone in international format (e.g. `+15551234567`).
3. Leave the default message or edit it.
4. Click **Send**.
- **Expected:** success toast appears; the WhatsApp message arrives on the test number.

### Test 3 — Invalid phone is rejected
1. Open a posted invoice and click **Send via WhatsApp**.
2. Enter an invalid phone (e.g. `12345`).
3. Click **Send**.
- **Expected:** error message displayed, no message dispatched.

### Test 4 — Default recipient from customer phone
1. Ensure the customer on a posted invoice has a phone number on their card.
2. Click **Send via WhatsApp**.
- **Expected:** the recipient phone field is pre-filled with the customer's phone.

### Results

| # | Test | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Action hidden on draft, visible on posted | | |
| 2 | Successful send | | |
| 3 | Invalid phone rejected | | |
| 4 | Default recipient pre-fill | | |

