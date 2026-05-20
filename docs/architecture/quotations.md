# Architecture: Quotations

**Last updated:** 2026-05-20
**Status:** Phase B complete. Quote entity, full status lifecycle, revisioning model, two conversion paths, and CRUD + action API are all live.

---

## Why this exists

A quotation is a pre-sale offer presented to a customer before a committed order is placed. Tracking quotes separately from orders allows the business to measure win/loss rates, manage revision history, and enforce a clear handoff point (customer acceptance) before inventory or accounting is touched.

---

## Quote entity

**File:** `backend/src/domain/sales/entities/Quote.ts`

### Header fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Auto-generated |
| `companyId` | string | Tenant scoping |
| `quoteNumber` | string | Required. See numbering note below |
| `customerId` | string | Required |
| `customerName` | string | Snapshotted at creation |
| `salespersonId` | string (optional) | |
| `status` | `QuoteStatus` | See lifecycle below |
| `version` | integer >= 1 | 1 for new quotes; incremented by `ReviseQuoteUseCase` |
| `originQuoteId` | string (optional) | Points to the first quote in a revision chain |
| `quoteDate` | string (YYYY-MM-DD) | |
| `validUntil` | string (YYYY-MM-DD, optional) | If set and before today, `isExpired()` returns true |
| `currency` | string | ISO 4217 |
| `exchangeRate` | number > 0 | |
| `lines` | `QuoteLine[]` | At least one required |
| `convertedToType` | `'SALES_ORDER'` \| `'SALES_INVOICE'` (optional) | Set on conversion |
| `convertedToId` | string (optional) | ID of the created SO or SI |

### QuoteLine fields

Each line mirrors a sales invoice line. Key fields:

| Field | Notes |
|---|---|
| `quotedQty` | Quantity being quoted |
| `unitPriceDoc` | Price in document currency |
| `discountType` / `discountValue` | Optional line discount |
| `taxRate` | Snapshotted from tax code |
| `lineTotalDoc` / `lineTotalBase` | Net of discount, before tax |
| `taxAmountDoc` / `taxAmountBase` | |
| `grossLineTotalDoc` | Pre-discount line amount |

Line amounts are calculated using the same `SalesInvoiceCalculationService` that invoice lines use, so conversions produce consistent arithmetic.

---

## Status lifecycle

```
                  ┌────────────┐
        create    │            │  markExpired()
       ──────────►│   DRAFT    │──────────────────────────────► EXPIRED
                  │            │
                  └─────┬──────┘
                        │ markSent()
                        ▼
                  ┌────────────┐
                  │    SENT    │──── markAccepted() ─────────► ACCEPTED
                  │            │                                    │
                  └─────┬──────┘                                    │
                        │ markRejected()                             │ markConverted()
                        ▼                                            ▼
                  ┌────────────┐                              ┌────────────┐
                  │  REJECTED  │                              │ CONVERTED  │
                  └────────────┘                              └────────────┘
                        ▲
                        │ ReviseQuoteUseCase
                        │  (force-rejects the old SENT quote
                        │   and creates a new DRAFT at version+1)
```

### Transition rules enforced by the entity

| Method | Allowed from | Result |
|---|---|---|
| `markSent()` | `DRAFT` only | `SENT` |
| `markAccepted()` | `SENT` only | `ACCEPTED` |
| `markRejected()` | `SENT` only | `REJECTED` |
| `markExpired()` | `DRAFT` or `SENT` | `EXPIRED` |
| `markConverted(type, id)` | `ACCEPTED` only | `CONVERTED` |

Calling a transition method from a disallowed status throws immediately.

### Expiry check

```ts
isExpired(today: string): boolean
```

Returns `true` only when:
1. `validUntil` is set, and
2. `validUntil < today` (strictly before), and
3. `status` is still `DRAFT` or `SENT` (i.e. the offer could still be open).

This is a pure read — it does not mutate the quote. The use case layer is responsible for calling `markExpired()` and persisting if needed.

---

## Revisioning model

When a customer comes back and wants changes to a sent quote, the business revises rather than overwrites. This preserves the history of what was offered.

**`ReviseQuoteUseCase`** (`backend/src/application/sales/use-cases/QuoteUseCases.ts`):

1. Loads the old quote.
2. Calls `old.markRejected()` to close it (requires the old quote to be `SENT`).
3. Creates a new `Quote` that is a deep clone of the old one with:
   - fresh `id` and `quoteNumber` (a new generated number, not a copy of the old one)
   - `version = old.version + 1`
   - `originQuoteId = old.originQuoteId ?? old.id` — all quotes in the chain point to the same root
   - `status = 'DRAFT'` — the revision starts unlocked so it can be edited before being sent
   - all line `lineId`s are replaced with new UUIDs
4. Persists both the updated old quote and the new revision.

**Revision chain example:**

```
Quote Q-1 (v1, REJECTED)  ─── originQuoteId = Q-1.id ──► (self)
Quote Q-2 (v2, SENT)      ─── originQuoteId = Q-1.id
Quote Q-3 (v3, ACCEPTED)  ─── originQuoteId = Q-1.id
```

All quotes in the chain share the same `originQuoteId`. To display the full history for a negotiation, query by `originQuoteId`.

**Important limitation:** `ReviseQuoteUseCase` calls `markRejected()` on the old quote, which requires `status === 'SENT'`. Revising a `DRAFT` or `ACCEPTED` quote is not currently supported and will throw. See Follow-ups.

---

## Conversion paths

A quote in `ACCEPTED` status can be converted to either a Sales Order or a direct Sales Invoice. Both paths delegate to the existing creation use cases and then call `markConverted()` on the quote.

