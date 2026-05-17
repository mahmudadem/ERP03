# Architecture: Sales Module

**Last updated:** 2026-05-17
**Status:** Feature-complete for V1 (4 document types). Quotations and Price Lists deferred.
**Module-level docs:** [`docs/modules/sales/`](../modules/sales/)

---

## Purpose

The Sales module covers the order-to-cash cycle: take an order from a customer, deliver the goods, invoice them, collect payment, handle returns. It is tightly coupled to **Accounting** (every posted invoice creates a journal entry) and **Inventory** (every delivery decrements stock and recognizes cost).

## Document Model

Four document types form the chain:

```
Sales Order (SO) → Delivery Note (DN) → Sales Invoice (SI) → Receipt
                                    └→ Sales Return (SR)
```

- **Sales Order (SO)** — pre-sale agreement with the customer. Tracks `orderedQty`, `deliveredQty`, `invoicedQty`, `returnedQty` per line. Status: DRAFT → CONFIRMED → PARTIALLY_DELIVERED / FULLY_DELIVERED → CLOSED / CANCELLED.
- **Delivery Note (DN)** — physical delivery event. Creates a `SALES_DELIVERY` inventory movement and (in OPERATIONAL mode) the COGS GL entry.
- **Sales Invoice (SI)** — the financial event. Posts AR + Revenue (+ COGS in SIMPLE mode). Drives payment tracking.
- **Sales Return (SR)** — reverses a delivery and/or invoice. Two contexts: `AFTER_INVOICE` (full reversal) and `BEFORE_INVOICE` (delivery-only reversal, COGS only).

## Workflow Modes

Configured in `Sales → Settings`. Trades off rigor vs simplicity.

| Aspect | SIMPLE | OPERATIONAL (a.k.a. CONTROLLED) |
|---|---|---|
| Sales Order required (stock items) | No | Yes |
| Standalone Sales Invoice allowed | Yes | No (must reference a Delivery Note) |
| Delivery Note | Optional | Mandatory for stock items |
| COGS recognized at | Sales Invoice posting | Delivery Note posting |
| Invoice quantity ceiling (stock) | `orderedQty × (1 + tolerance)` if SO-linked | `deliveredQty` |

Most small businesses pick SIMPLE. Larger or warehouse-driven businesses pick OPERATIONAL. Switching modes is restricted once documents exist.

## Customers

Customers are not a separate Sales entity — they are **Party** records (shared module) with `role = 'CUSTOMER'`. This lets the same legal entity be both a customer and a supplier without duplication.

Customer-specific overrides on the Party:
- `defaultARAccountId` — overrides company default AR account
- `paymentTermsDays`
- `defaultCurrency`

The Customers list page at `/sales/customers` is a filtered view of the Party API.

## Accounting Integration

Every posted SI / SR / Receipt calls into Accounting's `PostVoucherUseCase` (Accounting module is the single gate). Sales does not write to the ledger directly — it constructs the voucher and submits.

**Sales Invoice posting** creates:
```
Dr  Accounts Receivable      (customer override → company default)
    Cr  Revenue               (item → category → company default)
    Cr  Tax Payable            (from TaxCode on each line)
```
Plus (in SIMPLE mode for stock items):
```
Dr  COGS
    Cr  Inventory
```

**Sales Return posting** (AFTER_INVOICE) reverses all of the above. (BEFORE_INVOICE only reverses the COGS pair.)

**Receipt posting** creates:
```
Dr  Cash / Bank
    Cr  Accounts Receivable
```

Voucher metadata always includes `sourceModule='sales'`, `sourceType=<doctype>`, `sourceId=<docId>` so the ledger can be traced back to the originating document.

## Inventory Integration

Sales calls the inventory contract `ISalesInventoryService`:
- `processOUT()` for deliveries and direct-invoice (SIMPLE mode) — creates `SALES_DELIVERY` movement; inventory returns the unit cost (weighted average) used for COGS.
- `processIN()` for returns — creates `RETURN_IN` movement.

The cost returned by inventory is **frozen on the document**. Subsequent inventory cost changes do not retroactively affect already-posted COGS.

## Settlement Modes

Configured per posting call. Three modes:

| Mode | Use |
|---|---|
| `DEFERRED` | Post the invoice, record payment later via a separate API. The standard A/R flow. |
| `CASH_FULL` | Post the invoice and a paired receipt voucher in one call (full payment received at point of sale). |
| `MULTI` | Post the invoice with multiple settlement rows (partial / staged payments). |

Payment status (`UNPAID` → `PARTIALLY_PAID` → `PAID`) is auto-computed from `paidAmount` vs `grandTotal`.

## Validation Rules (key)

- Tax codes are snapshotted onto invoice lines at posting (the historical tax rate is preserved even if the master tax code changes later).
- Over-delivery tolerance configurable per company.
- Quantity ceilings enforced at SI posting based on workflow mode (see table above).
- Returns can only reference posted SIs / DNs.
- Customer's outstanding amount is recomputed on every settle/return.

## Multi-Currency

- SO / DN / SI / SR support a document currency with a frozen exchange rate.
- GL posting always lands in base currency.
- Inventory's weighted average cost is converted at the document FX rate when COGS is computed.

## Key Use Cases

| Use case | Purpose |
|---|---|
| `CreateSalesOrderUseCase` / `ConfirmSalesOrderUseCase` / `CancelSalesOrderUseCase` / `CloseSalesOrderUseCase` | SO lifecycle |
| `CreateDeliveryNoteUseCase` / `PostDeliveryNoteUseCase` | Delivery flow — calls `processOUT()` and emits COGS GL in OPERATIONAL mode |
| `CreateSalesInvoiceUseCase` / `PostSalesInvoiceUseCase` / `CreateAndPostSalesInvoiceUseCase` | Invoice creation and posting |
| `PostSalesInvoiceWithSettlementUseCase` | Post invoice + receipt voucher(s) in one call (CASH_FULL or MULTI) |
| `CreateSalesReturnUseCase` / `PostSalesReturnUseCase` | Return flow, context-aware GL reversals |
| `RecordSalesInvoicePaymentUseCase` | Standalone payment recording |
| `UpdateSalesInvoicePaymentStatusUseCase` | Sync payment status when receipt vouchers post |
| `InitializeSalesUseCase` / `GetSalesSettingsUseCase` / `UpdateSalesSettingsUseCase` | One-time setup and configuration |

All under `backend/src/application/sales/use-cases/`.

## File Map

| Concern | Path |
|---|---|
| Domain entities | `backend/src/domain/sales/entities/` |
| Use cases | `backend/src/application/sales/use-cases/` |
| Routes | `backend/src/api/routes/sales.routes.ts` |
| Frontend module | `frontend/src/modules/sales/` |
| Inventory contract | `backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts` |
| Module deep-dive | `docs/modules/sales/MASTER_PLAN.md`, `ALGORITHMS.md` |

## What Is NOT Implemented

| Feature | Status |
|---|---|
| **Quotations** | Planned. Pre-sale offers with expiry and conversion to SO. |
| **Price Lists** | Planned. Customer-specific pricing and volume tiers. |
| **Customer Master (dedicated)** | Currently uses Party. A dedicated customer entity is planned but the Party-based flow is sufficient for V1. |
| **Sales Reports (detailed)** | Dashboard exists. Detailed reports (AR Aging, Sales Register, Customer Statement, by-item/by-customer breakdowns) are deferred. |
| **Credit limit enforcement** | Not validated at SI posting. Could be added as a validation rule. |
| **Discount engine** | Manual line discount only. No automatic volume-break or promotional rules. |
