# Phase 2 — Delivery Note + Sales Invoice Posting — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phase 1 is complete and audited. The following already exist:
- `Party` entity + CRUD (CUSTOMER role supported)
- `TaxCode` entity + CRUD (SALES/BOTH scope)
- `Item` entity with `defaultSalesTaxCodeId`, `revenueAccountId`, `cogsAccountId`
- `SalesSettings` entity + CRUD (with salesControlMode)
- `SalesOrder` entity + CRUD + status machine
- `SalesInventoryService` with `processOUT()` and `processIN()`
- All frontend pages for customers, SOs, settings

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\sales\MASTER_PLAN.md` — Rules S4–S9, Effect Matrix §5.1, COGS §5.3
2. `d:\DEV2026\ERP03\docs\sales\SCHEMAS.md` — DeliveryNote (§SL3), SalesInvoice (§SL4)
3. `d:\DEV2026\ERP03\docs\sales\ALGORITHMS.md` — PostDeliveryNote (§3), PostSalesInvoice (§4), COGS resolution (§7), tests (§8)

**Also study the equivalent Purchase implementation:**
- `backend/src/application/purchases/use-cases/GoodsReceiptUseCases.ts` — GRN posting pattern (but DN has COGS GL!)
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — PI posting pattern
- `backend/src/application/purchases/use-cases/PurchasePostingHelpers.ts` — shared helpers

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`.

---

## TASK 2A: Domain Entities

### DeliveryNote + DeliveryNoteLine
Create `backend/src/domain/sales/entities/DeliveryNote.ts`:
- Use `DeliveryNoteProps` and `DeliveryNoteLine` from SCHEMAS.md §SL3.
- Validate: `warehouseId` required, `lines` not empty, each `deliveredQty > 0`.
- Status defaults to `DRAFT`.
- `stockMovementId`, `unitCostBase`, `lineCostBase` on lines populated AFTER posting (from inventory engine).
- `cogsVoucherId` populated after posting.

### SalesInvoice + SalesInvoiceLine
Create `backend/src/domain/sales/entities/SalesInvoice.ts`:
- Use `SalesInvoiceProps` and `SalesInvoiceLine` from SCHEMAS.md §SL4.
- Validate: `customerId` required, `lines` not empty, each `invoicedQty > 0`, `unitPriceDoc >= 0`.
- Payment defaults: `paymentStatus = 'UNPAID'`, `paidAmountBase = 0`.
- Export `SIStatus`, `PaymentStatus` types.

### Verification
```bash
npx tsc --noEmit
```

---

## TASK 2B: Repository Interfaces + Firestore

### Repository Interfaces
Create under `backend/src/repository/interfaces/sales/`:

| File | Key Methods |
|------|-------------|
| `IDeliveryNoteRepository.ts` | `create(dn)`, `update(dn)`, `getById(companyId, id)`, `list(companyId, opts: { salesOrderId?, status?, limit? })` |
| `ISalesInvoiceRepository.ts` | `create(si)`, `update(si)`, `getById(companyId, id)`, `getByNumber(companyId, number)`, `list(companyId, opts: { customerId?, salesOrderId?, status?, paymentStatus?, limit? })` |

### Firestore Implementations
Create under `backend/src/infrastructure/firestore/repositories/sales/`:

| File | Firestore Path |
|------|---------------|
| `FirestoreDeliveryNoteRepository.ts` | `companies/{companyId}/sales/Data/delivery_notes/{id}` |
| `FirestoreSalesInvoiceRepository.ts` | `companies/{companyId}/sales/Data/sales_invoices/{id}` |

### DI Registration
Update `backend/src/infrastructure/di/bindRepositories.ts`.

---

## TASK 2C: DN Posting Use Case (THE CRITICAL ONE — COGS ON DELIVERY)

> **KEY DIFFERENCE FROM PURCHASES:** Unlike GRN (which creates NO GL), DN creates COGS GL entries!

Create `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts`:

### CreateDeliveryNoteUseCase
```
- Load SalesSettings
- If CONTROLLED mode: ASSERT salesOrderId is provided
- If SO linked: load SO, validate status in ['CONFIRMED', 'PARTIALLY_DELIVERED']
- Pre-fill lines from SO if creating from SO context
- For each line: snapshot itemCode, itemName from Item
- Generate dnNumber using generateDocumentNumber(settings, 'DN')
- Save DN with status='DRAFT'
- Save settings (incremented sequence)
```

