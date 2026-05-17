# Phase 2 — Goods Receipt + Purchase Invoice Posting — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phases 0 and 1 are complete and audited. The following already exist:
- `Party` entity + CRUD (shared services)
- `TaxCode` entity + CRUD (shared services)
- `PurchaseSettings` entity + CRUD (with procurementControlMode)
- `PurchaseOrder` entity + CRUD + status machine (confirm, cancel, close)
- All frontend pages for vendors, POs, settings
- Item entity with `defaultPurchaseTaxCodeId`

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\purchases\MASTER_PLAN.md` — Rules R4–R10, Effect Matrix §6.1
2. `d:\DEV2026\ERP03\docs\purchases\SCHEMAS.md` — GoodsReceipt (§P3), PurchaseInvoice (§P4)
3. `d:\DEV2026\ERP03\docs\purchases\ALGORITHMS.md` — PostGoodsReceipt (§2), PostPurchaseInvoice (§3), helper functions (§5), tax snapshot (§9), standalone PI validation (§8)
4. `d:\DEV2026\ERP03\docs\purchases\PHASES.md` — Phase 2 section

**Also study the existing Inventory integration contracts:**
- `backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts` — `IPurchasesInventoryService`, `InventoryProcessINContractInput`

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`.

---

## TASK 2A: Domain Entities

### GoodsReceipt + GoodsReceiptLine
Create `backend/src/domain/purchases/entities/GoodsReceipt.ts`:
- Use `GoodsReceiptProps` and `GoodsReceiptLine` from SCHEMAS.md §P3.
- Validate: `warehouseId` required, `lines` not empty, each line `receivedQty > 0`.
- Status defaults to `DRAFT`.
- `stockMovementId` on lines is null until posting.

### PurchaseInvoice + PurchaseInvoiceLine
Create `backend/src/domain/purchases/entities/PurchaseInvoice.ts`:
- Use `PurchaseInvoiceProps` and `PurchaseInvoiceLine` from SCHEMAS.md §P4.
- Validate: `vendorId` required, `lines` not empty, each line `invoicedQty > 0`, `unitPriceDoc >= 0`.
- Payment fields default: `paymentStatus = 'UNPAID'`, `paidAmountBase = 0`.
- `voucherId` and `stockMovementId` on lines are null until posting.
- Export `PIStatus`, `PaymentStatus` types.

### Verification
```bash
npx tsc --noEmit
```

---

## TASK 2B: Repository Interfaces + Firestore

### Repository Interfaces
Create under `backend/src/repository/interfaces/purchases/`:

| File | Key Methods |
|------|-------------|
| `IGoodsReceiptRepository.ts` | `create(grn)`, `update(grn)`, `getById(companyId, id)`, `list(companyId, opts: { purchaseOrderId?, status?, limit? })` |
| `IPurchaseInvoiceRepository.ts` | `create(pi)`, `update(pi)`, `getById(companyId, id)`, `getByNumber(companyId, number)`, `list(companyId, opts: { vendorId?, purchaseOrderId?, status?, paymentStatus?, limit? })` |

### Firestore Implementations
Create under `backend/src/infrastructure/firestore/repositories/purchases/`:

| File | Firestore Path |
|------|---------------|
| `FirestoreGoodsReceiptRepository.ts` | `companies/{companyId}/purchases/Data/goods_receipts/{id}` |
| `FirestorePurchaseInvoiceRepository.ts` | `companies/{companyId}/purchases/Data/purchase_invoices/{id}` |

### DI Registration
Update `backend/src/infrastructure/di/bindRepositories.ts`.

---

## TASK 2C: GRN Posting Use Case (THE CRITICAL ONE FOR INVENTORY)

Create `backend/src/application/purchases/use-cases/GoodsReceiptUseCases.ts`:

### CreateGoodsReceiptUseCase
```
- Load PurchaseSettings
- If CONTROLLED mode: ASSERT purchaseOrderId is provided
- If PO linked: load PO, validate status in ['CONFIRMED', 'PARTIALLY_RECEIVED']
- Pre-fill lines from PO if creating from PO context
- For each line: snapshot itemCode, itemName from Item
- Generate grnNumber using generateDocumentNumber(settings, 'GRN')
- Save GRN with status='DRAFT'
- Save settings (incremented sequence)
```

