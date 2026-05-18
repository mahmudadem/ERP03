# Phase 3 — Purchase Returns + Integration + Polish — Execution Prompt

> **Work non-stop until all tasks are complete.**

## Context
Phases 0, 1, and 2 are complete and audited. The following already exist:
- Shared: Party, TaxCode entities + CRUD + API + frontend pages
- PurchaseSettings, PurchaseOrder + CRUD + status machine
- GoodsReceipt + posting (inventory movement, no GL)
- PurchaseInvoice + posting (GL voucher + conditional inventory)
- SIMPLE and CONTROLLED mode validation
- All frontend pages for PO, GRN, PI

**Read these spec docs first:**
1. `d:\DEV2026\ERP03\docs\purchases\MASTER_PLAN.md` — Rules R15, R17, R18, Purchase Return workflows
2. `d:\DEV2026\ERP03\docs\purchases\SCHEMAS.md` — PurchaseReturn (§P5)
3. `d:\DEV2026\ERP03\docs\purchases\ALGORITHMS.md` — PostPurchaseReturn (§4), updateInvoicePaymentStatus (§7)
4. `d:\DEV2026\ERP03\docs\purchases\PHASES.md` — Phase 3 section

**DB-agnostic rule:** Domain entities and use cases must have ZERO imports from `firebase-admin`.

---

## TASK 3A: Purchase Return Entity + Repository

### Domain Entity
Create `backend/src/domain/purchases/entities/PurchaseReturn.ts`:
- Use `PurchaseReturnProps` and `PurchaseReturnLine` from SCHEMAS.md §P5.
- Validate: `vendorId` required, `returnContext` must be `'AFTER_INVOICE'` or `'BEFORE_INVOICE'`, `lines` not empty, each `returnQty > 0`.
- Export `ReturnContext`, `PRStatus` types.
- `voucherId` and `stockMovementId` are null until posting.

### Repository
Create `backend/src/repository/interfaces/purchases/IPurchaseReturnRepository.ts`:
- Methods: `create`, `update`, `getById`, `list(companyId, opts: { vendorId?, purchaseInvoiceId?, goodsReceiptId?, status? })`

Create `backend/src/infrastructure/firestore/repositories/purchases/FirestorePurchaseReturnRepository.ts`:
- Path: `companies/{companyId}/purchases/Data/purchase_returns/{id}`

Update DI container.

---

## TASK 3B: Purchase Return Posting Use Case (CRITICAL)

Create `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`:

### CreatePurchaseReturnUseCase
```
- Determine returnContext:
  - If purchaseInvoiceId is provided → AFTER_INVOICE
  - If only goodsReceiptId is provided + no PI → BEFORE_INVOICE
- BEFORE_INVOICE: ASSERT procurementControlMode === 'CONTROLLED'
  (SIMPLE mode has no standalone GRN before invoice)
- Pre-fill lines from source document:
  - AFTER_INVOICE: from PI lines (snapshot item, unit cost, tax)
  - BEFORE_INVOICE: from GRN lines (snapshot item, unit cost)
- Generate returnNumber
- Save with status='DRAFT'
```

### PostPurchaseReturnUseCase — IMPLEMENT EXACTLY AS ALGORITHMS.md §4

```
CRITICAL: Two completely different paths based on returnContext

═══ AFTER_INVOICE PATH ═══
Step 1: Quantity Validation
  - For each line: returnQty ≤ (piLine.invoicedQty - previously returned for this piLine)
  - Use getPreviouslyReturnedQtyForPILine() — query PR lines referencing same piLineId

Step 2: Inventory Reversal (if stock item)
  - Call IPurchasesInventoryService.processOUT({
      movementType: 'RETURN_OUT',
      refs: { type: 'PURCHASE_RETURN', docId: pr.id, lineId: line.lineId,
              reversesMovementId: findOriginalMovementId(line) },
    })
  - Set line.stockMovementId

Step 3: GL Voucher Lines
  - Cr Inventory/Expense account (line.accountId × returnQty × unitCostBase)
  - Cr Tax account (tax reversal)
  - Dr AP account (pr.grandTotalBase)

Step 4: Create Accounting Voucher
  - sourceModule='purchases', sourceType='PURCHASE_RETURN', sourceId=pr.id

Step 5: Update PI outstanding
  - pi.outstandingAmountBase -= pr.grandTotalBase
  - Recalculate paymentStatus

Step 6: Update PO returnedQty (if linked)

═══ BEFORE_INVOICE PATH ═══
Step 1: Quantity Validation
  - For each line: returnQty ≤ (grnLine.receivedQty - previously returned for this grnLine)

Step 2: Inventory Reversal (if stock item)
  - Same processOUT call as above

Step 3: NO GL entries (Rule R18 — no AP existed)
Step 4: NO voucher creation

Step 5: Update PO receivedQty (reduce by returnQty)
Step 6: Update PO returnedQty

═══ COMMON ═══
- Set pr.status = 'POSTED', pr.postedAt = now()
- Save PR
- If PO: update PO status, save PO
```

---

## TASK 3C: Payment Status Sync

Create or add to `backend/src/application/purchases/use-cases/PaymentSyncUseCases.ts`:

### UpdateInvoicePaymentStatusUseCase
```
- Called by Accounting module when a payment voucher is posted referencing a PI
- Input: invoiceId, paymentAmountBase
- Load PI, ASSERT status === 'POSTED'
- pi.paidAmountBase += paymentAmountBase
- pi.outstandingAmountBase = pi.grandTotalBase - pi.paidAmountBase
- Recalculate paymentStatus:
  - if outstandingAmountBase <= 0 → 'PAID'
  - else if paidAmountBase > 0 → 'PARTIALLY_PAID'
  - else → 'UNPAID'
- Save PI
```