### Convert to Sales Order

**`ConvertQuoteToSalesOrderUseCase`**

1. Verifies status is `ACCEPTED` — throws if not.
2. Maps `QuoteLine[]` to `CreateSalesOrderInput.lines`. The mapping is:
   - `quotedQty` → `orderedQty`
   - prices, discounts, tax codes are carried over
   - `expectedDeliveryDate` is omitted (no equivalent on Quote)
   - `warehouseId` is omitted per line (not captured on QuoteLine)
3. Calls `CreateSalesOrderUseCase.execute()`.
4. Calls `quote.markConverted('SALES_ORDER', so.id)`.
5. Returns `{ quote, salesOrderId }`.

### Convert to Sales Invoice

**`ConvertQuoteToSalesInvoiceUseCase`**

1. Verifies status is `ACCEPTED` — throws if not.
2. Maps `QuoteLine[]` to `CreateSalesInvoiceInput.lines` using persona `'direct'` (no linked SO required).
3. All line discounts are preserved in the invoice input.
4. `dueDate` is omitted — sales settings default payment terms apply.
5. `warehouseId` is omitted per line.
6. Calls `CreateSalesInvoiceUseCase.execute()`.
7. Calls `quote.markConverted('SALES_INVOICE', si.id)`.
8. Returns `{ quote, salesInvoiceId }`.

---

## Quote number generation

**Current implementation:** `Q-<timestamp>-<random4>` (e.g. `Q-1716220000000-4821`).

This is a fallback. `SalesSettings` does not yet have a `quoteNumberPrefix` or `quoteNumberNextSeq` field, so proper sequential numbering (like `Q-2026-001`) is not yet implemented. See Follow-ups.

---

## Use cases

**File:** `backend/src/application/sales/use-cases/QuoteUseCases.ts`

| Use case | Purpose |
|---|---|
| `CreateQuoteUseCase` | Creates a DRAFT quote; calculates all line and header amounts |
| `UpdateQuoteUseCase` | Updates a DRAFT quote; recalculates amounts; throws if not DRAFT |
| `GetQuoteUseCase` | Fetch by id |
| `ListQuotesUseCase` | List with optional status / customerId filter |
| `DeleteQuoteUseCase` | Hard-delete; only DRAFT quotes may be deleted |
| `SendQuoteUseCase` | DRAFT → SENT |
| `AcceptQuoteUseCase` | SENT → ACCEPTED |
| `RejectQuoteUseCase` | SENT → REJECTED |
| `ReviseQuoteUseCase` | Clones a SENT quote to version+1 DRAFT; marks old as REJECTED |
| `ConvertQuoteToSalesOrderUseCase` | ACCEPTED quote → Sales Order + marks CONVERTED |
| `ConvertQuoteToSalesInvoiceUseCase` | ACCEPTED quote → direct Sales Invoice + marks CONVERTED |

---

## API surface

All under `/tenant/sales/` (router: `backend/src/api/routes/sales.routes.ts`):

| Method | Path | Use case |
|---|---|---|
| POST | `/quotes` | CreateQuoteUseCase |
| GET | `/quotes` | ListQuotesUseCase |
| GET | `/quotes/:id` | GetQuoteUseCase |
| PUT | `/quotes/:id` | UpdateQuoteUseCase |
| DELETE | `/quotes/:id` | DeleteQuoteUseCase |
| POST | `/quotes/:id/send` | SendQuoteUseCase |
| POST | `/quotes/:id/accept` | AcceptQuoteUseCase |
| POST | `/quotes/:id/reject` | RejectQuoteUseCase |
| POST | `/quotes/:id/revise` | ReviseQuoteUseCase |
| POST | `/quotes/:id/convert-to-order` | ConvertQuoteToSalesOrderUseCase |
| POST | `/quotes/:id/convert-to-invoice` | ConvertQuoteToSalesInvoiceUseCase |

---

## Frontend

- **QuotationsPage** (`frontend/src/modules/sales/pages/`) — list view with status filter.
- **QuotationDetailPage** — header + line editor for DRAFT; action buttons rendered based on current status (Send / Accept / Reject / Revise / Convert).

---

## Follow-ups

**(a) Quote number sequencing.**
`SalesSettings` has no `quoteNumberPrefix` or `quoteNumberNextSeq` fields yet. The current generator produces a timestamp-random fallback. A proper sequence (e.g. `Q-2026-001`) should be added in a `SalesSettings` update and `CreateQuoteUseCase` / `ReviseQuoteUseCase` should consume it.

**(b) Revising non-SENT quotes.**
`ReviseQuoteUseCase` calls `markRejected()` on the old quote, which requires it to be `SENT`. Revising a `DRAFT` (e.g. a quote you haven't sent yet but want to restructure) or an `ACCEPTED` quote (partial revision after acceptance) is not supported and will throw. A future revision could add a `markSuperseded()` transition that is reachable from more statuses, or handle DRAFT-revision as an edit rather than a clone.

**(c) Delivery date and warehouse not captured on QuoteLines.**
During conversion to SO or SI, `expectedDeliveryDate` and `warehouseId` are omitted because they are not on the Quote entity. The converted document will have these fields blank and must be filled in manually before confirming / posting.

---

## See also

- [`docs/architecture/sales.md`](./sales.md) — Sales module overview
- [`docs/architecture/credit-control.md`](./credit-control.md) — Credit limit enforcement at SO confirm
- [`docs/architecture/pricing.md`](./pricing.md) — Price list auto-fill at line level