### PostGoodsReceiptUseCase — IMPLEMENT EXACTLY AS ALGORITHMS.md §2
```
- ASSERT grn.status === 'DRAFT'
- ASSERT grn.warehouseId is valid warehouse
- If CONTROLLED: ASSERT purchaseOrderId, load PO, validate PO status

- BEGIN TRANSACTION:
  For each line:
    - Load Item, ASSERT item.trackInventory === true
    - If PO linked: validate receivedQty against openReceiveQty + tolerance
    - Call IPurchasesInventoryService.processIN({
        companyId, itemId, warehouseId,
        qty: convertToBaseUom(line.receivedQty, line.uom, item),
        date: grn.receiptDate,
        movementType: 'PURCHASE_RECEIPT',
        refs: { type: 'GOODS_RECEIPT', docId: grn.id, lineId: line.lineId },
        currentUser: grn.createdBy,
        unitCostInMoveCurrency: line.unitCostDoc,
        moveCurrency: line.moveCurrency,
        fxRateMovToBase: line.fxRateMovToBase,
        fxRateCCYToBase: line.fxRateCCYToBase,
      })
    - Set line.stockMovementId = movement.id
    - If PO linked: update poLine.receivedQty += line.receivedQty

  - Set grn.status = 'POSTED', grn.postedAt = now()
  - Save GRN
  - If PO: update PO status using updatePOStatus algorithm, save PO
  COMMIT

- NO GL ENTRIES (Rule R4 — GRN is operational only in V1)
```

### ListGoodsReceiptsUseCase / GetGoodsReceiptUseCase
Standard list/get.

---

## TASK 2D: Purchase Invoice Posting Use Case (THE CRITICAL ONE FOR ACCOUNTING)

Create `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`:

### CreatePurchaseInvoiceUseCase
```
- Load PurchaseSettings
- Load vendor (Party), snapshot vendorName
- If PO-linked: load PO, pre-fill lines from PO
  - Stock items in CONTROLLED: limit qty to receivedQty - invoicedQty
  - Services in CONTROLLED: limit qty to orderedQty - invoicedQty
  - SIMPLE PO-linked: limit qty to orderedQty - invoicedQty
- For each line:
  - Snapshot: itemCode, itemName, trackInventory from Item
  - Apply tax defaults from Item.defaultPurchaseTaxCodeId
  - Compute: lineTotalDoc, lineTotalBase, taxAmountDoc, taxAmountBase
- Compute paymentTermsDays from vendor.paymentTermsDays or settings.defaultPaymentTermsDays
- Compute dueDate = invoiceDate + paymentTermsDays
- Generate invoiceNumber
- Save PI with status='DRAFT'
```

### PostPurchaseInvoiceUseCase — IMPLEMENT EXACTLY AS ALGORITHMS.md §3
This is THE most critical use case. Follow ALL 8 steps:

```
Step 1: Quantity Validation
  - CONTROLLED + stock: invoicedQty ≤ (poLine.receivedQty - poLine.invoicedQty) → BLOCK
  - CONTROLLED + service: invoicedQty ≤ (poLine.orderedQty - poLine.invoicedQty) → BLOCK
  - SIMPLE PO-linked: invoicedQty ≤ (poLine.orderedQty - poLine.invoicedQty) + tolerance → BLOCK
  - SIMPLE standalone: NO PO qty check

Step 2: Tax Snapshot
  - Load TaxCode, freeze code + rate on line
  - Compute taxAmountDoc and taxAmountBase

Step 3: GL Account Resolution
  - resolveDebitAccount(item, settings) — hierarchical: item → category → company default
  - resolveAPAccount(vendorId, settings) — vendor override → company default

Step 4: Inventory Movement (SIMPLE + stock items without prior GRN only)
  - Check hasGRNForThisLine(line) — if grnLineId is set, skip
  - If stock item AND no GRN: ASSERT warehouseId, call IPurchasesInventoryService.processIN()
  - Set line.stockMovementId

Step 5: Accumulate GL Voucher Lines
  - Dr Inventory/Expense account (per line)
  - Dr Tax account (per line, if taxAmountBase > 0)

Step 6: AP Credit Line
  - Cr AP account for grandTotalBase

Step 7: Create Accounting Voucher
  - Use createAccountingVoucher() or SubmitVoucherUseCase
  - sourceModule = 'purchases', sourceType = 'PURCHASE_INVOICE', sourceId = pi.id
  - Study how Inventory adjustments create GL vouchers and follow SAME pattern

Step 8: Freeze & Finalize
  - Compute and freeze all totals
  - Set outstandingAmountBase = grandTotalBase
  - Set paymentStatus = 'UNPAID'
  - Set status = 'POSTED', postedAt = now()
  - Set voucherId
  - Save PI
  - If PO linked: update poLine.invoicedQty, update PO status, save PO
```

