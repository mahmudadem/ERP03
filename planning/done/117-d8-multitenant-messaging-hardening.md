# Task 117 — D.8 Multi-Tenant Messaging Hardening

**Date:** 2026-05-23  
**Owner:** Codex (CTO mode)  
**Scope:** Sales roadmap D.8 hardening follow-up  
**Related plan:** `planning/tasks/sales-and-purchases-completion-roadmap.md`

---

## Summary

Refactored outbound invoice messaging to align with ERP03 multi-tenant architecture:

- Removed shared-sender assumption from message dispatch flow
- Added company-owned sender account model in Sales settings
- Added encrypted per-account credential handling
- Added sender account selection in invoice WhatsApp send modal

This converts D.8 from a platform-level shortcut to a tenant-correct model.

---

## Technical Developer View

### Architecture and contracts

- Extended Sales settings domain model:
  - `backend/src/domain/sales/entities/SalesSettings.ts`
  - new `messagingAccounts` collection in settings payload
- Added credential cipher contract:
  - `backend/src/application/sales/services/ICredentialCipher.ts`
- Added messaging account resolver contract:
  - `backend/src/application/sales/services/ICompanyMessagingResolver.ts`
- Added resolver implementation:
  - `backend/src/infrastructure/messaging/SalesSettingsMessagingResolver.ts`
- Updated provider contract to accept runtime sender config:
  - `backend/src/application/sales/services/IInvoiceMessagingProvider.ts`
- Updated Meta provider to support per-request runtime credentials:
  - `backend/src/infrastructure/messaging/MetaWhatsAppCloudProvider.ts`

### Use case and API behavior

- Updated WhatsApp send use case to resolve tenant sender account before dispatch:
  - `backend/src/application/sales/use-cases/InvoiceMessagingUseCases.ts`
- Updated endpoint handling:
  - optional `messagingAccountId` accepted by `POST /tenant/sales/invoices/:id/send-whatsapp`
  - files:
    - `backend/src/api/controllers/sales/SalesController.ts`
    - `backend/src/api/validators/sales.validators.ts`
    - `frontend/src/api/salesApi.ts`

### Security and tenancy controls

- Credentials are write-only from frontend and encrypted at save time.
- Credentials are never returned in settings DTO.
- Runtime sender resolution is company-scoped and supports:
  - multiple accounts per channel
  - active/inactive status
  - one default account per channel (normalized)

### UI and localization

- Added **Communications** tab in Sales settings for account management:
  - `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
- Added sender account selector to invoice WhatsApp modal:
  - `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- Updated i18n catalogs:
  - `frontend/src/locales/en/common.json`
  - `frontend/src/locales/ar/common.json`
  - `frontend/src/locales/tr/common.json`

### Documentation updates

- Technical architecture:
  - `docs/architecture/sales.md`
- End-user guides:
  - `docs/user-guide/sales/invoice-whatsapp-sharing.md`
  - `docs/user-guide/sales/communication-accounts.md`
  - `docs/user-guide/sales/README.md`

---

## End-User View

Company admins can now configure their own outbound sender identities in:

`Sales -> Settings -> Communications`

Users sending invoices via WhatsApp can choose the sender account (or use the default), and each company can maintain multiple numbers/accounts without sharing a global platform sender.

---

## Verification

- `npm --prefix backend run build` ✅
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend test -- --runInBand backend/src/tests/application/sales/InvoiceMessagingUseCases.test.ts` ✅

---

## Acceptance Criteria Check

- [x] Sender identity is tenant-scoped (not globally shared)
- [x] Multiple sender accounts per company are supported
- [x] Credentials are encrypted at rest and not exposed via settings API
- [x] Invoice send flow supports sender selection
- [x] Architecture and user guides updated

---

## Known Follow-ups

- Email and Telegram channel execution paths are not yet implemented (account model is in place).
- D.6 document attachments remains the final open item in Phase D.

---

## Time

- **Estimated:** 4-6 hours  
- **Actual:** ~2.8 hours

