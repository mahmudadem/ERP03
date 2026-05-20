# Architecture: Sales Module

**Last updated:** 2026-05-20
**Status:** Core workflows stable. Phase A added price lists, customer groups, salespersons, and commission ledger. Phase B added quotations, credit control, promotions engine, delivery scheduling, and commission auto-accrual wiring. See dedicated docs linked below.
**Module-level docs:** [`docs/modules/sales/`](../modules/sales/)

---

## Prerequisites

The Accounting **Engine** must be initialized before Sales is usable. `InitializeSalesUseCase` calls `EnsureAccountingEngineInitialized` as its first step, which auto-bootstraps the Engine (`standard` COA template, calendar fiscal year, company base currency) if it is not yet initialized. If the Engine cannot be bootstrapped (e.g., the company has no base currency), Sales initialization throws `AccountingEngineUnavailableError`. The Accounting **UI** does not need to be visible — see [accounting.md](./accounting.md#accounting-engine-vs-accounting-appui).

`PostSalesInvoiceUseCase` enforces the same guard at post time: if the Engine is not ready and `createAccountingEffect=true`, it throws rather than marking the invoice POSTED without a voucher.

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

## Workflow Modes and Product Modes

ERP03 treats these as separate concepts:

- **Sales Standalone**: Sales is the visible app. Accounting and Inventory may still run as hidden engines.
- **SIMPLE** workflow: direct invoicing is the primary path.
- **OPERATIONAL** workflow: Sales Order -> Delivery Note -> Sales Invoice.

Configured in `Sales -> Settings`. Trades off rigor vs simplicity.

### Governance precedence

Sales workflow behavior should be read in this order:

1. **Company workflow mode** - default rule for the whole company
2. **Company governance override** - company-wide persona exception
3. **Form governance override** - specific document/form exception when allowed

The backend resolver also supports branch-scoped rules, but Sales invoice creation does not yet carry a reliable branch context. Until the invoice contract includes branch context, branch-scope rules must not be exposed as active Sales invoice governance.

This is important because mixed businesses can have both strict operational flows and approved direct-invoice forms, for example POS-facing forms.

### Default company rule

- If company workflow mode is **SIMPLE**, direct invoicing is the default behavior and operational documents may still be used.
- If company workflow mode is **OPERATIONAL**, direct invoicing is blocked by default. In that case, stock sales must follow `Sales Order -> Delivery Note -> Linked Sales Invoice`.

This makes the workflow mode meaningful at company level.

### Allowed exception model

Global OPERATIONAL is not meant to be bypassed casually.
Direct behavior may only reappear through an explicit governance exception, for example:

- a POS-facing form
- another explicitly approved form scenario

So the correct rule is:

> **Company OPERATIONAL blocks direct invoicing by default.**
> **Company/form governance may explicitly re-enable direct invoicing for approved runtime contexts.**

| Aspect | SIMPLE | OPERATIONAL (a.k.a. CONTROLLED) |
|---|---|---|
| Sales Order required (stock items) | No | Yes |
| Standalone Sales Invoice allowed | Yes | No by default; only possible through explicit company/form governance override |
| Delivery Note | Optional | Mandatory for stock items |
| COGS recognized at | Sales Invoice posting | Delivery Note posting |
| Invoice quantity ceiling (stock) | `orderedQty × (1 + tolerance)` if SO-linked | `deliveredQty` |

Most small businesses pick SIMPLE. Larger or warehouse-driven businesses pick OPERATIONAL. Switching modes is restricted once documents exist.

### Canonical Workflow Matrix

| Context | Visible user flow | Hidden engine behavior | Hard limits |
|---|---|---|---|
| Sales Standalone + SIMPLE | Direct Invoice -> Payment | Hidden Accounting posts revenue/AR/receipt; hidden Inventory can move stock on invoice post | One visible base currency, one default warehouse if stock is used, no accounting reports UI |
| Sales Standalone + OPERATIONAL | Sales Order -> Delivery Note -> Sales Invoice -> Payment | Hidden Inventory moves stock on DN; hidden Accounting posts COGS on DN and AR/revenue on SI | Warehouse chosen on DN, not linked SI |
| Sales + visible Accounting | Same flows, but accounting setup/reports are visible | Same engine, visible traceability | Advanced accounting and multi-currency available through Accounting |

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
Dr  Accounts Receivable       (final invoice total)
Dr  Sales Discount / Expense  (when line discounts exist)
    Cr  Revenue                (gross line revenue before discount)
    Cr  Charge Revenue         (document charges / additions)
    Cr  Tax Payable             (from TaxCode on discounted lines and charges)
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

### Commercial Terms Posting

Direct Sales Invoices now support canonical commercial terms:

- **Line discount**: `discountType` (`PERCENT` or `AMOUNT`) plus `discountValue`
- **Document charges**: additive commercial rows such as delivery fee, service fee, or packaging
- **Payment method mapping**: Sales-facing payment methods resolve hidden settlement accounts through Sales settings

Posting behavior:

- tax is calculated on the **discounted line base**
- gross item revenue stays visible as revenue
- line discounts post as a separate debit to the configured Sales expense/discount account
- charge rows post as separate revenue/tax buckets
- pay-now settlements can resolve `settlementAccountId` internally from Sales settings when the UI only sends `paymentMethod`

If an invoice contains a discount, `SalesSettings.defaultSalesExpenseAccountId` is required. This prevents discounts from disappearing into a net revenue number with no expense/contra-revenue trace.

Voucher metadata always includes `sourceModule='sales'`, `sourceType=<doctype>`, `sourceId=<docId>` so the ledger can be traced back to the originating document.

## Inventory Integration

Sales calls the inventory contract `ISalesInventoryService`:
- `processOUT()` for deliveries and direct-invoice (SIMPLE mode) — creates `SALES_DELIVERY` movement; inventory returns the unit cost (weighted average) used for COGS.
- `processIN()` for returns — creates `RETURN_IN` movement.

The cost returned by inventory is **frozen on the document**. Subsequent inventory cost changes do not retroactively affect already-posted COGS.

### Cost enforcement by accounting mode

- **PERPETUAL**: DN/SI/SR posting requires positive tracked-item cost for stock issue quantities.
- **INVOICE_DRIVEN** (`PERIODIC` inventory accounting method): zero-cost stock issues are allowed and recorded as unsettled cost when no positive cost basis exists yet.

This keeps operational flow unblocked in invoice-driven businesses while preserving strict real-time cost control in perpetual mode.

Delivery Note COGS vouchers are created only when Accounting is initialized and Inventory accounting mode is `PERPETUAL`. The COGS/inventory account fallback order is item account -> item category default -> Inventory financial settings default -> legacy Sales settings default. Invoice-driven Delivery Notes still move stock, but they must not require COGS account mappings because inventory cost is recognized later by the invoice/accounting flow.

## Settlement Modes

Configured per posting call. Three modes:

| Mode | Use |
|---|---|
| `DEFERRED` | Post the invoice, record payment later via a separate API. The standard A/R flow. |
| `CASH_FULL` | Post the invoice and a paired receipt voucher in one call (full payment received at point of sale). |
| `MULTI` | Post the invoice with multiple settlement rows (partial / staged payments). |

Payment status (`UNPAID` → `PARTIALLY_PAID` → `PAID`) is auto-computed from `paidAmount` vs `grandTotal`.

### Sales Payment Abstraction

Standalone Sales should not expose raw accounting IDs as the primary UX. The current contract supports:

- `CASH`
- `BANK_TRANSFER`
- `CHECK`
- `CREDIT_CARD`
- `OTHER`

These are configured in `SalesSettings.paymentMethodConfigs`, where each method maps to a hidden settlement account. Raw AR / settlement account IDs remain as optional overrides for advanced or visible-accounting cases.

All settlement receipt vouchers still pass through the Accounting voucher validation gate before ledger write, both for invoice Save & Post settlements and later Record Payment actions. The backend blocks HEADER, inactive, missing, replaced, parent-with-children, or otherwise non-posting accounts even if a UI or API request sends one.

### QA root cause: header account accepted in receipt voucher

The Accounting validation service already knew how to reject HEADER accounts. The failure was in the Sales payment integration path:

1. Sales built a `VoucherEntity` for the receipt.
2. Sales immediately called `postedVoucher = approvedVoucher.post(...)`.
3. Sales then called `ledgerRepo.recordForVoucher(postedVoucher)` and `voucherRepo.save(postedVoucher)` directly.
4. That bypassed `SubledgerVoucherPostingService` / `VoucherValidationService.validateAccounts()`, so the ledger write never checked whether each account was POSTING.

The immediate fix is to run `VoucherValidationService.validateCore()` and `validateAccounts()` in both Sales receipt paths before any ledger/voucher/payment-history write happens.

The defense-in-depth fix is lower level: `ILedgerRepository.recordForVoucher()` now invokes the same `VoucherValidationService.validateCore()` and `validateAccounts()` methods before writing ledger entries. Both Firestore and SQL implementations block:

- missing accounts
- HEADER accounts
- inactive accounts
- replaced accounts
- parent accounts with children

This means a future module can no longer reach the ledger with an invalid voucher or non-posting account just by forgetting to call the higher-level posting service. The final persistence boundary still goes through the Accounting engine rules.

## Validation Rules (key)

- Tax codes are snapshotted onto invoice lines at posting (the historical tax rate is preserved even if the master tax code changes later).
- Over-delivery tolerance configurable per company.
- Quantity ceilings enforced at SI posting based on workflow mode (see table above).
- Linked stock invoice lines must carry `dnLineId`.
- Linked stock invoice warehouse comes from the posted Delivery Note; direct stock invoice warehouse comes from the invoice line itself.
- Returns can only reference posted SIs / DNs.
- Customer's outstanding amount is recomputed on every settle/return.

## Linked Invoice Source Contract

Operational linked invoicing now uses an explicit read contract instead of trying to derive invoiceable stock quantities in the page from Sales Order lines alone.

### Backend contract

Endpoint:

`GET /tenant/sales/orders/:id/invoiceable-linked-source`

Returns:

- stock lines from **posted Delivery Notes**
- service lines from remaining **Sales Order** quantities
- delivered-not-yet-invoiced stock quantity per `dnLineId`

### Why this exists

The frontend cannot safely compute stock invoiceability from the Sales Order snapshot because:

- Delivery Notes are the source of stock fulfillment in OPERATIONAL mode
- partial deliveries can exist across multiple DN documents
- already-invoiced quantity must be tracked per `dnLineId`, not only per Sales Order line

### Current frontend behavior

`SalesInvoiceDetailPage.tsx` now loads:

- stock linked lines from the invoiceable-source endpoint
- service linked lines from the same response
- DN-derived warehouse as read-only/automatic for linked stock lines

This keeps the business rule intact: **deliver first, then invoice what was actually delivered**.

`DeliveryNoteDetailPage.tsx` supports partial deliveries by loading open Sales Order stock lines into an editable Delivery Note line grid. The item/UOM come from the Sales Order, while `deliveredQty` remains editable and is capped by the open SO quantity before the draft DN is created.

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
| `GetInvoiceableLinkedSalesSourceUseCase` | Read contract for linked invoice creation from posted Delivery Notes + remaining SO service lines |
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

## Sales master data (Phase A)

Phase A added structured pricing, customer segmentation, and salesperson commissions. These complement the core invoice flow without changing it.

**Price lists** (`/tenant/sales/price-lists`) — per-currency price catalogs with optional date-validity windows and tiered (quantity-break) pricing. One list per currency can be flagged as the default fallback. A customer's `Party.defaultPriceListId` overrides the currency default. The sales invoice line editor auto-fetches the effective price when the item or quantity changes. For the full model see [`docs/architecture/pricing.md`](./pricing.md).

**Customer groups** (`/tenant/sales/customer-groups`) — segmentation buckets that carry default commercial terms (price list, payment days, credit limit, tax exemption). Assigning a customer to a group stores the `customerGroupId` on their `Party` record; the group defaults serve as pre-fill values. The `Party` entity also gained `creditLimit`, `creditHoldPolicy`, `defaultPriceListId`, and `taxExempt` fields directly. Credit-hold enforcement is **Phase B** — Phase A only stores the master data. See [`docs/architecture/pricing.md`](./pricing.md) for the full customer-group and Party-field details.

**Salespersons and commissions** (`/tenant/sales/salespersons`, `/tenant/sales/commissions`) — a `Salesperson` master record (code, name, email, `defaultCommissionPct`) can be attached to Sales Orders and Sales Invoices. When a sales invoice posts, a `CommissionEntry` ledger record is accrued: the commission rate is frozen as a snapshot so future rate changes do not affect past entries. Entries transition through `ACCRUED → PAID / CANCELLED`. GL integration for the payment step is a follow-up. See [`docs/architecture/commissions.md`](./commissions.md) for the full model and the controller-invoked accrual architecture decision.

---

## Sales operational features (Phase B)

Phase B added pre-sale quoting, credit-limit enforcement at order confirm, a promotions evaluation engine, delivery scheduling with an aged-backlog report, and commission auto-accrual wiring.

**Quotations** — A `Quote` entity with a six-status lifecycle (`DRAFT → SENT → ACCEPTED → REJECTED / EXPIRED / CONVERTED`), a revisioning model (version + `originQuoteId` chain), and two conversion paths: accepted quote → Sales Order and accepted quote → direct Sales Invoice. API: `/tenant/sales/quotes` + action sub-routes. See [`docs/architecture/quotations.md`](./quotations.md).

**Credit control** — `ConfirmSalesOrderUseCase` now runs a credit check before confirming a DRAFT order. Exposure = Σ outstanding balances on POSTED invoices. Policy `NONE` / `WARN` / `BLOCK` (set per customer on the Party record). BLOCK throws `CreditLimitExceededError`; the caller can re-submit with an override reason which is persisted as an immutable `CreditOverride` audit record. See [`docs/architecture/credit-control.md`](./credit-control.md).

**Promotions** — `PromotionRule` entity supports `BUY_X_GET_Y` (free-goods) and `THRESHOLD_DISCOUNT` rule types with scope `ALL / ITEMS / CATEGORIES`, date-validity windows, and priority ordering. `PromotionApplicationService` is a pure evaluator (no I/O); `POST /tenant/sales/promotions/evaluate` exposes it. **Not yet auto-invoked during SO/SI creation** — see promotions follow-ups. See [`docs/architecture/promotions.md`](./promotions.md).

**Delivery scheduling** — `promisedDate` added to `SalesOrder` and `DeliveryNote`. `GetAgedBacklogUseCase` lists CONFIRMED / PARTIALLY_DELIVERED orders past their `promisedDate`, sorted by `daysOverdue` descending. API: `GET /tenant/sales/aged-backlog`. Frontend: `AgedBacklogPage`.

**Commission auto-accrual** — `SalesController` now calls `AccrueCommissionForInvoiceUseCase` after every successful SI post (postSI / createAndPostSI / updateAndPostSI). Failure is non-fatal: a commission accrual error is logged but does not roll back the post. See [`docs/architecture/commissions.md`](./commissions.md).

---

## Sales finance & reporting (Phase C)

Phase C added a suite of read-only finance and analytics reports served from posted Sales Invoice and PaymentHistory data. No new transactional workflows were added — only reporting use cases and API endpoints.

| Report | Route | Purpose |
|---|---|---|
| AR Aging | `GET /tenant/sales/reports/ar-aging` | Outstanding balances bucketed by age (Current / 1–30 / 31–60 / 61–90 / 90+) |
| Customer Ledger | `GET /tenant/sales/reports/customer-ledger` | Chronological invoice + payment events with running balance |
| Customer Statement | `GET /tenant/sales/reports/customer-statement` | Period statement: opening balance, transactions, closing balance, open invoices |
| Sales by Customer | `GET /tenant/sales/reports/sales-by-customer` | Revenue, tax, and invoice count aggregated per customer |
| Sales by Item | `GET /tenant/sales/reports/sales-by-item` | Quantity and revenue aggregated per inventory item |
| Sales by Salesperson | `GET /tenant/sales/reports/sales-by-salesperson` | Revenue per salesperson (invoices with no salesperson assigned appear under "Unassigned") |

Frontend pages: `ArAgingReportPage`, `CustomerStatementPage` (Statement + Ledger tab toggle), `SalesAnalyticsPage` (three tabs).

For the full technical specification — bucket algorithm, event model, opening/closing balance derivation, N+1 note, and related P&L and Inventory Valuation reports — see [`docs/architecture/sales-reporting.md`](./sales-reporting.md).

---

## What Is NOT Implemented

| Feature | Status |
|---|---|
| **Credit check at direct SI creation** | Credit control fires at SO confirm only. Direct invoices (no SO) are not yet credit-checked. |
| **Promotions auto-apply** | Evaluator endpoint exists; it is not yet called automatically inside SO/SI creation. |
| **Quote number sequencing** | Quote numbers use a timestamp-random fallback; SalesSettings has no sequence field yet. |
| **Customer Master (dedicated)** | Currently uses Party. A dedicated customer entity is planned but the Party-based flow is sufficient for V1. |
| **Sales Reports (detailed)** | Implemented in Phase C — see the Sales finance & reporting section above and [`docs/architecture/sales-reporting.md`](./sales-reporting.md). |
| **Commission GL posting** | Marking commission paid is a status change only — no Dr/Cr voucher posted yet. |