### PostDeliveryNoteUseCase — IMPLEMENT EXACTLY AS ALGORITHMS.md §3
```
1. ASSERT dn.status === 'DRAFT'
2. Load settings
3. If SO-linked: load SO, validate SO status, check over-delivery tolerance

4. For each line:
   a. Load Item, ASSERT trackInventory = true
   b. Load Warehouse, ASSERT exists
   c. Call ISalesInventoryService.processOUT({
        companyId, itemId, warehouseId,
        qty: deliveredQty (converted to baseUom),
        date: deliveryDate,
        movementType: 'SALES_DELIVERY',
        refs: { type: 'DELIVERY_NOTE', docId: dn.id, lineId: lineId },
        currentUser
      })
   d. line.stockMovementId = result.id
   e. line.unitCostBase = result.unitCostBase  ← WAC FROM INVENTORY ENGINE
   f. line.lineCostBase = deliveredQty × unitCostBase

5. CREATE COGS GL VOUCHER:
   Accumulate by (cogsAccountId, inventoryAccountId):
     Dr COGS Account        sum(lineCostBase)    [item → category → settings.defaultCOGSAccountId]
     Cr Inventory Account   sum(lineCostBase)    [item → category → company default]
   VoucherEntity metadata:
     sourceModule = 'sales', sourceType = 'DELIVERY_NOTE', sourceId = dn.id
   dn.cogsVoucherId = voucher.id

6. If SO-linked:
   For each line with soLineId:
     soLine.deliveredQty += dn.line.deliveredQty
   updateSOStatus(so) ← use algorithm from ALGORITHMS.md §2
   save(so)

7. dn.status = 'POSTED', dn.postedAt = now()
   save(dn)
```

### COGS Account Resolution (hierarchical)
```
resolveCogsAccount(item, itemCategory, settings):
  return item.cogsAccountId
      || itemCategory?.defaultCogsAccountId
      || settings.defaultCOGSAccountId
      || THROW 'No COGS account configured'
```

### ListDeliveryNotesUseCase / GetDeliveryNoteUseCase
Standard list/get.

---

## TASK 2D: Sales Invoice Posting Use Case (REVENUE RECOGNITION)

Create `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`:

### CreateSalesInvoiceUseCase
```
- Load SalesSettings
- Load customer (Party), snapshot customerName
- If SO-linked: load SO, pre-fill lines from SO
  - CONTROLLED stock: limit qty to deliveredQty - invoicedQty
  - CONTROLLED service: limit qty to orderedQty - invoicedQty
  - SIMPLE SO-linked: limit qty to orderedQty - invoicedQty
- For each line:
  - Snapshot: itemCode, itemName, trackInventory from Item
  - Apply tax defaults from Item.defaultSalesTaxCodeId
  - Compute: lineTotalDoc, lineTotalBase, taxAmountDoc, taxAmountBase
- Compute paymentTermsDays from customer or settings
- Compute dueDate
- Generate invoiceNumber
- Save SI with status='DRAFT'
```

### PostSalesInvoiceUseCase — IMPLEMENT EXACTLY AS ALGORITHMS.md §4

```
Step 1: Quantity Validation
  - CONTROLLED + stock: invoicedQty ≤ (soLine.deliveredQty - soLine.invoicedQty) → BLOCK
  - CONTROLLED + service: invoicedQty ≤ (soLine.orderedQty - soLine.invoicedQty) → BLOCK
  - SIMPLE SO-linked: invoicedQty ≤ (soLine.orderedQty - soLine.invoicedQty) + tolerance → BLOCK
  - SIMPLE standalone: NO SO qty check

Step 2: Tax Snapshot
  - Load TaxCode, freeze code + rate on each line
  - Compute taxAmountDoc and taxAmountBase

Step 3: Revenue Account Resolution (hierarchical)
  - item.revenueAccountId → category default → settings.defaultRevenueAccountId

Step 4: SIMPLE Mode Stock Items (no prior DN)
  - ASSERT warehouseId on line
  - Call ISalesInventoryService.processOUT() → SALES_DELIVERY
  - line.stockMovementId = result.id
  - line.unitCostBase = result.unitCostBase (WAC)
  - line.lineCostBase = invoicedQty × unitCostBase
  - Resolve COGS + inventory accounts

Step 5: Revenue GL Voucher
  Dr AR Account           sum(grandTotalBase)   [customer → settings.defaultARAccountId]
  Cr Revenue Account      sum(lineTotalBase)    [per line resolved]
  Cr Sales Tax Account    sum(taxAmountBase)    [from TaxCode.salesTaxAccountId]
  sourceModule = 'sales', sourceType = 'SALES_INVOICE', sourceId = si.id
  si.voucherId = voucher.id

Step 6: COGS GL Voucher (SIMPLE stock items only)
  If any lines had inventory movements:
  Dr COGS Account         sum(lineCostBase)
  Cr Inventory Account    sum(lineCostBase)
  si.cogsVoucherId = cogsVoucher.id

Step 7: Update SO (if linked)
  soLine.invoicedQty += si.line.invoicedQty

Step 8: Finalize
  si.status = 'POSTED', si.postedAt = now()
  si.paymentStatus = 'UNPAID'
  si.outstandingAmountBase = si.grandTotalBase
  save(si)
```

