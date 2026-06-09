# Architecture: Purchases Module

**Last updated:** 2026-06-01
**Status:** Feature-complete for V1 (4 document types). Requisitions and Debit Notes deferred.
**Module-level docs:** [`docs/modules/purchases/`](../modules/purchases/)

---

## Per-vendor AP sub-accounts (Piece A — 2026-05-27)

Purchases mirrors the Sales per-party model for vendor payables:

- Tenant sets `PurchaseSettings.apParentAccountId` (must be `LIABILITY`) and `partyAccountCodeFormat`.
- On party creation with `accountStrategy='AUTO_CREATE'`, vendors get dedicated AP child accounts under that parent and the result is stored in `Party.defaultAPAccountId`.
- `PICK_EXISTING` validates the selected AP account classification and stores it without creating a new account.

Backfill is available for existing vendors:
- `POST /tenant/purchase/settings/backfill-party-accounts` (tenant-scoped)
- `POST /super-admin/companies/:companyId/backfill-party-accounts` (cross-module per company, runs both AR and AP scopes)

This keeps AP balances per vendor auditable and statement-ready without changing posting boundaries.

---

## Vendor Statement engine reuse (Phase F parity — 2026-05-27)

Vendor Statement mirrors the Customer Statement architecture from Sales:

- It loads the vendor Party and requires `Party.defaultAPAccountId`.
- It calls Accounting's `GetAccountStatementUseCase` for that vendor AP sub-account.
- If the vendor has no default AP account, the API returns HTTP `412` with code `VENDOR_AP_ACCOUNT_MISSING`.
- Posted ledger entries are the source of truth for opening balance, activity, and closing balance.
- Draft/unposted purchase documents never affect statement balances.
- Optional open Purchase Orders are shown as non-balance commitments only.

Primary endpoint:
- `GET /tenant/purchase/reports/vendor-statement?vendorId=...&fromDate=...&toDate=...&includeOpenCommitments=false`

Alias endpoint:
- `GET /tenant/purchase/vendors/:partyId/statement?fromDate=...&toDate=...&includeOpenCommitments=false`

AP account sign convention:
- Accounting's account statement stores normal debit-minus-credit running balances.
- AP is credit-normal, so the Vendor Statement converts the displayed running/opening/closing balance to amount owed (`credit - debit`) for user-facing readability.
- Row debit/credit columns still show the actual AP ledger side: bills increase AP by credit; payments and debit notes reduce AP by debit.

Drill-down precedence:
1. Open the original Purchases document when voucher metadata resolves `sourceModule='purchases'` and `sourceType/sourceId`.
2. Offer `Open Accounting Voucher` for the posted voucher.
3. If the source document cannot be resolved, the accounting voucher remains the fallback.

---

## Purchase Invoice Attachments (Phase F parity — 2026-05-28)

Purchase Invoices support tenant-scoped evidence attachments for vendor bill scans and supporting files.

Backend endpoints:
- `GET /tenant/purchase/invoices/:id/attachments`
- `POST /tenant/purchase/invoices/:id/attachments`
- `GET /tenant/purchase/invoices/:id/attachments/:aid/link`
- `DELETE /tenant/purchase/invoices/:id/attachments/:aid`

Control model:
- Storage path: `companies/{companyId}/purchases/invoices/{invoiceId}/attachments/...`
- Metadata is stored on the `PurchaseInvoice.attachments` array.
- Unsaved PI files are held only in the browser as a pending queue; storage and metadata writes occur only after the PI is saved and the backend returns an invoice ID.
- Download/open uses a short-lived server-generated signed URL.
- Max files: `5`
- Max file size: `10 MB`
- Allowed types: PDF, JPG, PNG, DOCX, XLSX

Accounting boundary:
- Attachments are evidence only. They do not change PI posting, AP balances, inventory valuation, tax, settlement/payment status, or voucher amounts.
- Tenant isolation comes from authenticated `companyId`, repository lookup by company, and tenant-scoped storage path.

---

## Vendor Groups (Phase F parity — 2026-05-28)

Vendor Groups are optional supplier segmentation master data for Purchases.

Backend endpoints:
- `GET /tenant/purchase/vendor-groups`
- `POST /tenant/purchase/vendor-groups`
- `GET /tenant/purchase/vendor-groups/:id`
- `PUT /tenant/purchase/vendor-groups/:id`
- `DELETE /tenant/purchase/vendor-groups/:id`
- `POST /tenant/purchase/vendor-groups/assign`

