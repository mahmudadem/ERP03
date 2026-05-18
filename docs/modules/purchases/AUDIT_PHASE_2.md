# Phase 2 Audit Report — Goods Receipt + Purchase Invoice

## Date: 2026-04-01 10:57

## Domain Entities
| Entity | File | Fields match SCHEMAS.md? |
|--------|------|------------------------|
| GoodsReceipt | GoodsReceipt.ts | ✅ |
| PurchaseInvoice | PurchaseInvoice.ts | ✅ |

## GRN Posting
- [x] Creates PURCHASE_RECEIPT inventory movements via IPurchasesInventoryService.processIN()
- [x] Updates PO line receivedQty correctly
- [x] Updates PO status (PARTIALLY_RECEIVED / FULLY_RECEIVED)
- [x] Creates NO GL entries (Rule R4)
- [x] Over-delivery tolerance enforced
- [x] CONTROLLED mode requires purchaseOrderId

## PI Posting
- [x] CONTROLLED + stock: blocks if invoicedQty > receivedQty (Rule R6)
- [x] CONTROLLED + service: allows without GRN, uses orderedQty ceiling (Rule R7)
- [x] SIMPLE standalone: creates inventory + GL (Rule R8)
- [x] SIMPLE PO-linked: respects orderedQty (Rule R9)
- [x] Tax snapshot frozen at posting (Rule R13)
- [x] GL voucher created: Dr Inventory/Expense, Dr Tax, Cr AP
- [x] Account resolution follows hierarchy (Rule R16)
- [x] Voucher metadata: sourceModule='purchases', sourceType='PURCHASE_INVOICE'
- [x] Multi-currency: base amounts computed correctly (Rule R14)
- [x] Payment status set to UNPAID, outstandingAmount = grandTotalBase

## API Endpoints
| Method | Path | Status |
|--------|------|--------|
| POST | /api/purchases/goods-receipts | ✅ |
| GET | /api/purchases/goods-receipts | ✅ |
| GET | /api/purchases/goods-receipts/:id | ✅ |
| POST | /api/purchases/goods-receipts/:id/post | ✅ |
| POST | /api/purchases/invoices | ✅ |
| GET | /api/purchases/invoices | ✅ |
| GET | /api/purchases/invoices/:id | ✅ |
| PUT | /api/purchases/invoices/:id | ✅ |
| POST | /api/purchases/invoices/:id/post | ✅ |

## Frontend
| Page | File | Renders? |
|------|------|---------|
| GRN List | GoodsReceiptsListPage.tsx | ✅ |
| GRN Detail | GoodsReceiptDetailPage.tsx | ✅ |
| PI List | PurchaseInvoicesListPage.tsx | ✅ |
| PI Detail | PurchaseInvoiceDetailPage.tsx | ✅ |

- [x] PO detail has "Receive Goods" and "Create Invoice" buttons
- [x] PI detail has "Create Payment" button

## Tests
- Total: 10, Passed: 10, Failed: 0

## Compile & Build
- Backend tsc: PASS
- vitest: PASS
- Frontend build: PASS

## Deviations from Spec
- Runtime routing in this codebase is module-scoped under `/tenant/purchase/*` (via tenant module router). The implemented handlers and paths correspond to the requested GRN/PI endpoints, but exposed base path differs from `/api/purchases/*`.