### UpdatePurchaseInvoiceUseCase
- ASSERT status === 'DRAFT' — posted PIs are immutable

### ListPurchaseInvoicesUseCase / GetPurchaseInvoiceUseCase
Standard list/get with filters.

---

## TASK 2E: API Endpoints

Add to `backend/src/api/controllers/purchases/PurchaseController.ts`:

| Handler | Method | Path |
|---------|--------|------|
| createGRN | POST | /api/purchases/goods-receipts |
| listGRNs | GET | /api/purchases/goods-receipts |
| getGRN | GET | /api/purchases/goods-receipts/:id |
| postGRN | POST | /api/purchases/goods-receipts/:id/post |
| createPI | POST | /api/purchases/invoices |
| listPIs | GET | /api/purchases/invoices |
| getPI | GET | /api/purchases/invoices/:id |
| updatePI | PUT | /api/purchases/invoices/:id |
| postPI | POST | /api/purchases/invoices/:id/post |

Add DTOs: `GoodsReceiptDTO`, `GoodsReceiptLineDTO`, `PurchaseInvoiceDTO`, `PurchaseInvoiceLineDTO` to `PurchaseDTOs.ts`.

---

## TASK 2F: Frontend Pages

### GRN List Page
Create `frontend/src/modules/purchases/pages/GoodsReceiptsListPage.tsx`:
- Table: grnNumber, vendorName, receiptDate, warehouse, status
- "New GRN" button

### GRN Detail Page
Create `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx`:
- Header: GRN number, vendor, PO reference, receipt date, warehouse
- Lines: item, received qty, unit cost
- Post button (DRAFT only)

### PI List Page
Create `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx`:
- Table: invoiceNumber, vendorName, invoiceDate, grandTotal, currency, paymentStatus, status
- Filter: status, paymentStatus, vendor

### PI Detail Page
Create `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`:
- Header: invoice number, vendor invoice number, vendor, dates, currency, exchange rate
- Lines: item, qty, unit price, tax code, totals
- Payment info section: payment terms, due date, outstanding amount, payment status
- Post button (DRAFT only)
- "Create Payment" button (POSTED only — link to accounting payment form, disabled if fully paid)

### PO Detail — Add Action Buttons
Update PO detail page to add:
- "Receive Goods" button → navigates to GRN create page pre-filled from PO
- "Create Invoice" button → navigates to PI create page pre-filled from PO

### API Client
Update `frontend/src/api/purchasesApi.ts`:
```typescript
// GRN
createGRN(payload): Promise<GoodsReceiptDTO>
listGRNs(opts?): Promise<GoodsReceiptDTO[]>
getGRN(id): Promise<GoodsReceiptDTO>
postGRN(id): Promise<GoodsReceiptDTO>

// PI
createPI(payload): Promise<PurchaseInvoiceDTO>
updatePI(id, payload): Promise<PurchaseInvoiceDTO>
listPIs(opts?): Promise<PurchaseInvoiceDTO[]>
getPI(id): Promise<PurchaseInvoiceDTO>
postPI(id): Promise<PurchaseInvoiceDTO>
```

### Routes & Sidebar
Update routes and sidebar to include GRN and PI pages.

---

## TASK 2G: Unit Tests

Create `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts`:

**Required test cases (minimum 9):**

```
GRN Tests:
  1. PostGRN creates PURCHASE_RECEIPT inventory movement per line
  2. PostGRN updates PO line receivedQty
  3. PostGRN updates PO status to PARTIALLY_RECEIVED
  4. PostGRN creates NO GL entries (verify no voucher)

PI Tests:
  5. PostPI (CONTROLLED stock): blocks if invoicedQty > receivedQty
  6. PostPI (CONTROLLED service): allows invoice without GRN
  7. PostPI (SIMPLE standalone): creates inventory movement + GL voucher
  8. PostPI (SIMPLE PO-linked): blocks if invoicedQty > orderedQty
  9. PostPI: tax snapshot frozen at posting time

Multi-currency:
  10. PostPI with foreign currency: base amounts computed correctly
```

---

## Verification