### API Endpoint
```
POST /api/purchases/invoices/:id/payment-update   → updatePaymentStatus
```
(This is an internal API called by Accounting, not by users directly)

---

## TASK 3D: API Endpoints for Returns

Add to controller:

| Handler | Method | Path |
|---------|--------|------|
| createReturn | POST | /api/purchases/returns |
| listReturns | GET | /api/purchases/returns |
| getReturn | GET | /api/purchases/returns/:id |
| postReturn | POST | /api/purchases/returns/:id/post |

Add DTOs: `PurchaseReturnDTO`, `PurchaseReturnLineDTO`.

---

## TASK 3E: Frontend — Return Pages + Polish

### Purchase Return List Page
Create `frontend/src/modules/purchases/pages/PurchaseReturnsListPage.tsx`:
- Table: returnNumber, vendorName, returnDate, returnContext, grandTotal, status

### Purchase Return Detail Page
Create `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx`:
- Header: return number, vendor, return date, return context badge, reason
- Lines: item, return qty, unit cost
- Post button (DRAFT only)

### PI Detail — "Create Return" Button
Update PI detail page:
- Add "Create Return" button (visible when PI is POSTED)
- Navigates to Return create page pre-filled from PI

### GRN Detail — "Create Return" Button (CONTROLLED only)
Update GRN detail page:
- Add "Create Return" button (visible when GRN is POSTED and no PI exists for these lines yet)
- Context: BEFORE_INVOICE

### PO Detail — Document Links
Update PO detail page to show related documents:
- Linked GRNs list
- Linked PIs list
- Linked PRs list
- Each with link to detail page

### Purchase Dashboard
Update Purchase Home Page / Dashboard:
- KPIs: Open POs count, Pending GRNs, Unpaid Invoices, Overdue Invoices (dueDate < today)
- Recent activity feed

### Sidebar — Final
Update `frontend/src/config/moduleMenuMap.ts`:
```
Purchases module:
  - Vendors
  - Purchase Orders
  - Operations:
    - Goods Receipts
    - Purchase Invoices
    - Purchase Returns
  - Settings
```

### API Client
Update `frontend/src/api/purchasesApi.ts`:
```typescript
// Returns
createReturn(payload): Promise<PurchaseReturnDTO>
listReturns(opts?): Promise<PurchaseReturnDTO[]>
getReturn(id): Promise<PurchaseReturnDTO>
postReturn(id): Promise<PurchaseReturnDTO>

// Payment sync (for "Create Payment" button)
updatePaymentStatus(invoiceId, payload): Promise<PurchaseInvoiceDTO>
```

---

## TASK 3F: Unit Tests for Returns

Create or update `backend/src/tests/application/purchases/PurchaseReturnUseCases.test.ts`:

**Required test cases (minimum 5):**

```
1. AFTER_INVOICE return: creates PURCHASE_RETURN OUT movement + GL voucher (Dr AP, Cr Inventory)
2. BEFORE_INVOICE return: creates PURCHASE_RETURN OUT movement, NO GL voucher
3. BEFORE_INVOICE return: reduces PO line receivedQty
4. Return qty > invoiced qty → blocks posting
5. Return qty > received qty (before invoice) → blocks posting
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

Write to `d:\DEV2026\ERP03\docs\purchases\AUDIT_PHASE_3.md`:

```markdown
# Phase 3 Audit Report — Purchase Returns + Integration + Polish

## Date: [YYYY-MM-DD HH:MM]

## Purchase Return Posting
- [ ] AFTER_INVOICE: creates stock OUT + GL voucher (Dr AP, Cr Inventory/Expense)
- [ ] AFTER_INVOICE: updates PI outstandingAmount and paymentStatus
- [ ] BEFORE_INVOICE: creates stock OUT only, NO GL (Rule R18)
- [ ] BEFORE_INVOICE: reduces PO line receivedQty
- [ ] returnQty validation enforced (≤ invoiced or ≤ received)
- [ ] PO line returnedQty updated
- [ ] Voucher metadata: sourceModule='purchases', sourceType='PURCHASE_RETURN'

## Payment Status Sync
- [ ] UpdateInvoicePaymentStatusUseCase works
- [ ] paymentStatus transitions: UNPAID → PARTIALLY_PAID → PAID
- [ ] outstandingAmountBase computed correctly

## Frontend
| Page | File | Renders? |
|------|------|---------|
| PR List | PurchaseReturnsListPage.tsx | ✅/❌ |
| PR Detail | PurchaseReturnDetailPage.tsx | ✅/❌ |

- [ ] PI detail has "Create Return" button
- [ ] GRN detail has "Create Return" button (CONTROLLED)
- [ ] PO detail shows linked documents (GRNs, PIs, PRs)
- [ ] Dashboard shows KPIs
- [ ] Sidebar shows all purchase pages

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
2. **Execute tasks in order: 3A → 3B → 3C → 3D → 3E → 3F.**
3. **Task 3B (Purchase Return posting) has TWO completely different paths. Implement BOTH.**
4. **BEFORE_INVOICE returns produce NO GL entries. This is Rule R18.**
5. **AFTER_INVOICE returns produce GL entries reversing the original PI posting. Rule R17.**
6. **Use `IPurchasesInventoryService.processOUT()` for return movements. Set `reversesMovementId`.**
7. **Payment sync is an internal API — Accounting calls it when posting payments.**
8. **Do NOT modify any Phase 0/1/2 entity structures. Only ADD to controllers, routes, and pages.**
9. **Sidebar must show all purchase pages in logical groups.**
10. **The audit report is NOT optional. It is a deliverable.**
