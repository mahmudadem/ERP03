# 195 - Native Invoice Reference Label Clarification

**Date:** 2026-06-09  
**Actual time spent:** ~0.4h  
**Scope:** Sales and Purchases native invoice pages

## Technical Developer View

Clarified the native invoice reference labels without changing the data contract:

- Sales Invoice keeps `customerInvoiceNumber` as optional free text, now labeled **Customer PO / Ref**.
- Purchase Invoice keeps `vendorInvoiceNumber` as optional free text, now labeled **Vendor Invoice / Ref**.
- The internal linked-document selectors remain separate:
  - Sales Invoice From SO uses the existing Sales Order selector.
  - Purchase Invoice From PO uses the existing Purchase Order selector.
- Updated English, Arabic, and Turkish locale strings plus user-guide wording.

Files changed:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`
- `docs/user-guide/purchases/README.md`

## End-User View

On Sales Invoices, **Customer PO / Ref** is where the user types the customer's own PO number or reference from their system. It is not ERP03's invoice number and it is not an internal Purchase Order.

On Purchase Invoices, **Vendor Invoice / Ref** is where the user types the supplier's bill or invoice number. It is separate from selecting an internal Purchase Order.

## Accounting Impact

No posting, tax, AR/AP, inventory, settlement, approval, period-lock, audit, or ledger behavior changed. These are non-financial reference fields only.

## Verification

- `npm --prefix frontend run typecheck` passed.

## Follow-Up

Manual visual QA: open `Sales -> Invoices -> New Sales Invoice` and `Purchases -> Invoices -> New Purchase Invoice` in Direct and linked modes to confirm the labels read clearly in the header and saved view.
