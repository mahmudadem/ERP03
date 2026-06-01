# Task 152 — Sales Document Messaging + Attachments Backend (non-invoice docs)

**Status:** 🔵 Open (filed 2026-06-01)
**Owner:** unassigned
**Branch:** TBD
**Depends on / unblocks:** completes the native-detail contract ([docs/architecture/native-detail-contract.md](../../docs/architecture/native-detail-contract.md)) for Quote / SO / DN / SR.

## Why

During the native-detail contract rollout (Task 148) we discovered the contract doc
**overstated backend readiness**. WhatsApp/Telegram send and attachments exist on the
backend **only for Sales Invoice**. The other four Sales documents need new backend
endpoints before their detail pages can offer messaging/attachments. The frontend
shared components (`SendDocumentButton`, `AttachmentsCard`, `RecordAuditModal`) are
already generic and ready to wire once the backend exists.

## Backend reality at time of filing (verified 2026-06-01)

| Capability | Quote | SO | DN | SI | SR |
|---|:--:|:--:|:--:|:--:|:--:|
| Update (edit) endpoint | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cancel / Discard | ✅ delete | ✅ cancel | 🔴 none | ✅ delete | 🔴 none |
| WhatsApp / Telegram send | 🔴 | 🔴 | 🔴 | ✅ | 🔴 |
| Attachments (list/upload/remove/link) | 🔴 | 🔴 | 🔴 | ✅ | 🔴 |
| Audit-event emission | 🔴 | ✅ | ✅ | ✅ | ✅ |

## Scope (build, mirroring the Sales Invoice stack)

1. **Messaging** — for Quote, SO, DN, SR add:
   - `POST /tenant/sales/<doc>/:id/send-whatsapp` and `/send-telegram`
   - controller methods + use-cases, reusing `CommunicationsSettingsMessagingResolver`
   - frontend: wire `SendDocumentButton` with `communicationsApi.getSettings()` accounts
     and per-doc `send*` handlers (pattern: `SalesInvoiceDetailPage`).
2. **Attachments** — for Quote, SO, DN, SR add:
   - `GET/POST/DELETE /tenant/sales/<doc>/:id/attachments` + `/:aid/link`
   - storage + repo (mirror `SalesInvoiceAttachmentController` + repository)
   - frontend: drop in `AttachmentsCard` with the per-doc `api` object.
3. **Audit emission for Quotes** — `QuoteUseCases` does not emit record-change logs;
   add `recordCreate/recordUpdate/recordStatusChange` so the (already-wired-capable)
   `RecordAuditModal entityType="SALES_QUOTE"` shows real history. Then add the History
   button to Quotation Detail.
4. **Cancel for DN / SR** — decide accounting-correct behavior (DN/SR currently have no
   cancel/delete). Likely: delete for DRAFT, no in-place void for POSTED.

## Out of scope

- Email delivery execution (separately deferred post-D.8).
- Any change to posting math, AP/AR, tax, or inventory valuation.

## Definition of Done

- Each non-invoice Sales detail page offers Send (WhatsApp/Telegram), Attachments, and
  (Quote) History, matching Sales Invoice.
- `docs/architecture/native-detail-contract.md` per-page table flips the relevant cells
  to ✅ and the "backend already supports" claim is corrected.
- Manual QA scripts added to `planning/QA-QUEUE.md`.