Control model:
- Data lives under the Purchases module collection `vendor_groups`.
- Vendor assignment is stored on shared `Party.vendorGroupId`.
- Only active groups can be assigned.
- A group cannot be deleted while vendor Party records still reference it.
- The UI exposes `Purchases -> Vendor Groups` and a Vendor Group selector on vendor commercial terms.

Accounting boundary:
- Vendor Groups are classification-only in this phase.
- They do not change Purchase Invoice posting, AP balances, payment behavior, tax, inventory valuation, or voucher amounts.
- Future reports can use `Party.vendorGroupId` as a filter without changing ledger source-of-truth rules.

---

## Purchase Price Lists (Phase F parity — 2026-05-28)

Purchase Price Lists mirror Sales Price Lists for Purchases, enabling currency-specific vendor pricing rules.

Backend endpoints:
- `GET /tenant/purchase/price-lists` — list price lists
- `POST /tenant/purchase/price-lists` — create a price list
- `GET /tenant/purchase/price-lists/:id` — get a price list
- `PUT /tenant/purchase/price-lists/:id` — update a price list
- `DELETE /tenant/purchase/price-lists/:id` — delete a price list
- `GET /tenant/purchase/price-lists/effective` — resolves effective unit price for a vendor, item, and quantity

Control model:
- Price lists are stored under the Purchases collection `purchase_price_lists`.
- Each price list has a `currency`, an optional `isDefault` flag per currency, and an array of price `lines` with `itemCode`, `minQty`, and `unitPrice`.
- Only one default price list can exist per currency; setting a price list as default disables the previous default list of the same currency.
- Vendor price list assignment is referenced via `Party.defaultPriceListId`.
- Unit prices are auto-resolved dynamically when adding items or updating quantities in Purchase Orders, Purchase Invoices, and Forms Designer purchases documents.
- Deleting a price list displays a confirmation dialog.

Accounting boundary:
- Price lists are master data. They do not directly post to the GL or affect AP balances until a Purchase Invoice is created and posted using the resolved prices.

---

## Prerequisites

