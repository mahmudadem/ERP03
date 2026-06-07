# Native Detail-Page Contract (v1)

**Status:** Draft (2026-05-31)
**Scope:** All native voucher detail pages in the Sales module: Quote, Sales Order, Sales Invoice, Delivery Note, Sales Return. Will extend to Purchases and Accounting natives.
**Why:** v1 ships native forms as the headline UI. The 5 Sales detail pages today were each built in a different era and have non-overlapping feature sets. A small/medium-company user navigating between them sees inconsistent capabilities and layouts — which kills the "finished product" perception this MVP needs.

This document defines a single contract every native detail page must satisfy. Apply it identically to all 5 pages.

## Three generations, one contract

The audit in [planning/tasks/148-native-sales-retest.md](../../planning/tasks/148-native-sales-retest.md) found three distinct page generations:

| Generation | Pages | Has | Lacks |
|-----------|-------|-----|-------|
| **Gen 1: operational** | Quote, SO | Edit, Cancel, Audit | Posting, messaging, attachments |
| **Gen 2: postable** | SI, DN, SR | Post + GL/Period/Audit modals | Edit, Cancel |
| **Gen 3: outbound** | SI only | Messaging, Attachments | — |

The contract below is the **union** of best patterns across all three.

## Contract — every native detail page must

### 1. Have a `viewModel` mode flag

Pattern source: **Quote Detail** (`isReadOnly = !isDraft` at line 196).

```ts
const isEditableStatus = form.status === 'DRAFT'; // or whichever statuses your doc allows editing
const isReadOnly = !isEditableStatus;
```

Every input must consume `disabled={isReadOnly}`. The same form serves Create + Edit + View. No separate `if (isCreateMode)` mega-block.

### 2. Wire the Edit verb

Backend `updateXxx` endpoints exist for all 5 docs (`updateQuote`, `updateSO`, `updateSI`, `updateDN`, `updateReturn`). The native page must call them when `form.id && isEditableStatus`.

`SI Detail`, `DN Detail`, `SR Detail` currently do NOT — fix is to delete their read-only view-mode rendering and merge it with the create-mode form using the `isReadOnly` flag.

### 3. Have a Cancel / Discard action

| Status | Action label | API |
|--------|-------------|-----|
| Editable (DRAFT) | "Discard" | `deleteXxx` if backend supports; else hide |
| Confirmed/Posted | "Cancel" or "Reverse via …" (accounting-correct) | `cancelXxx` (Quote, SO) or navigate to reversal flow (SI → SR, DN → SR, SR → none) |

Pattern source: **SO Detail** `cancelOrder` (line 674). For posted SI/DN, no in-place void; use "Create Reversing Sales Return" navigation button.

### 4. Use the shared status chip helper

Pattern source: **SO Detail** `statusBadgeClass` (line 100). Each module exposes a `statusBadgeClass(status)` helper returning Tailwind classes per status (DRAFT slate, CONFIRMED indigo, POSTED emerald, PARTIALLY_DELIVERED amber, FULLY_DELIVERED emerald, CLOSED slate, CANCELLED rose).

Lift this into a shared `frontend/src/components/ui/StatusChip.tsx` taking `{ status, type: 'quote'|'so'|'si'|'dn'|'sr' }`. Always render — never hide on DRAFT.

### 5. Use the shared form selectors

Required imports for header fields:

```ts
import { PartySelector } from '@/components/shared/selectors';
import { ItemSelector } from '@/components/shared/selectors';
import { WarehouseSelector } from '@/components/shared/selectors';
import { DatePicker } from '@/components/shared/selectors';
import { AccountSelector } from '@/components/shared/selectors'; // when account selection needed
import { CurrencySelector } from '@/modules/accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '@/modules/accounting/components/shared/CurrencyExchangeWidget';
```

Quote Detail today uses primitive `<select>` for items and `<input maxLength={3}>` for currency — replace.

### 6. Default currency from company, not 'USD'

