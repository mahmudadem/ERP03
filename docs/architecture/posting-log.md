# PostingLog — Cross-Module Posting Audit Trail

**Last updated:** 2026-05-19
**Status:** Entity + repository + Sales Invoice writer in place (PR2). Wiring for Purchase Invoice / Delivery Note follow-up; PR3 will extend to all posting paths and convert silent-skip resolutions to typed errors using these decision codes.

---

## Purpose

Every time a Sales / Purchases / Inventory document is posted, several things happen at once:
- One or more vouchers are created
- Ledger entries are written
- Stock movements may be created
- Settlement / payment vouchers may also be posted

Without a log, an admin asking "why didn't COGS post on invoice SI-00123?" has no programmatic answer. The audit found this to be the single biggest auditability gap. **PostingLog is the answer.**

Each posted document produces one `PostingLog` row that captures:
- Which vouchers were generated (IDs)
- Which posting strategy ran
- Per line: which accounts were resolved, from which configuration level
- Per line: whether COGS was posted or skipped (with the skip reason from a fixed taxonomy)
- Warnings (e.g., unsettled cost basis)
- The originator (user + timestamp)

## Storage

`companies/{companyId}/posting_logs/{id}` (Firestore-only). The record is written **inside the same transaction** as the voucher and ledger writes, so it is atomic with the posting. If the transaction rolls back, no PostingLog is left behind.

When the repository is not wired into a use case (legacy callers), the posting continues unaffected and no log is written. This makes PR2 a strictly-additive change — no existing test was broken.

## Schema

See [PostingLog.ts](../../backend/src/domain/accounting/entities/PostingLog.ts). Key fields:

| Field | Purpose |
|---|---|
| `id` | UUID for the log record |
| `companyId` | Tenant scope |
| `sourceModule` | `'sales' \| 'purchases' \| 'inventory' \| 'accounting'` |
| `sourceType` | E.g. `SALES_INVOICE`, `DELIVERY_NOTE`, `GOODS_RECEIPT` |
| `sourceId` | The originating document ID |
| `sourceDocNumber` | Human-readable doc number (e.g. `SI-00001`) |
| `strategy` | Posting strategy name (e.g. `SalesInvoiceStrategy`) |
| `voucherIds[]` | Every voucher this posting produced |
| `decisions[]` | Per-line resolution records |
| `warnings[]` | Free-form posting-time warnings |
| `idempotencyKey?` | If the request carried an `Idempotency-Key` header |
| `postedAt`, `postedBy` | Audit timestamps |

### Per-line decision

```ts
{
  lineNo: 1,
  itemId: 'item-123',
  accounts: {
    revenue: { resolvedId: 'acc-rev', fallbackLevel: 'item' },
    tax:     { resolvedId: 'acc-tax', fallbackLevel: 'taxCode' },
    cogs:    { resolvedId: 'acc-cogs', fallbackLevel: 'category' },
    inventory: { resolvedId: 'acc-inv', fallbackLevel: 'inventorySettings' },
  },
  cogsPostingStatus: 'POSTED'
}
```

The `fallbackLevel` answers the admin question "which configuration provided this account?" — `item` (item master), `category` (item category default), `inventorySettings` / `salesSettings` / `purchaseSettings` (module defaults), `customer` / `vendor` (party defaults), `taxCode` (tax-code-specific), `companyDefault` (company-level fallback).

## COGS posting status taxonomy

These are the only valid values for `cogsPostingStatus` on a Sales Invoice / Delivery Note / Purchase Invoice line:

| Value | Meaning | Posting behaviour |
|---|---|---|
| `POSTED` | COGS voucher generated normally | Dr COGS, Cr Inventory |
| `SKIPPED_POSTED_AT_DN` | OPERATIONAL + PERPETUAL: COGS already posted at DN | No-op at invoice |
| `SKIPPED_SERVICE_ITEM` | Item does not track inventory | No COGS to post |
| `SKIPPED_DEFERRED_POLICY` | INVOICE_DRIVEN (periodic) — recognised at period close | No-op at invoice |
| `SKIPPED_UNSETTLED_COST` | Cost basis missing or unmapped account at posting time | No COGS to post; warning logged. PR3 will convert the "missing account" sub-case to a hard `AccountMappingError` while preserving the "missing cost data" path under an `allowDeferredCost` setting. |

