# Architecture: Sales Module

**Last updated:** 2026-05-22
**Status:** Core workflows stable. Phase A added price lists, customer groups, salespersons, and commission ledger. Phase B added quotations, credit control, promotions engine, delivery scheduling, and commission auto-accrual wiring. Phase C added AR aging, customer ledger/statement, and sales analytics reports. Phase D.2+D.3 added period-lock enforcement and per-record audit logging. Phase D.4 added recurring invoices (templated + scheduled). Phase D.5 added sales-return commercial settlement controls (credit note vs refund, reason taxonomy, restocking fee/net settlement). Phase D.6 added tenant-scoped invoice attachments. Phase D.7 added controlled invoice template selection with customer defaults. Phase D.8 now ships tenant-scoped outbound messaging for WhatsApp and Telegram, with email still deferred. See dedicated docs linked below.
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

## Sales auditability & control (Phase D.2 + D.3)

Phase D.2 added period-lock enforcement for sales document posting. Phase D.3 added per-record immutable audit logging for all document updates. Both share the same enforcement and audit infrastructure.

### Period Lock (D.2)

**Enforcement chokepoint:** `SubledgerVoucherPostingService.postInTransaction()` — the single entry point for all subledger posting. This means the same fix automatically covers Purchases (PI/GRN/PR) in Phase F with zero additional work.

**Two-tier model:**
- **SOFT tier** — `lockedThroughDate` in accounting policy config. Documents dated on/before this date are blocked. **Overridable** by supplying a reason; the override is recorded as an immutable `PeriodLockOverride` audit row.
- **HARD tier** — A fiscal period whose status is `CLOSED` or `LOCKED` (via the `FiscalYear` entity). **Not overridable.**

**Flow:**
1. `PeriodLockService.assertPostingAllowed()` is called at the start of `postInTransaction()`.
2. Checks fiscal period status (HARD) → throws `PeriodLockedError` with `tier: 'HARD'` if closed/locked.
3. Checks `lockedThroughDate` (SOFT) → if override reason provided, allows; otherwise throws `PeriodLockedError` with `tier: 'SOFT'`.
4. `PeriodLockedError` is mapped to HTTP 422 by the global error handler.
5. Frontend catches the 422, shows `PeriodLockOverrideModal` for SOFT tier, blocks for HARD tier.
6. On override confirm, the post is retried with `periodLockOverrideReason` in the request body.
7. After successful post, a `PeriodLockOverride` row is written (non-fatal).

**Key files:**
| Layer | File |
|-------|------|
| Domain error | `backend/src/domain/accounting/errors/PeriodLockedError.ts` |
| Application service | `backend/src/application/accounting/services/PeriodLockService.ts` |
| Audit entity | `backend/src/domain/accounting/entities/PeriodLockOverride.ts` |
| Repository | `backend/src/infrastructure/firestore/repositories/accounting/FirestorePeriodLockOverrideRepository.ts` |
| DI wiring | `diContainer.periodLockService` getter in `bindRepositories.ts` |
| Frontend modal | `frontend/src/modules/sales/components/PeriodLockOverrideModal.tsx` |

**Settings:** Period lock is configured in Accounting Settings → Accounting Periods tab (`periodLockEnabled` toggle + `lockedThroughDate` date picker). This UI pre-existed; D.2 wired the enforcement.

### Per-record Audit Log (D.3)

**Design:** Every update to a Sales Invoice, Sales Order, Delivery Note, or Sales Return creates an immutable `RecordChangeLog` row capturing which fields changed (before → after), who made the change, and when.

**Implementation:**
1. `RecordChangeService` computes a shallow field-level diff between `before` and `after` snapshots.
2. Primitives are compared directly. Arrays/objects (e.g., `lines`) are compared via `JSON.stringify`; if different, recorded as one `FieldChange` with stringified values truncated to 500 chars.
3. Zero changes → no row written.
4. The service is injected into all 4 update use cases and called after successful save (awaited, non-fatal).
5. `RecordAuditController` exposes `GET /tenant/sales/audit-log?entityType=...&entityId=...`.
6. Frontend `RecordAuditModal` renders the changes in a before/after table.

**Key files:**
| Layer | File |
|-------|------|
| Entity | `backend/src/domain/system/entities/RecordChangeLog.ts` |
| Application service | `backend/src/application/system/services/RecordChangeService.ts` |
| Repository | `backend/src/infrastructure/firestore/repositories/system/FirestoreRecordChangeLogRepository.ts` |
| API endpoint | `backend/src/api/controllers/RecordAuditController.ts` |
| Frontend modal | `frontend/src/modules/sales/components/RecordAuditModal.tsx` |

