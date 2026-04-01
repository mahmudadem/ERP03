# Phase 3 — Sales Returns + Integration + Polish — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phases 1 and 2 are complete and audited. The following already exist:
- `SalesSettings` + `SalesOrder` + CRUD + status machine
- `DeliveryNote` + CRUD + posting (stock OUT + COGS GL)
- `SalesInvoice` + CRUD + posting (Revenue GL + optional COGS for SIMPLE)
- `SalesInventoryService` with `processOUT()` and `processIN()`
- All frontend pages for customers, SOs, DNs, SIs
- 10 passing posting tests

**Read these spec docs:**
1. `d:\DEV2026\ERP03\docs\sales\MASTER_PLAN.md` — Rules S15–S16, Return contexts §2.3
2. `d:\DEV2026\ERP03\docs\sales\SCHEMAS.md` — SalesReturn (§SL5)
3. `d:\DEV2026\ERP03\docs\sales\ALGORITHMS.md` — PostSalesReturn (§5), Payment sync (§6), tests (§8)

**Also study the Purchase return implementation:**
- `backend/src/domain/purchases/entities/PurchaseReturn.ts`
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`

---

## TASK 3A: Domain Entity + Repository

### SalesReturn + SalesReturnLine
Create `backend/src/domain/sales/entities/SalesReturn.ts`:
- Use `SalesReturnProps` and `SalesReturnLine` from SCHEMAS.md §SL5.
- Validate: `customerId` required, `returnContext` must be `'AFTER_INVOICE'` or `'BEFORE_INVOICE'`, `reason` required, `lines` not empty, each `returnQty > 0`.
- `revenueVoucherId`, `cogsVoucherId`, and `stockMovementId` are null until posting.
- Export `ReturnContext`, `SRStatus` types.

### Repository
Create `backend/src/repository/interfaces/sales/ISalesReturnRepository.ts`:
- `create(sr)`, `update(sr)`, `getById(companyId, id)`, `list(companyId, opts: { customerId?, salesInvoiceId?, deliveryNoteId?, status? })`

### Firestore
Create `backend/src/infrastructure/firestore/repositories/sales/FirestoreSalesReturnRepository.ts`:
- Path: `companies/{companyId}/sales/Data/sales_returns/{id}`

### DI + Mappers
Update DI container and SalesMappers.

---

## TASK 3B: Sales Return Use Cases

Create `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`:

### CreateSalesReturnUseCase
```
- Determine returnContext from input:
  - If salesInvoiceId provided → AFTER_INVOICE
  - If deliveryNoteId provided (no SI) → BEFORE_INVOICE
- Load source document (SI or DN)
- Pre-fill lines from source:
  - AFTER_INVOICE: map from SI lines (returnQty, unitPriceDoc, unitCostBase, tax)
  - BEFORE_INVOICE: map from DN lines (returnQty, unitCostBase)
- Load customer (Party), snapshot customerName
- Generate returnNumber
- Save SR with status='DRAFT'
```

### PostSalesReturnUseCase — IMPLEMENT EXACTLY AS ALGORITHMS.md §5

```
CRITICAL: Sales returns have TWO vouchers (Revenue reversal + COGS reversal)

═══ AFTER_INVOICE PATH ═══

Step 1: Quantity Validation
  - For each line: returnQty ≤ (siLine.invoicedQty - previously returned for this siLineId)

Step 2: Inventory Movement
  - For each line (stock items):
    Call ISalesInventoryService.processIN({
      movementType: 'RETURN_IN',
      refs: { type: 'SALES_RETURN', docId: sr.id, lineId: lineId }
    })
  - line.stockMovementId = result.id

Step 3: COGS Reversal Voucher
  Dr Inventory Account     sum(lineCostBase)     [reverse COGS]
  Cr COGS Account          sum(lineCostBase)
  sr.cogsVoucherId = voucher.id

Step 4: Revenue Reversal Voucher
  Dr Revenue Account       sum(lineTotalBase)    [reverse revenue]
  Dr Sales Tax Account     sum(taxAmountBase)    [reverse tax]
  Cr AR Account            sum(grandTotalBase)   [reverse receivable]
  sr.revenueVoucherId = voucher.id

Step 5: Update SI outstanding
  si.outstandingAmountBase -= sr.grandTotalBase
  si.paymentStatus = recalcPaymentStatus(si)
  save(si)

Step 6: Update SO (if linked)
  soLine.invoicedQty -= (if relevant)
  soLine.returnedQty += returnQty
  save(so)

═══ BEFORE_INVOICE PATH (CONTROLLED ONLY) ═══

Step 1: Quantity Validation
  - For each line: returnQty ≤ (dnLine.deliveredQty - previously returned)

Step 2: Inventory Movement
  - Same as above — RETURN_IN

