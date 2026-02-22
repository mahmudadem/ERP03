# Sales Module — Master Plan

> **Module ID:** `sales`
> **Dependencies:** `accounting` (vouchers, ledger, COA), `inventory` (items, stock movements)
> **Priority:** Phase 3 (after Inventory and Purchases)

## Business Context

The Sales module manages the revenue cycle: customers → quotations → sales orders → delivery → sales invoices → receipts. It integrates with Inventory (deliveries reduce stock) and Accounting (invoices create AR vouchers that hit the general ledger).

## Current State

- No existing stubs for Sales
- Backend and frontend need to be built from scratch
- POS module exists with basic `POSOrder` entity — Sales module is separate but shares items

## Architectural Decisions

### AD-1: Firestore Save Paths
```
companies/{companyId}/sales/Settings               → Module settings
companies/{companyId}/sales/Data/customers          → Customer master data
companies/{companyId}/sales/Data/quotations         → Quotations
companies/{companyId}/sales/Data/sales_orders       → Sales Orders (SO)
companies/{companyId}/sales/Data/delivery_notes     → Delivery Notes
companies/{companyId}/sales/Data/sales_invoices     → Sales Invoices
companies/{companyId}/sales/Data/credit_notes       → Credit Notes (returns)
```

### AD-2: Document Flow
```
Quotation → Sales Order (SO) → Delivery Note (DN) → Sales Invoice (SI) → Receipt
   ↓            ↓                    ↓                     ↓                ↓
(optional)  (optional)       Reduces Inventory      Creates AR Voucher   Uses existing
                                                      in Accounting      Receipt Voucher
```

- Quotations are **optional** — SOs can be created directly
- SOs are **optional** — invoices can be created directly
- Delivery Notes trigger stock movements (direction: out, type: sales_delivery)
- Sales Invoices generate accounting vouchers (Debit: AR, Credit: Revenue)
- Receipts use the existing `ReceiptVoucherStrategy`

### AD-3: Invoice → Voucher Strategy

```
Sales Invoice Posted
  ↓
SalesInvoiceStrategy.generateLines()
  ↓
Lines:
  - Debit: Accounts Receivable                → total amount
  - Credit: Sales Revenue (per line account)   → line amounts
  - Credit: Output Tax (if applicable)         → tax amounts
```

New additions:
1. `VoucherType.SALES_INVOICE = 'sales_invoice'`
2. `SalesInvoiceStrategy` implementing `IVoucherPostingStrategy`
3. Register in `VoucherPostingStrategyFactory`

### AD-4: Customer → AR Sub-Account
Each customer links to an AR sub-account in the COA, providing subledger functionality.

## Feature Index

| # | Feature | File | Est. Effort |
|---|---------|------|-------------|
| 01 | Customer Management | [01-customer-management.md](./features/01-customer-management.md) | 2-3 days |
| 02 | Quotations | [02-quotations.md](./features/02-quotations.md) | 2-3 days |
| 03 | Sales Orders | [03-sales-orders.md](./features/03-sales-orders.md) | 3-4 days |
| 04 | Delivery Notes | [04-delivery-notes.md](./features/04-delivery-notes.md) | 2-3 days |
| 05 | Sales Invoices & AR Posting | [05-sales-invoices.md](./features/05-sales-invoices.md) | 4-5 days |
| 06 | Credit Notes & Sales Reports | [06-credit-notes-reports.md](./features/06-credit-notes-reports.md) | 3-4 days |

## Execution Order

1. **Feature 01** — Customers
2. **Feature 02** — Quotations
3. **Feature 03** — Sales Orders
4. **Feature 04** — Delivery Notes (inventory integration)
5. **Feature 05** — Sales Invoices (accounting integration) ← **Critical path**
6. **Feature 06** — Credit Notes & Reports

## Agent Instructions

Same rules as Purchases module. Mirror the Purchases patterns (Supplier↔Customer, PO↔SO, GRN↔DN, PI↔SI). Study `PurchaseInvoiceStrategy` when building `SalesInvoiceStrategy` — it's the reverse: Debit AR instead of Credit AP.