**Firestore index:** The `record_change_logs` collection requires a composite index (`entityType ASC, entityId ASC, timestamp DESC`). Defined in `firestore.indexes.json` — must be deployed before production use.

---

## Sales recurring invoices (Phase D.4)

Phase D.4 added recurring invoice support with two modes: **templated** (one-click clone from existing invoice) and **scheduled** (automatic generation on a cadence).

### Architecture

**Entity:** `RecurringInvoiceTemplate` stores the invoice template (customer, lines, prices, currency) plus scheduling parameters (frequency, day of month/week, start/end dates, max occurrences).

**Scheduling model:**
- **Frequencies:** WEEKLY, MONTHLY, QUARTERLY, ANNUALLY
- **Day targeting:** `dayOfMonth` (1-28) for monthly/quarterly/annually, `dayOfWeek` (0-6) for weekly
- **Completion:** Template auto-completes when `maxOccurrences` is reached or `nextGenerationDate` exceeds `endDate`
- **Status lifecycle:** ACTIVE → PAUSED (resume) → ACTIVE, or ACTIVE → CANCELLED, or ACTIVE → COMPLETED

**Generation flow:**
1. `POST /tenant/sales/recurring-invoices/generate` finds all ACTIVE templates where `nextGenerationDate <= asOfDate`
2. For each template, creates a DRAFT Sales Invoice using `generateDocumentNumber()` from SalesSettings (increments sequence)
3. Advances the template: increments `occurrencesGenerated`, computes `nextGenerationDate`, marks COMPLETED if done
4. Saves updated SalesSettings to persist the sequence increment

**Clone flow:**
1. `POST /tenant/sales/invoices/:invoiceId/clone-to-template` reads an existing SI
2. Extracts customer, lines, prices, payment terms into a new template
3. User provides name, frequency, and scheduling parameters

### Key files:
| Layer | File |
|-------|------|
| Entity | `backend/src/domain/sales/entities/RecurringInvoiceTemplate.ts` |
| Repo interface | `backend/src/repository/interfaces/sales/IRecurringInvoiceTemplateRepository.ts` |
| Firestore repo | `backend/src/infrastructure/firestore/repositories/sales/FirestoreRecurringInvoiceTemplateRepository.ts` |
| Use cases | `backend/src/application/sales/use-cases/RecurringInvoiceUseCases.ts` |
| Controller | `backend/src/api/controllers/sales/RecurringInvoiceController.ts` |
| Routes | `backend/src/api/routes/sales.routes.ts` (8 new endpoints) |
| DI binding | `backend/src/infrastructure/di/bindRepositories.ts` |
| Frontend page | `frontend/src/modules/sales/pages/RecurringInvoicesPage.tsx` |
| Frontend API | `frontend/src/api/salesApi.ts` (`recurringInvoiceApi` object) |
| Frontend route | `frontend/src/router/routes.config.ts` (`/sales/recurring-invoices`) |

