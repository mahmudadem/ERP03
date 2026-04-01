# Phase 2 Audit Report — Delivery Note + Sales Invoice

## Date: 2026-04-01 15:12

## Domain Entities
| Entity | File | Fields match SCHEMAS.md? |
|--------|------|------------------------|
| DeliveryNote | DeliveryNote.ts | ✅ |
| SalesInvoice | SalesInvoice.ts | ✅ |

## DN Posting
- [x] Creates SALES_DELIVERY inventory movements via ISalesInventoryService.processOUT()
- [x] Creates COGS GL voucher (Dr COGS, Cr Inventory) at DN posting (Rule S4)
- [x] Updates SO line deliveredQty correctly
- [x] Updates SO status (PARTIALLY_DELIVERED / FULLY_DELIVERED)
- [x] Over-delivery tolerance enforced
- [x] CONTROLLED mode requires salesOrderId

## SI Posting
- [x] CONTROLLED + stock: blocks if invoicedQty > deliveredQty (Rule S6)
- [x] CONTROLLED + service: allows invoice without DN (Rule S7)
- [x] SIMPLE standalone: creates inventory OUT + Revenue voucher + COGS voucher (Rule S8)
- [x] SIMPLE SO-linked: respects orderedQty tolerance (Rule S9)
- [x] Tax snapshot frozen at posting (Rule S13)
- [x] Revenue voucher created: Dr AR, Cr Revenue, Cr Sales Tax
- [x] Revenue account resolution follows hierarchy (item -> category -> settings default)
- [x] Voucher metadata: sourceModule='sales', sourceType='SALES_INVOICE'
- [x] Multi-currency: base amounts computed correctly (Rule S14)
- [x] Payment status set to UNPAID, outstandingAmount = grandTotalBase

## API Endpoints
| Method | Path | Status |
|--------|------|--------|
| POST | /api/sales/delivery-notes | ✅ |
| GET | /api/sales/delivery-notes | ✅ |
| GET | /api/sales/delivery-notes/:id | ✅ |
| POST | /api/sales/delivery-notes/:id/post | ✅ |
| POST | /api/sales/invoices | ✅ |
| GET | /api/sales/invoices | ✅ |
| GET | /api/sales/invoices/:id | ✅ |
| PUT | /api/sales/invoices/:id | ✅ |
| POST | /api/sales/invoices/:id/post | ✅ |

## Frontend
| Page | File | Renders? |
|------|------|---------|
| DN List | DeliveryNotesListPage.tsx | ✅ |
| DN Detail | DeliveryNoteDetailPage.tsx | ✅ |
| SI List | SalesInvoicesListPage.tsx | ✅ |
| SI Detail | SalesInvoiceDetailPage.tsx | ✅ |

- [x] SO detail has "Deliver Goods" and "Create Invoice" buttons
- [x] SI detail has "Create Receipt" button

## Tests
- Total: 10, Passed: 10, Failed: 0

## Compile & Build
- Backend tsc: PASS
- vitest: PASS
- Frontend build: PASS

## Deviations from Spec
- Runtime routing in this codebase is module-scoped under `/tenant/sales/*` (via tenant module router). Implemented handlers correspond to requested sales DN/SI endpoints, but exposed base path differs from `/api/sales/*`.