The Accounting **Engine** must be initialized before Purchases is usable. `InitializePurchasesUseCase` calls `EnsureAccountingEngineInitialized` as its first step, which auto-bootstraps the Engine (`standard` COA template, calendar fiscal year, company base currency) if it is not yet initialized. If the Engine cannot be bootstrapped (e.g., the company has no base currency), Purchases initialization throws `AccountingEngineUnavailableError`. The Accounting **UI** does not need to be visible — see [accounting.md](./accounting.md#accounting-engine-vs-accounting-appui).

`PostPurchaseInvoiceUseCase` enforces the same guard at post time: if the Engine is not ready and `createAccountingEffect=true`, it throws rather than marking the invoice POSTED without a voucher.

## Purpose

The Purchases module covers the procure-to-pay cycle: place an order with a supplier, receive the goods, record the bill, pay it, handle returns. It is a mirror image of Sales:

| Sales | Purchases |
|---|---|
| Customer | Vendor / Supplier |
| Sales Order → Delivery Note → Sales Invoice → Receipt | Purchase Order → Goods Receipt → Purchase Invoice → Payment |
| Decrements inventory | Increments inventory |
| Posts AR + Revenue | Posts AP + Inventory/Expense |

## Document Model

```
Purchase Order (PO) → Goods Receipt (GRN) → Purchase Invoice (PI) → Payment
                                       └→ Purchase Return (PR)
```

- **Purchase Order (PO)** — pre-purchase commitment to a vendor. Tracks `orderedQty`, `receivedQty`, `invoicedQty`, `returnedQty`. Status: DRAFT → CONFIRMED → PARTIALLY_RECEIVED / FULLY_RECEIVED → CLOSED / CANCELLED.
- **Goods Receipt (GRN)** — physical receipt of goods. Creates a `PURCHASE_RECEIPT` inventory movement. **Does NOT** post GL entries — purely operational.
- **Purchase Invoice (PI)** — the financial event. Posts AP + Inventory (for stock items) or AP + Expense (for services). Three personas: Direct (standalone), Linked (PO-linked), Service.
- **Purchase Return (PR)** — reverses a delivery and/or invoice. Two contexts: `AFTER_INVOICE` (reverses AP and inventory) and `BEFORE_INVOICE` (reverses inventory only).

## Workflow Modes

Configured in `Purchases → Settings`. Same SIMPLE vs OPERATIONAL split as Sales.

| Aspect | SIMPLE | OPERATIONAL |
|---|---|---|
| PO required (stock items) | No | Yes |
| Standalone PI allowed | Yes | No by default; only through an explicit governance exception |
| GRN required for stock | No | Yes |
| Inventory recognized at | PI posting (if no GRN) | GRN posting |

Operational direct Purchase Invoices are not enabled by the legacy `allowDirectInvoicing` flag alone. The backend authority is `DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed()`, which evaluates workflow base policy plus company/branch/form governance rules. The Purchase Settings policy toggle is a convenience control: when enabled in OPERATIONAL mode it writes a company-scope governance rule for persona `direct`; when disabled it removes company-scope direct rules while preserving form/branch-specific exceptions.

This keeps the market-standard procurement flow strict by default (`PO -> GRN -> PI`) while allowing a company-admin-approved direct PI exception for expenses, service bills, or controlled ad-hoc purchases.

## Vendors

Vendors are not a separate Purchases entity — they are **Party** records (shared module) with `role = 'VENDOR'`. Same legal entity can be both a vendor and a customer.

Vendor-specific overrides:
- `defaultAPAccountId` — overrides company default AP account
- `paymentTermsDays`
- `defaultCurrency`

The Vendors list at `/purchases/vendors` is a filtered view of the Party API.

## Approval before posting (2026-06-03)

In Stage 2b, the Purchases module is decoupled entirely from settings-based approval flags.

- **Decoupled Posting Flow:** `PostPurchaseInvoiceUseCase` does NOT read local settings or check approval flags. It simply attempts to post the document, passing the real approval state (`approved: !!approvalContext`) directly to the `SubledgerVoucherPostingService`.
- **Reactive Guard Rejection & Parking:** If the central accounting policy requires approval and the document is not approved, the posting service throws a `PostingError` with the code `APPROVAL_REQUIRED`.
- **Safe Transactional Status Parking:** The use case catches `APPROVAL_REQUIRED`, rolls back any database writes (via the transaction boundary), and executes a mini serializable transaction to safely park the document status to `PENDING_APPROVAL` without race conditions.
- **Approve Re-entry:** `ApprovePurchaseInvoiceUseCase` re-enters `PostPurchaseInvoiceUseCase.execute` with `approvalContext` set, which sets the document status to `DRAFT` in-memory and passes `approved: true` to succeed.

See [134-purchases-approval-before-posting.md](../../planning/done/134-purchases-approval-before-posting.md).

## Accounting Integration

Purchases never writes to the ledger directly. It builds vouchers and submits them to Accounting's `PostVoucherUseCase` with the `PurchaseInvoiceStrategy` (or return strategy).

**Purchase Invoice posting** creates (for stock items):
```
Dr  Inventory            (item → category → company default)
    Cr  Accounts Payable  (vendor override → company default)
    Dr  Tax Receivable    (from TaxCode)
```

For service items:
```
Dr  Expense              (account on the line)
    Cr  Accounts Payable
    Dr  Tax Receivable
```

**Purchase Return posting** (AFTER_INVOICE) reverses the above. (BEFORE_INVOICE reverses inventory only, no AP impact since none was created.)

**Payment posting** happens via Accounting's Payment Voucher (the user clicks "Create Payment" from the PI):
```
Dr  Accounts Payable
    Cr  Cash / Bank
```

All vouchers carry `sourceModule='purchases'`, `sourceType=<doctype>`, `sourceId=<docId>` for traceability.

**Voucher model: two-voucher roundtrip (decision — Task 186, reaffirmed 2026-06-09).** A paid PI always posts as **two linked vouchers** — the invoice voucher (`Dr Expense/Inventory / Cr A/P`) plus a separate payment voucher (`Dr A/P / Cr Cash/Bank`, own PV- number, linked PaymentHistory, `metadata.sourceInvoiceId`) — never one combined entry. Settle-on-post and pay-later use the same mechanism; only timing differs. Rationale (timing symmetry with immutable posted vouchers, Purchases Journal vs Cash Payments Journal separation, clean bank reconciliation/reversal, and over-payment handling) is detailed in [sales.md](./sales.md) "Voucher model". The "one transaction" view is a UI grouping concern (link via `sourceInvoiceId`), not a posting change.

**Settlement preserved across the approval boundary (2026-06-09).** When approval is enabled, posting a paid PI hits `APPROVAL_REQUIRED` and rolls back (invoice + payment voucher) as the PI is parked `PENDING_APPROVAL`. The entered settlement is preserved on `PurchaseInvoice.pendingSettlement` and replayed by `ApprovePurchaseInvoiceUseCase` (explicit approval-request `settlementInput` wins; otherwise the stored intent is used; cleared on successful post). The Approval Center shows a per-row preview of what will post. Mirrors Sales (see [sales.md](./sales.md) "Settlement preserved across the approval boundary").

**Over-payment (vendor credit) — opt-in (`PurchaseSettings.allowOverpayment`, default off).** By default a `MULTI` settlement may not exceed the PI outstanding. When enabled, an over-payment debits A/P by the **full** cash paid, driving the vendor's A/P balance **negative** — a prepayment the vendor owes back / offsets their future bills. The PI is marked `PAID` (outstanding clamped at 0); the credit lives in the **A/P ledger**, not on the invoice. Mirrors `SalesSettings.allowOverpayment` (see [sales.md](./sales.md) "Over-payment"). `CASH_FULL` stays exact; over-payment flows through `MULTI`.

## Inventory Integration

Purchases calls the inventory contract `IPurchasesInventoryService`:
- `processIN()` for GRN postings — creates `PURCHASE_RECEIPT` movement with the unit cost from the PI/PO.
- `processIN()` for PI postings in SIMPLE mode when there's no prior GRN — creates `PURCHASE_RECEIPT` directly.
- `processOUT()` for returns — creates `PURCHASE_RETURN` movement, reversing the cost.

**No GRNI accrual in V1.** The system does not maintain a "Goods Received Not Invoiced" interim account. Inventory cost lands at GRN, AP lands at PI — there is a timing gap, but it's acceptable because the cost is correct from GRN and the AP is recognized at PI.

## Validation Rules

- **OPERATIONAL + stock items:** `invoicedQty ≤ receivedQty` per PI line (blocks at posting).
- **OPERATIONAL + services:** `servicedQty ≤ orderedQty` per PI line (no GRN required for services).
- **SIMPLE + SO-linked:** `invoicedQty ≤ orderedQty × (1 + tolerance%)`.
- **SIMPLE + standalone:** no qty constraint.
- Workflow mode switch (OPERATIONAL → SIMPLE) is blocked if open POs or draft GRNs exist.
- Tax codes are snapshotted onto PI lines at posting.

## Multi-Currency

- PO / GRN / PI / PR support a document currency with a frozen exchange rate.
- GL posting lands in base currency.
- Inventory cost is converted at the document FX rate.

## Key Use Cases

| Use case | Purpose |
|---|---|
| `CreatePurchaseOrderUseCase` / `ConfirmPurchaseOrderUseCase` / `CancelPurchaseOrderUseCase` / `ClosePurchaseOrderUseCase` | PO lifecycle |
| `CreateGoodsReceiptUseCase` / `PostGoodsReceiptUseCase` | GRN flow; calls `processIN()` |
| `CreatePurchaseInvoiceUseCase` / `PostPurchaseInvoiceUseCase` | PI flow; AP + Inventory/Expense GL |
| `CreatePurchaseReturnUseCase` / `PostPurchaseReturnUseCase` | Return flow; context-aware reversals |
| `PaymentSyncUseCases` | Sync payment status from Accounting payment vouchers |
| `InitializePurchasesUseCase` / `GetPurchaseSettingsUseCase` / `UpdatePurchaseSettingsUseCase` | Setup and config |

All under `backend/src/application/purchases/use-cases/`.

## File Map

| Concern | Path |
|---|---|
| Domain entities | `backend/src/domain/purchases/entities/` |
| Use cases | `backend/src/application/purchases/use-cases/` |
| Routes | `backend/src/api/routes/purchases.routes.ts` |
| Frontend module | `frontend/src/modules/purchases/` |
| Inventory contract | `backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts` |
| Module deep-dive | `docs/modules/purchases/MASTER_PLAN.md`, `ALGORITHMS.md` |

## Native Purchases detail-page parity (2026-06-08)

Purchase Order and Purchase Invoice detail pages now render through the shared Sales Invoice-style document scaffold at `frontend/src/components/shared/DocumentDetailScaffold.tsx`. The scaffold owns the common page skeleton: compact topbar, document/status pills, full-height scroll workspace, optional responsive side rail, edge-triggered rail drawer, and persistent footer summary/actions. The scaffold rail controls are RTL-aware, so Arabic layouts mirror the rail edge, drawer side, inner hide button, and back-arrow direction.

Purchase pages supply their own business-specific slots. Purchase Orders use vendor/order/procurement workflow content. Purchase Invoices use vendor bill, PO/direct source, attachments, AP totals/payment status, SoD approval messaging, payment/return/unpost actions, and settlement-on-post panels.

Purchase Invoice now reuses the Sales Invoice page anatomy inside the scaffold, not only the outer chrome. Create/edit and saved-view modes use the shared control strip, compact source-aware header card, shared line-items region, allocation-grid placeholder, attachments/audit shortcut tiles, and side rail ordered as Info, Posting Readiness/Document Status, Settlement, and Totals. The vendor picker is role-filtered to vendors only.

- Purchase Order shows a sticky subtotal / tax / grand-total strip beside save, confirm, receive, invoice, cancel, and close actions.
- Purchase Invoice create/edit and posted views show a sticky subtotal / tax / grand-total strip beside save/post/payment/return/unpost actions.
- Purchase Invoice source selection no longer accepts arbitrary raw `purchaseOrderId` text. The form loads real Purchase Orders and uses a dropdown, then loads open PO lines from the selected document.
- Purchase Invoice no longer renders the old standalone header/totals/attachments card stack in create/edit or saved view; totals live in the rail and sticky footer like Sales Invoice.
- Both pages use the same shared route shell pattern instead of each page owning a separate topbar/footer implementation.

These changes are UI/data-integrity improvements only. They do not change AP posting, tax calculation, inventory receipt valuation, settlement, approval, SoD enforcement, period-lock behavior, or ledger writes.

## Native Purchases document table/list parity (2026-06-09)

Purchase document line sections now share the configurable line table shell at `frontend/src/components/shared/ClassicLineItemsTable.tsx`. Purchase Invoice already used it; Purchase Order, Goods Receipt, and Purchase Return create/edit/view line sections now render through the same table chrome with document-specific columns.

Goods Receipt draft/edit and Purchase Return saved/edit views now render through `DocumentDetailScaffold`, giving them the same compact topbar, badges, side rail, footer totals/actions, and workspace scroll behavior as Purchase Invoice and Purchase Order. Purchase Return create mode keeps its source-picking card flow for now, but its return line table uses the shared line shell.

Operational Purchases lists now use `OperationalListLayout` across Purchase Orders, Goods Receipts, Purchase Invoices, and Purchase Returns. Goods Receipts and Purchase Returns were migrated from custom card/table pages to the shared list shell with inline filters, quick status pills, centered columns, row actions, and 25-row pagination.

### Accounting impact

These changes are UI/data-entry consistency only. They do not change PO commercial calculations, GRN receipt posting, PI/AP posting, Purchase Return reversals, tax, inventory valuation, settlement, approval, period-lock behavior, or ledger writes.

## Shared document section contract (2026-06-09)

The Purchases native document scaffold now defines fixed body sections instead of letting each page own a separate body structure: `control`, `header`, `lines`, `secondary`, `attachments`, and `custom`. The right rail is also structured as `info`, `readiness`, `settlement`, `totals`, and `custom`, and footer content is controlled by `totals` and `actions`.

Each slot has a show/hide contract through `DocumentScaffoldSection`. This lets Purchase Invoice show settlement/footer totals while Goods Receipt can hide settlement and still keep the same document anatomy. Existing Purchases pages that still pass legacy `children` or `sideRail` are normalized through the scaffold's `custom` slot until their body regions are fully split into strict slots.

Authoritative contract: [`docs/architecture/document-scaffold.md`](./document-scaffold.md).

### Accounting impact

This is layout architecture only. It does not change AP posting, tax, inventory valuation, GRN receipt posting, Purchase Return reversals, settlement, approval, period-lock, SoD, or ledger behavior.

### Key files

| Layer | File |
|---|---|
| Shared line table | `frontend/src/components/shared/ClassicLineItemsTable.tsx` |
| Shared document scaffold | `frontend/src/components/shared/DocumentDetailScaffold.tsx` |
| Goods Receipt list/detail | `frontend/src/modules/purchases/pages/GoodsReceiptsListPage.tsx`, `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx` |
| Purchase Return list/detail | `frontend/src/modules/purchases/pages/PurchaseReturnsListPage.tsx`, `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx` |
| Purchase Order detail | `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx` |

## What Is NOT Implemented

| Feature | Status |
|---|---|
| **Purchase Requisitions** | Planned. Internal request-to-purchase workflow before PO. |
| **Debit Notes (as separate type)** | Planned. Currently rolled into Purchase Return. |
| **Withholding Tax** | Deferred V2. Market-specific complexity. |
| **Landed Cost Allocation** | Deferred V2. Freight/duty allocation across received items. |
| **Vendor Price Lists** | Implemented V1 (Purchase Price Lists). |
| **GRNI Accrual** | Deferred V2. No "Goods Received Not Invoiced" interim account. |
| **Three-Way Matching Reports** | Deferred V2. Compare PO ↔ GRN ↔ PI. |
| **Vendor Credit Limits** | Deferred V2. |
| **Blanket POs** | Deferred V2. |