### API Endpoints:
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/tenant/sales/recurring-invoices` | List templates (filter by status, customerId) |
| GET | `/tenant/sales/recurring-invoices/:id` | Get template by ID |
| POST | `/tenant/sales/recurring-invoices` | Create new template |
| PUT | `/tenant/sales/recurring-invoices/:id` | Update template |
| POST | `/tenant/sales/recurring-invoices/:id/pause` | Pause active template |
| POST | `/tenant/sales/recurring-invoices/:id/resume` | Resume paused template |
| POST | `/tenant/sales/recurring-invoices/:id/cancel` | Cancel template |
| POST | `/tenant/sales/recurring-invoices/generate` | Generate all due invoices |
| POST | `/tenant/sales/invoices/:invoiceId/clone-to-template` | Clone SI to template |

### Tests:
19 unit tests covering entity validation, state transitions, use case execution, and generation logic.

### Post-implementation hardening (2026-05-22)

- `RecurringInvoiceController` now enforces authenticated tenant context and user identity using `req.user.companyId` + `req.user.uid` (no nullable fallbacks).
- Create and clone endpoints now validate required payload fields before entering use cases, returning 400-level errors for malformed requests.
- `RecurringInvoiceTemplate` now validates date fields (`startDate`, `nextGenerationDate`, optional `endDate`) as `YYYY-MM-DD`, enforces non-empty template names, and enforces line quantity > 0.
- `UpdateRecurringInvoiceTemplateUseCase` explicitly rejects empty-line updates.
- Frontend now exposes clone-to-recurring from Sales Invoice detail (`Clone to Recurring`) and supports weekly weekday selection in both create and clone flows.
- Recurring invoices UI strings are now wired to i18n (`en`, `ar`, `tr`) under `sales.recurring.*`.

---

## Sales-return enhancements (Phase D.5)

Phase D.5 extends returns from a pure operational reversal into a configurable commercial settlement event.

### New return commercial fields

- `settlementMode`: `CREDIT_NOTE | REFUND`
- `reasonCode`: `DEFECTIVE | WRONG_ITEM | CHANGED_MIND | OTHER`
- `reason`: free-text explanation (retained)
- Restocking fee model:
  - `restockingFeeType`: `PERCENT | AMOUNT`
  - `restockingFeeValue`
  - computed `restockingFeeAmountDoc`, `restockingFeeAmountBase`
- Computed net settlement values:
  - `netSettlementAmountDoc`
  - `netSettlementAmountBase`

`SalesReturn` now recomputes totals + restocking + net settlement in one place (`recalculateMonetaryTotals`) to keep posting math and API output consistent.

### Posting behavior

For `AFTER_INVOICE` and `DIRECT` returns:

- Revenue reversal voucher (`SR-REV-*`) now credits AR by **net settlement** (gross return minus restocking fee).
- If restocking fee is non-zero, an extra credit line is posted to revenue (same account fallback chain as return lines / default sales revenue account).

Settlement-mode branching:

- `CREDIT_NOTE`:
  - keeps current customer-credit behavior
  - reduces linked SI outstanding by `netSettlementAmountBase`
- `REFUND`:
  - posts an additional refund voucher (`SR-REF-*`): `Dr AR / Cr settlement account`
  - settlement account resolves from enabled payment-method mapping in Sales settings (`paymentMethodConfigs`)
  - linked SI outstanding is not reduced by this branch automatically

`BEFORE_INVOICE` remains inventory/COGS-only and does not run revenue/refund settlement posting.

### API + validation updates

- Create/Update return payloads now accept settlement/reason/restocking fields.
- Validators enforce enum values and restocking constraints (non-negative, percent <= 100).
- Direct-return create validation now explicitly supports `DIRECT` + `customerId` flow (previous validation only allowed SI/DN source IDs).

### Frontend updates

`SalesReturnDetailPage` create flow now includes:
- Settlement mode selector
- Reason code selector
- Restocking fee type/value controls

Detail view now displays:
- settlement mode
- reason code
- restocking fee amount
- net settlement amount

---

## Invoice templates (Phase D.7)

Phase D.7 adds controlled invoice-template selection for Sales Invoices and customer-level default template assignment.

### Scope implemented

- Sales Invoice create page now loads company voucher forms and filters invoice templates by runtime persona (`sales_invoice_direct` vs `sales_invoice_linked`).
- User can select an invoice template explicitly on create.
- Customer master (`Party`) now stores:
  - `defaultSalesInvoiceTemplateId`
  - `defaultSalesInvoiceFormType`
- New invoice create flow auto-selects a template in this precedence:
  1. customer `defaultSalesInvoiceTemplateId` (if valid for current persona)
  2. persona-matching default template
  3. first persona-matching template
- Invoice persistence now stores template identity separately from policy form token:
  - `voucherFormId` (selected template ID)
  - `formType` (governance persona token)

### Why this design

Governance and persona checks already rely on `formType` tokens (`sales_invoice_direct`, `sales_invoice_linked`, etc.). Storing the selected layout in `voucherFormId` keeps governance stable while still preserving which concrete template was chosen for print layout (logo/footer/terms).

### Backend/Frontend contract changes

- `SalesInvoice` entity and DTO now include optional `voucherFormId`.
- Create SI validator accepts optional `voucherFormId` and optional `formType` on native-source create.
- `Party` entity/use-cases/API include default invoice-template fields for customer-level prefill.

### Deferred by design

- Full free-canvas/sketch-board layout editing is intentionally deferred (future D7.3-style enhancement).
- Current implementation is controlled-template selection on top of the existing Forms Designer model.

---

## Outbound invoice messaging (Phase D.8 — WhatsApp + Telegram)

Phase D.8 introduces outbound invoice sharing from the Sales Invoice detail page using WhatsApp and Telegram. The initial single-environment sender shortcut was replaced with tenant-scoped sender accounts in Sales settings so each company controls its own communication identity.

### Flow

1. User opens a **POSTED** Sales Invoice and chooses **Send via WhatsApp** or **Send via Telegram**.
2. UI collects sender account, destination, optional document URL, and message text.
3. Backend endpoint `POST /tenant/sales/invoices/:id/send-whatsapp` validates payload and loads the invoice + customer.
4. `SendSalesInvoiceWhatsappUseCase` enforces:
   - invoice must exist and be `POSTED`
   - recipient phone must be valid E.164
   - message length <= 4096 chars
5. Use case resolves the company sender account from `SalesSettings.messagingAccounts` (active + default per channel, optional explicit account selection).
6. Sender credentials are decrypted at runtime and passed to `IInvoiceMessagingProvider.sendWhatsAppMessage(...)`.
7. Current provider implementation supports:
   - WhatsApp: Meta Graph API `/{phone-number-id}/messages`
   - Telegram: Bot API `/bot{token}/sendMessage`

### Architecture points

- Sales application layer depends on provider + resolver contracts (`IInvoiceMessagingProvider`, `ICompanyMessagingResolver`), not on Meta API types.
- Per-company sender accounts live in `SalesSettings.messagingAccounts`.
- Credentials are stored encrypted (`encryptedCredential`) and never returned to the frontend.
- Sender account resolution is tenant-scoped and supports multiple sender accounts per company, with one default active sender per channel.
- Provider wiring is done via DI (`diContainer.invoiceMessagingProvider`, `diContainer.companyMessagingResolver`).
- Environment-level provider config remains as legacy fallback only:
  - `WHATSAPP_CLOUD_ACCESS_TOKEN`
  - `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
  - optional `WHATSAPP_CLOUD_API_VERSION` (default `v22.0`)