Pattern: every `createEmptyForm()` currently hardcodes `'USD'`. Change to `company?.baseCurrency || 'USD'` using `useCompanyAccess()`.

### 7. Have a WhatsApp + Telegram send pair

Pattern source: **SI Detail** modals at lines 2450 and 2532. Extract to shared components:

- `frontend/src/components/messaging/SendWhatsAppModal.tsx` taking `{ document: { id, number, customerId, customerName, currency, total, date }, onSend }`
- `frontend/src/components/messaging/SendTelegramModal.tsx` (same shape)

The send action handlers call per-module APIs. **Correction (2026-06-01):** only Sales
Invoice has backend send endpoints (`send-whatsapp` / `send-telegram`). The
`sendQuoteWhatsApp` etc. endpoints do **not** exist yet. Quote/SO/DN/SR messaging is
tracked in [planning/tasks/152-sales-doc-messaging-attachments-backend.md](../../planning/tasks/152-sales-doc-messaging-attachments-backend.md).

Quote, SO, DN, SR all need these (backend + frontend wiring).

### 8. Have an Attachments section

Pattern source: **SI Detail** section at line 2100. Extract to shared:

- `frontend/src/components/attachments/AttachmentsCard.tsx` taking `{ entityType, entityId, onChange, maxSizeMb, maxCount, allowedTypes }`

All 5 pages need this. Quote needs spec PDFs / terms; SO needs customer POs; DN needs proof-of-delivery; SR needs RMA / damage photos.

### 9. Have an audit History button + modal

Pattern source: **SI/SO/DN/SR Detail** use `RecordAuditModal` already. **Quote does not.** Add it. Wire entity type per document.

### 10. RBAC-gate the credit override

Pattern source: **SO Detail** `canOverrideCredit` (line 133-134):

```ts
const canOverrideCredit =
  salesSettings?.allowCreditOverride !== false &&
  (isOwner || hasPermission('sales.creditOverride'));
```

Different error messages for "policy disabled" vs "lacks permission" (SO lines 638-642).

**SI Detail currently has NO RBAC check** — anyone with form access can override the credit limit. This is a security finding (F34). Backport the SO pattern.

### 11. i18n everywhere

Zero hardcoded English. ~400 strings total across the 5 detail pages. Use the **send-via-WhatsApp/Telegram modals** in SI Detail as the i18n pattern reference — every string passes through `t('key', 'English fallback')`.

Validation messages, table headers, status labels, button labels, modal copy, banners, empty states — all i18n.

### 12. Rationalize the action button palette

Today: 6–9 different button colors per page (slate-900, blue-600, green-600, red, indigo, emerald, teal, sky, violet, gray, amber). Pick a 4-color semantic palette and apply consistently:

| Semantic | Tailwind | Used for |
|---------|----------|----------|
| Primary | `bg-primary-600` | Save, Post, Confirm — the "do-the-thing" action |
| Neutral | `border-slate-300` | Back, History, GL Impact — non-mutating |
| Caution | `border-amber-300` | Create Return, Override — proceed but think |
| Danger | `border-rose-300` / `bg-rose-600` | Cancel, Discard, Reject |

### 13. Use shared loading / not-found states

Replace bare `<h1>` + `<Card>Loading…</Card>` patterns with a shared skeleton. Replace "Document not found" plain text with `<EmptyState>`.

### 14. Reset modal state on `params.id` change

SI Detail's settlement modal state (`settlementMode`, `settlementRows`, `arAccountId`) persists across navigation between invoices. Reset on `[params.id]` effect.

### 15. Surface silent failures

SI Detail's auto-pricing lookup (line 651) catches and ignores errors. User sees no indication if the customer-specific price didn't apply, so may save invoices at wrong prices. Show a transient warning toast on any silent failure.

## Per-page status against the contract