The same taxonomy applies on Delivery Note lines (with a smaller subset since DN posting is purely PERPETUAL-mode COGS) and on Purchase Invoice lines (with `SKIPPED_POSTED_AT_GRN` for the operational+perpetual+GRN-linked case).

`null` / undefined means "not yet decided" — typically a DRAFT line that has never been posted.

## API

Two read endpoints under `/tenant/accounting/posting-logs`:

- `GET /tenant/accounting/posting-logs?sourceId=<id>` → all logs for the given source document (typical use: GL Impact preview on an invoice page)
- `GET /tenant/accounting/posting-logs/:id` → a specific log record

Both require the `accounting.vouchers.view` permission.

## Where it is wired today

| Use case | PostingLog write | Status |
|---|---|---|
| `PostSalesInvoiceUseCase` | ✅ Written after voucher posting, inside the transaction | PR2 |
| `PostPurchaseInvoiceUseCase` | ✅ Document vouchers (Expense/Inventory/Tax/AP) route through `IAccountingBridge`-only via `SubledgerDocumentPoster(undefined, bridge)`; settlement payments route through `recordPreBuiltVoucher` with the existing full-mode gateway closure | 267-F |
| `PostSalesInvoiceUseCase` | ✅ Document vouchers (revenue + COGS) route through `IAccountingBridge`-only via `SubledgerDocumentPoster(undefined, bridge)` (Task 267-F SI slice); record-payment receipts route through `recordPreBuiltVoucher` without a direct gateway fallback (Task 267-F Sales PaymentSync slice) | 267-F |
| `PostDeliveryNoteUseCase` | ✅ Routes through `IAccountingBridge` (bridge-only, Task 267-F); PostingLog write in minimal mode via the bridge | 267-F |
| `PostSalesReturnUseCase` | ✅ Document vouchers (revenue reversal + COGS reversal) route through `IAccountingBridge`-only via `SubledgerDocumentPoster(undefined, bridge)` (Task 267-F SR slice); refund settlement still posts through the same poster/bridge | 267-F |
| `PostPurchaseReturnUseCase` | ⏳ Pending | follow-up |
| `PostGoodsReceiptUseCase` | ✅ Goods Receipt Inventory/GRNI voucher routes through `IAccountingBridge`-only via `postFinancialEvent({ bridge })` (Task 267-F GRN slice) | 267-F |
| Sales record-payment voucher writes | ✅ Full mode returns receipt voucher ids; minimal mode records no GL voucher id and leaves payment history voucherId null | 267-F |

Wiring the remaining use cases is mechanical (copy-paste of the SI pattern, adjust strategy name + skip-reason taxonomy). The entity and repository support all cases without further change. Tracked as a P1 cleanup.

## Frontend integration

The forthcoming GL Impact drawer (P1) will fetch `/tenant/accounting/posting-logs?sourceId=<docId>` on document detail pages and render:
- A list of generated vouchers with click-through to the voucher detail
- A per-line breakdown showing which accounts were used and where they came from (item / category / settings)
- Skip reasons surfaced as warning chips (e.g. "COGS skipped — already posted at Delivery Note DN-00045")
- Any non-empty `warnings[]` shown above the breakdown

This is the single highest-ROI UX feature for accountant trust.

## Reading the data

Direct Firestore query (admin only):

```ts
const snap = await db
  .collection(`companies/${companyId}/posting_logs`)
  .where('sourceId', '==', 'si-abc-123')
  .get();
```

Backend repository:

```ts
const logs = await postingLogRepo.findBySourceId(companyId, sourceId);
```

## Tests

[`backend/src/tests/domain/accounting/PostingLog.test.ts`](../../backend/src/tests/domain/accounting/PostingLog.test.ts) — 8 entity unit tests covering construction, validation, defensive copy, JSON serialization, and all skip-status values.

Integration assertions on `PostSalesInvoiceUseCase` writing a PostingLog will be added when the existing posting tests are next refactored.