- Optional `ERP_APP_BASE_URL` is used to build default invoice deep links in message text when no explicit document URL is supplied.

### Key files

| Layer | File |
|---|---|
| Use case | `backend/src/application/sales/use-cases/InvoiceMessagingUseCases.ts` (WhatsApp + Telegram) |
| Provider contract | `backend/src/application/sales/services/IInvoiceMessagingProvider.ts` |
| Account resolver contract | `backend/src/application/sales/services/ICompanyMessagingResolver.ts` |
| Credential cipher contract | `backend/src/application/sales/services/ICredentialCipher.ts` |
| Provider implementation | `backend/src/infrastructure/messaging/MetaWhatsAppCloudProvider.ts` |
| Settings-backed resolver | `backend/src/infrastructure/messaging/SalesSettingsMessagingResolver.ts` |
| Controller route | `backend/src/api/controllers/sales/SalesController.ts` |
| Validator | `backend/src/api/validators/sales.validators.ts` |
| Sales settings domain | `backend/src/domain/sales/entities/SalesSettings.ts` |
| Frontend action | `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` |
| Frontend settings page | `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` |
| Frontend API client | `frontend/src/api/salesApi.ts` |

---

## Invoice attachments (Phase D.6)

Phase D.6 adds invoice-level document attachments with tenant-scoped storage. Attachments are linked directly to each Sales Invoice record so supporting evidence (signed proof, customer PO, spreadsheets, etc.) stays auditable with the financial document.

### Flow

1. User opens a Sales Invoice and uploads a file from the **Attachments** panel.
2. Backend validates attachment policy:
   - max 5 files per invoice
   - max 10 MB per file
   - allowed types: PDF, PNG, JPG, DOCX, XLSX
3. File is stored in tenant path:
   - `companies/{companyId}/sales/invoices/{invoiceId}/attachments/...`
4. Attachment metadata is persisted on the invoice:
   - `id`, `name`, `size`, `type`, `path`, `uploadedAt`, `uploadedBy`
5. UI can list, open (signed URL), and remove attachments.

### Architecture points

- Tenant isolation is enforced through authenticated `companyId`; no cross-tenant path reuse.
- Storage access is short-lived via signed links (`15m`) generated server-side.
- Attachment metadata lives in `SalesInvoice.attachments` and is part of repository persistence.
- Implementation intentionally starts with Sales Invoices (highest accounting relevance); same pattern can be extended to SO/DN/SR if required.

### Key files

| Layer | File |
|---|---|
| Sales invoice domain | `backend/src/domain/sales/entities/SalesInvoice.ts` |
| DTO mapper | `backend/src/api/dtos/SalesDTOs.ts` |
| API controller | `backend/src/api/controllers/sales/SalesInvoiceAttachmentController.ts` |
| API routes | `backend/src/api/routes/sales.routes.ts` |
| Frontend API client | `frontend/src/api/salesApi.ts` |
| Frontend UI | `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` |

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
| **Recurring invoices (D.4)** | Implemented — templated (clone) + scheduled (WEEKLY/MONTHLY/QUARTERLY/ANNUALLY) with pause/resume/cancel. |
| **Sales-return enhancements (D.5)** | Implemented: settlement mode, reason code taxonomy, restocking fee + net settlement accounting. |
| **Document attachments (D.6)** | Implemented for Sales Invoices (upload/list/open/remove with tenant-scoped storage + signed links). |
| **Multiple invoice templates (D.7)** | Implemented (controlled model): selectable invoice templates + customer defaults + persisted template ID. |
| **Email integration (D.8 follow-up)** | Deferred. D.8 currently delivers WhatsApp + Telegram outbound messaging with tenant-scoped sender accounts; email can be added as another channel/provider path. |