| # | Capability | Quote | SO | SI | DN | SR |
|---|-----------|:---:|:--:|:--:|:--:|:--:|
| 1 | `isReadOnly` mode flag | ✅ | ✅ | 🔴 | 🔴 | 🔴 |
| 2 | Edit wired | ✅ | ✅ | 🔴 | 🔴 | 🔴 |
| 3 | Cancel / Discard | 🔴 | ✅ | 🔴 | 🔴 | 🔴 |
| 4 | Shared status chip | bespoke | ✅ | monochrome | n/a | n/a |
| 5 | Shared selectors | 🔴 primitive | ✅ | ✅ | ✅ | ✅ |
| 6 | Currency from company | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 7 | WhatsApp + Telegram | 🔴 | 🔴 | ✅ | 🔴 | 🔴 |
| 8 | Attachments | 🔴 | 🔴 | ✅ | 🔴 | 🔴 |
| 9 | Audit History | 🔴 | ✅ | ✅ | ✅ | ✅ |
| 10 | RBAC credit override | n/a | ✅ | 🔴 sec | n/a | n/a |
| 11 | i18n complete | 🔴 0% | 🔴 partial | 🔴 ~10% | 🔴 0% | 🔴 0% |
| 12 | 4-color palette | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 13 | Skeleton + EmptyState | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 14 | Modal state reset | n/a | n/a | 🔴 | n/a | n/a |
| 15 | Surfaced silent fails | n/a | n/a | 🔴 | n/a | n/a |

## Implementation progress (2026-06-01)

- **Quotation** — frontend contract applied (commit `5d8d3f17`): shared StatusChip,
  shared Item/Currency/Exchange selectors, currency-from-company, Discard, 4-color
  palette, full i18n. Remaining: messaging, attachments, audit (all backend-gated → task 152).
- **Delivery Note** — Edit verb wired (commit `06256cda`) by reusing the create form
  via an `isEditing` flag; StatusChip + Post moved to the primary palette. Remaining:
  Cancel (no backend), messaging/attachments (task 152), full-page i18n sweep.
- **Sales Return** — header-only Edit wired (commit `06256cda`): date / warehouse /
  settlement / reason / restocking / notes via `updateReturn` (lines intentionally
  untouched — the backend skips lines when omitted); StatusChip + palette. Remaining:
  messaging/attachments (task 152), full-page i18n sweep.
- **Sales Invoice** — native-detail rewrite landed earlier (commit `ac5da18e`); a further
  communications-module refactor is in flight (uncommitted).
- **SO** — already has Edit / Cancel / Audit / RBAC credit-override; remaining: shared
  StatusChip swap, messaging/attachments (task 152). **Security (F34):** backport SO's
  RBAC credit-override gate to Sales Invoice Detail.

## Suggested implementation order

1. **Extract shared components first** (1–1.5 days):
   - `StatusChip.tsx`
   - `SendWhatsAppModal.tsx`, `SendTelegramModal.tsx`
   - `AttachmentsCard.tsx`
   - `useEditableForm` hook returning `{ isReadOnly, save, cancel, discard }`

2. **SI Detail rewrite** (1.5 days) — central document, exercises every capability. Locks the pattern.

3. **DN + SR Detail** (1 day, parallelizable) — similar shape to SI, smaller pages.

4. **Quote Detail** (1 day) — already has Edit; needs messaging, attachments, audit, shared selectors, i18n.

5. **SO Detail** (1 day) — already has most; needs messaging, attachments, palette, i18n.

6. **Cross-cutting i18n** (0.5 day) — sweep remaining strings, populate ar/tr.

**Total**: ~6 days, parallelizable to ~4 days calendar with two engineers.

## Definition of done

A native detail page is contract-compliant when:

- [ ] Every checkbox in the per-page table above is ✅ for that page.
- [ ] Manual QA script (per [tasks/148-native-sales-retest.md](../../planning/tasks/148-native-sales-retest.md) Batch 7) passes in both classic and Windows UI modes.
- [ ] User-guide page exists at `docs/user-guide/sales/<doc>.md`.
- [ ] Architecture doc updated at `docs/architecture/sales-<doc>-detail.md` (if existing) or this contract referenced.