```bash
# Backend compile
cd d:\DEV2026\ERP03\backend
npx tsc --noEmit

# Unit tests
npx vitest run backend/src/tests/application/purchases/

# Frontend build
cd d:\DEV2026\ERP03\frontend
npm run build
```

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\purchases\AUDIT_PHASE_2.md`:

```markdown
# Phase 2 Audit Report — Goods Receipt + Purchase Invoice

## Date: [YYYY-MM-DD HH:MM]

## Domain Entities
| Entity | File | Fields match SCHEMAS.md? |
|--------|------|------------------------|
| GoodsReceipt | GoodsReceipt.ts | ✅/❌ |
| PurchaseInvoice | PurchaseInvoice.ts | ✅/❌ |

## GRN Posting
- [ ] Creates PURCHASE_RECEIPT inventory movements via IPurchasesInventoryService.processIN()
- [ ] Updates PO line receivedQty correctly
- [ ] Updates PO status (PARTIALLY_RECEIVED / FULLY_RECEIVED)
- [ ] Creates NO GL entries (Rule R4)
- [ ] Over-delivery tolerance enforced
- [ ] CONTROLLED mode requires purchaseOrderId

## PI Posting
- [ ] CONTROLLED + stock: blocks if invoicedQty > receivedQty (Rule R6)
- [ ] CONTROLLED + service: allows without GRN, uses orderedQty ceiling (Rule R7)
- [ ] SIMPLE standalone: creates inventory + GL (Rule R8)
- [ ] SIMPLE PO-linked: respects orderedQty (Rule R9)
- [ ] Tax snapshot frozen at posting (Rule R13)
- [ ] GL voucher created: Dr Inventory/Expense, Dr Tax, Cr AP
- [ ] Account resolution follows hierarchy (Rule R16)
- [ ] Voucher metadata: sourceModule='purchases', sourceType='PURCHASE_INVOICE'
- [ ] Multi-currency: base amounts computed correctly (Rule R14)
- [ ] Payment status set to UNPAID, outstandingAmount = grandTotalBase

## API Endpoints
| Method | Path | Status |
|--------|------|--------|
| POST | /api/purchases/goods-receipts | ✅/❌ |
| GET | /api/purchases/goods-receipts | ✅/❌ |
| GET | /api/purchases/goods-receipts/:id | ✅/❌ |
| POST | /api/purchases/goods-receipts/:id/post | ✅/❌ |
| POST | /api/purchases/invoices | ✅/❌ |
| GET | /api/purchases/invoices | ✅/❌ |
| GET | /api/purchases/invoices/:id | ✅/❌ |
| PUT | /api/purchases/invoices/:id | ✅/❌ |
| POST | /api/purchases/invoices/:id/post | ✅/❌ |

## Frontend
| Page | File | Renders? |
|------|------|---------|
| GRN List | GoodsReceiptsListPage.tsx | ✅/❌ |
| GRN Detail | GoodsReceiptDetailPage.tsx | ✅/❌ |
| PI List | PurchaseInvoicesListPage.tsx | ✅/❌ |
| PI Detail | PurchaseInvoiceDetailPage.tsx | ✅/❌ |

- [ ] PO detail has "Receive Goods" and "Create Invoice" buttons
- [ ] PI detail has "Create Payment" button

## Tests
- Total: [N], Passed: [N], Failed: [N]

## Compile & Build
- Backend tsc: [PASS/FAIL]
- vitest: [PASS/FAIL]
- Frontend build: [PASS/FAIL]

## Deviations from Spec
[List any]
```

---

## FINAL RULES

1. **Read ALL spec docs before writing ANY code.**
2. **Execute tasks in order: 2A → 2B → 2C → 2D → 2E → 2F → 2G.**
3. **Tasks 2C (GRN posting) and 2D (PI posting) are THE critical tasks. Spend extra time verifying them against ALGORITHMS.md.**
4. **GRN creates NO GL entries. This is V1 design — Rule R4.**
5. **PI posting validates quantities differently based on mode + item type. Get this right.**
6. **Use `IPurchasesInventoryService.processIN()` from the Inventory integration contracts. Do NOT import Firestore or inventory repos directly.**
7. **Study how Inventory module's `StockAdjustmentUseCases` creates GL vouchers — follow the same pattern for PI posting.**
8. **Tax snapshot must be frozen at posting time. After posting, the line stores the rate as it was, not a live reference.**
9. **Standalone PI (purchaseOrderId is null) has no PO quantity constraints.**
10. **All Firestore writes for GRN/PI posting MUST be in a single transaction.**
