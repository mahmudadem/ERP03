# Architecture: Purchases Module

**Last updated:** 2026-05-27
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
| Standalone PI allowed | Yes | No (must reference a GRN) |
| GRN required for stock | No | Yes |
| Inventory recognized at | PI posting (if no GRN) | GRN posting |

## Vendors

Vendors are not a separate Purchases entity — they are **Party** records (shared module) with `role = 'VENDOR'`. Same legal entity can be both a vendor and a customer.

Vendor-specific overrides:
- `defaultAPAccountId` — overrides company default AP account
- `paymentTermsDays`
- `defaultCurrency`

The Vendors list at `/purchases/vendors` is a filtered view of the Party API.

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

## What Is NOT Implemented

| Feature | Status |
|---|---|
| **Purchase Requisitions** | Planned. Internal request-to-purchase workflow before PO. |
| **Debit Notes (as separate type)** | Planned. Currently rolled into Purchase Return. |
| **Withholding Tax** | Deferred V2. Market-specific complexity. |
| **Landed Cost Allocation** | Deferred V2. Freight/duty allocation across received items. |
| **Vendor Price Lists** | Deferred V2. |
| **Approval Workflow** | Deferred V2. Needs a generic approval engine. |
| **GRNI Accrual** | Deferred V2. No "Goods Received Not Invoiced" interim account. |
| **Three-Way Matching Reports** | Deferred V2. Compare PO ↔ GRN ↔ PI. |
| **Vendor Credit Limits** | Deferred V2. |
| **Blanket POs** | Deferred V2. |