### UpdateSalesInvoiceUseCase
- ASSERT status === 'DRAFT'

### ListSalesInvoicesUseCase / GetSalesInvoiceUseCase
Standard list/get.

---

## TASK 2E: API Endpoints

Add to `SalesController.ts`:

| Handler | Method | Path |
|---------|--------|------|
| createDN | POST | /api/sales/delivery-notes |
| listDNs | GET | /api/sales/delivery-notes |
| getDN | GET | /api/sales/delivery-notes/:id |
| postDN | POST | /api/sales/delivery-notes/:id/post |
| createSI | POST | /api/sales/invoices |
| listSIs | GET | /api/sales/invoices |
| getSI | GET | /api/sales/invoices/:id |
| updateSI | PUT | /api/sales/invoices/:id |
| postSI | POST | /api/sales/invoices/:id/post |

Add DTOs: `DeliveryNoteDTO`, `DeliveryNoteLineDTO`, `SalesInvoiceDTO`, `SalesInvoiceLineDTO`.

---

## TASK 2F: Frontend Pages

### DN List + Detail Pages
- `DeliveryNotesListPage.tsx` — table: dnNumber, customerName, deliveryDate, warehouse, status
- `DeliveryNoteDetailPage.tsx` — header, lines, Post button

### SI List + Detail Pages
- `SalesInvoicesListPage.tsx` — table: invoiceNumber, customerName, invoiceDate, grandTotal, paymentStatus
- `SalesInvoiceDetailPage.tsx` — header, lines, payment info, Post button, "Create Receipt" button

### SO Detail — Action Buttons
Update SO detail page:
- "Deliver Goods" → navigates to DN create pre-filled from SO
- "Create Invoice" → navigates to SI create pre-filled from SO

### API Client + Routes + Sidebar
Update `salesApi.ts`, `routes.config.ts`, `moduleMenuMap.ts`.

---

## TASK 2G: Unit Tests

Create `backend/src/tests/application/sales/SalesPostingUseCases.test.ts`:

```
DN Tests:
  1. PostDN creates SALES_DELIVERY inventory movement per line
  2. PostDN creates COGS GL voucher (Dr COGS, Cr Inventory)
  3. PostDN updates SO line deliveredQty
  4. PostDN updates SO status to PARTIALLY_DELIVERED

SI Tests:
  5. PostSI (CONTROLLED stock): blocks if invoicedQty > deliveredQty
  6. PostSI (CONTROLLED service): allows invoice without DN
  7. PostSI (SIMPLE standalone): creates inventory OUT + Revenue + COGS vouchers
  8. PostSI (SIMPLE SO-linked): blocks if invoicedQty > orderedQty
  9. PostSI: tax snapshot frozen at posting time

Multi-currency:
  10. PostSI with foreign currency: base amounts computed correctly
```

---

## Verification

```bash
cd d:\DEV2026\ERP03\backend && npx tsc --noEmit
cd d:\DEV2026\ERP03\backend && npx vitest run src/tests/application/sales/
cd d:\DEV2026\ERP03\frontend && npm run build
```

---

## Audit Report

Write to `d:\DEV2026\ERP03\docs\sales\AUDIT_PHASE_2.md`.
Follow the same format as `docs/purchases/AUDIT_PHASE_2.md`.

---

## FINAL RULES

1. **Read ALL spec docs before writing ANY code.**
2. **Execute tasks in order: 2A → 2B → 2C → 2D → 2E → 2F → 2G.**
3. **DN creates COGS GL entries. This is THE key difference from GRN in Purchases. Rule S4.**
4. **COGS unit cost comes from `processOUT()` result — the inventory engine's WAC.**
5. **SI has TWO vouchers in SIMPLE mode: Revenue voucher + COGS voucher.**
6. **Use `ISalesInventoryService` (not `IPurchasesInventoryService`). Check interface methods.**
7. **Study Purchase module's PostPurchaseInvoiceUseCase for GL voucher creation pattern.**
8. **Tax snapshot at posting. salesTaxAccountId from TaxCode, not purchaseTaxAccountId.**
9. **Standalone SI (salesOrderId is null) has no SO quantity constraints.**
10. **All Firestore writes for DN/SI posting MUST be in a single transaction.**
