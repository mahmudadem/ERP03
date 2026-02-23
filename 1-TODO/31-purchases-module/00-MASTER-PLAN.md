# Purchases Module — Master Plan

> **Module ID:** `purchases`
> **Dependencies:** `accounting` (vouchers, ledger, COA), `inventory` (items, stock movements)
> **Priority:** Phase 2 (after Inventory)

## Business Context

The Purchases module manages the procurement cycle: suppliers → purchase orders → goods receipt → purchase invoices → payments. It integrates with Inventory (receiving goods updates stock) and Accounting (invoices create AP vouchers that hit the general ledger).

## Current State

- **Frontend:** Placeholder route exists but no implementation
- **Backend:** No domain entities, repositories, or use cases
- Everything needs to be built from scratch, following established patterns

## Architectural Decisions

### AD-1: Firestore Save Paths
```
companies/{companyId}/purchases/Settings           → Module settings
companies/{companyId}/purchases/Data/suppliers      → Supplier master data
companies/{companyId}/purchases/Data/purchase_orders → Purchase Orders
companies/{companyId}/purchases/Data/goods_receipts  → Goods Receipt Notes
companies/{companyId}/purchases/Data/purchase_invoices → Purchase Invoices
companies/{companyId}/purchases/Data/debit_notes     → Debit Notes (returns)
companies/{companyId}/purchases/Data/payment_allocations → Links payments to PIs
```

### AD-2: Document Flow
```
Purchase Order (PO) → Goods Receipt Note (GRN) → Purchase Invoice (PI) → Payment
       ↓                      ↓                         ↓                   ↓
   (optional)         Updates Inventory          Creates AP Voucher    Uses existing
                                                   in Accounting       Payment Voucher
```

- POs are **optional** — invoices can be created directly
- GRNs link to POs and trigger stock movements
- Purchase Invoices generate accounting vouchers (Debit: Purchase/Inventory, Credit: AP)
- Payments use the existing `PaymentVoucherStrategy`

### AD-3: Invoice → Voucher Strategy

When a Purchase Invoice is **posted**, a new `PurchaseInvoiceStrategy` generates the voucher:

```
Purchase Invoice Posted
  ↓
PurchaseInvoiceStrategy.generateLines()
  ↓
Lines:
  - Debit: Purchase Expense (or Inventory Asset for tracked items)    → line amount
  - Debit: Tax Account (if applicable)                                → tax amount
  - Credit: Accounts Payable                                         → total amount
```

This requires:
1. New `VoucherType.PURCHASE_INVOICE = 'purchase_invoice'` enum value
2. New `PurchaseInvoiceStrategy` implementing `IVoucherPostingStrategy`
3. Register in `VoucherPostingStrategyFactory`

### AD-4: Supplier as a Simple Entity
Suppliers are stored in the purchases module (not shared). They have an `accountId` linking to an AP sub-account in the COA. This provides subledger functionality without a complex parallel system.

## Feature Index

| # | Feature | File | Est. Effort |
|---|---------|------|-------------|
| 01 | Supplier Management | [01-supplier-management.md](./features/01-supplier-management.md) | 2-3 days |
| 02 | Purchase Orders | [02-purchase-orders.md](./features/02-purchase-orders.md) | 3-4 days |
| 03 | Goods Receipt Notes | [03-goods-receipt.md](./features/03-goods-receipt.md) | 2-3 days |
| 04 | Purchase Invoices & AP Posting | [04-purchase-invoices.md](./features/04-purchase-invoices.md) | 4-5 days |
| 05 | Debit Notes (Returns) | [05-debit-notes.md](./features/05-debit-notes.md) | 2-3 days |
| 06 | Payment Allocations | Not separate file (embed in PIs & Reports) | 1-2 days |
| 07 | Purchase Reports & Dashboard | [06-purchase-reports.md](./features/06-purchase-reports.md) | 2-3 days |

## Execution Order

1. **Feature 01** — Suppliers (prerequisite for all documents)
2. **Feature 02** — Purchase Orders
3. **Feature 03** — Goods Receipt Notes (connects to inventory)
4. **Feature 04** — Purchase Invoices (connects to accounting) ← **Critical path**
5. **Feature 05** — Debit Notes
6. **Feature 06** — Reports & Dashboard

## Agent Instructions

Same rules as Inventory module. Additionally:
- When creating the `PurchaseInvoiceStrategy`, study `PaymentVoucherStrategy` as the reference
- The invoice → voucher flow must use `CreateVoucherUseCase` (production path, not handlers)
- Supplier accounts should be child accounts under the main AP control account
- All monetary values follow the existing `roundMoney()` utility

## Cross-Cutting Concerns

### DI Bindings (AR-01)
Update `backend/src/infrastructure/di/bindRepositories.ts` to register:
- `ISupplierRepository` → `FirestoreSupplierRepository`
- `IPurchaseOrderRepository` → `FirestorePurchaseOrderRepository`
- `IGoodsReceiptRepository` → `FirestoreGoodsReceiptRepository`
- `IPurchaseInvoiceRepository` → `FirestorePurchaseInvoiceRepository`

### Permissions (AR-02)
Add to `PurchasesModule.permissions`:
```
purchases.suppliers.view, .create, .edit, .delete
purchases.requisitions.view, .create, .submit, .approve, .reject
purchases.orders.view, .create, .approve, .cancel
purchases.receipts.view, .create, .post
purchases.invoices.view, .create, .post, .cancel, .matchOverride
purchases.debitNotes.view, .create, .post
purchases.reports.view
```

### Error Codes (AR-03)
Add to `ErrorCodes.ts`:
```
PURCHASES_SUPPLIER_NOT_FOUND, PURCHASES_SUPPLIER_HAS_OPEN_INVOICES
PURCHASES_PO_NOT_FOUND, PURCHASES_PO_ALREADY_RECEIVED
PURCHASES_MATCHING_FAILED, PURCHASES_MATCHING_TOLERANCE_EXCEEDED
PURCHASES_INVOICE_NOT_FOUND, PURCHASES_INVOICE_ALREADY_POSTED
```

### Prisma Schema (PC-04)
Add models to `backend/prisma/schema.prisma`: `Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `GoodsReceiptLine`, `PurchaseInvoice`, `PurchaseInvoiceLine`, `DebitNote`, `PaymentAllocation`. Follow existing model patterns (id, companyId, timestamps, etc.).