Step 3: COGS Reversal Voucher
  Dr Inventory Account     sum(lineCostBase)     [reverse DN's COGS]
  Cr COGS Account          sum(lineCostBase)
  sr.cogsVoucherId = voucher.id

Step 4: NO Revenue reversal (none existed — DN has no AR)

Step 5: Update SO deliveredQty
  soLine.deliveredQty -= returnQty
  soLine.returnedQty += returnQty
  updateSOStatus(so)
  save(so)

═══ COMMON ═══
- Set sr.status = 'POSTED', sr.postedAt = now()
- Save SR
```

### ListSalesReturnsUseCase / GetSalesReturnUseCase
Standard list/get.

---

## TASK 3C: Payment Status Sync

Create `backend/src/application/sales/use-cases/PaymentSyncUseCases.ts`:

### UpdateSalesInvoicePaymentStatusUseCase
```
- Accept: companyId, siId, paidAmountBase
- Load SI, ASSERT status = 'POSTED'
- si.paidAmountBase = paidAmountBase
- si.outstandingAmountBase = si.grandTotalBase - paidAmountBase
- if outstanding ≤ 0: paymentStatus = 'PAID'
  elif paidAmount > 0: paymentStatus = 'PARTIALLY_PAID'
  else: paymentStatus = 'UNPAID'
- Save
```

---

## TASK 3D: API Endpoints

Add to `SalesController.ts`:

| Handler | Method | Path |
|---------|--------|------|
| createReturn | POST | /api/sales/returns |
| listReturns | GET | /api/sales/returns |
| getReturn | GET | /api/sales/returns/:id |
| postReturn | POST | /api/sales/returns/:id/post |
| updatePaymentStatus | POST | /api/sales/invoices/:id/payment-status |

Add DTOs: `SalesReturnDTO`, `SalesReturnLineDTO`.

---

## TASK 3E: Frontend Pages

### Sales Return List Page
Create `frontend/src/modules/sales/pages/SalesReturnsListPage.tsx`:
- Table: returnNumber, customerName, returnDate, returnContext, grandTotal, status

### Sales Return Detail Page
Create `frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx`:
- Header: return number, customer, return date, return context badge, reason
- Lines: item, return qty, unit cost
- Post button (DRAFT only)

### SI Detail — "Create Return" Button
Add to SalesInvoiceDetailPage:
- "Create Return" button (POSTED status only) → navigates to SR create pre-filled from SI

### DN Detail — "Create Return" Button
Add to DeliveryNoteDetailPage:
- "Create Return" button (POSTED, CONTROLLED mode only) → navigates to SR create pre-filled from DN

### SO Detail — Linked Documents
Update SalesOrderDetailPage:
- Show linked DNs, SIs, SRs in a related documents section

### Dashboard KPIs
Update SalesHomePage with KPIs:
- Total revenue (posted SIs), Outstanding AR, Overdue invoices, Top customers

### API Client + Routes + Sidebar
Update `salesApi.ts`:
```typescript
// Returns
createReturn(payload): Promise<SalesReturnDTO>
listReturns(opts?): Promise<SalesReturnDTO[]>
getReturn(id): Promise<SalesReturnDTO>
postReturn(id): Promise<SalesReturnDTO>

// Payment sync
updatePaymentStatus(invoiceId, payload): Promise<SalesInvoiceDTO>
```

Update routes and sidebar to include SR pages.

---

## TASK 3F: Unit Tests for Returns

Create `backend/src/tests/application/sales/SalesReturnUseCases.test.ts`:

```
11. PostSR (AFTER_INVOICE): creates RETURN_IN + Revenue reversal + COGS reversal
12. PostSR (BEFORE_INVOICE): creates RETURN_IN + COGS reversal only (no Revenue)
13. returnQty validation enforced (≤ invoiced or ≤ delivered)
14. SO line returnedQty updated
15. SI outstandingAmount adjusted on return
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

Write to `d:\DEV2026\ERP03\docs\sales\AUDIT_PHASE_3.md`:

```markdown
# Phase 3 Audit Report — Sales Returns + Integration + Polish

## Date: [YYYY-MM-DD HH:MM]

## Sales Return Posting
- [ ] AFTER_INVOICE: creates stock IN + Revenue reversal + COGS reversal
- [ ] AFTER_INVOICE: updates SI outstandingAmount
- [ ] BEFORE_INVOICE: creates stock IN + COGS reversal only (Rule S16)
- [ ] BEFORE_INVOICE: reduces SO line deliveredQty
- [ ] returnQty validation enforced
- [ ] SO line returnedQty updated
- [ ] Revenue voucher metadata: sourceModule='sales', sourceType='SALES_RETURN'
- [ ] COGS voucher metadata: sourceModule='sales', sourceType='SALES_RETURN'

## Payment Status Sync
- [ ] UpdateSalesInvoicePaymentStatusUseCase works
- [ ] paymentStatus transitions: UNPAID → PARTIALLY_PAID → PAID

## Frontend
| Page | File | Renders? |
|------|------|---------|
| SR List | SalesReturnsListPage.tsx | ✅/❌ |
| SR Detail | SalesReturnDetailPage.tsx | ✅/❌ |

- [ ] SI detail has "Create Return" button
- [ ] DN detail has "Create Return" button (CONTROLLED)
- [ ] SO detail shows linked documents
- [ ] Dashboard shows KPIs
- [ ] Sidebar shows all sales pages

## Tests
- Total: 15, Passed: [N], Failed: [N]

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
2. **Execute tasks in order: 3A → 3B → 3C → 3D → 3E → 3F.**
3. **Sales Return has TWO vouchers: Revenue reversal + COGS reversal (for AFTER_INVOICE).**
4. **BEFORE_INVOICE return creates COGS reversal ONLY — no Revenue/AR reversal.**
5. **Use RETURN_IN movement type (not RETURN_OUT — that's for purchase returns).**
6. **Use `ISalesInventoryService.processIN()` for return movements.**
7. **Payment sync is an internal API — Accounting calls it when posting receipts.**
8. **Do NOT modify any Phase 1/2 entity structures. Only ADD to controllers, routes, and pages.**
9. **Sidebar must show all sales pages in logical groups.**
10. **The audit report is NOT optional. It is a deliverable.**
