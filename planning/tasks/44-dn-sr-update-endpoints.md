# Task 44 — Update Endpoints for Delivery Notes and Sales Returns

**Created:** 2026-05-14  
**Branch:** `feat/phase-1a-core-bugs` (already active)  
**Priority:** Medium  
**Estimate:** 2-3 hours  
**Status:** ⏳ Pending

---

## Background

The ERP supports editing Sales Orders, Sales Invoices, Purchase Orders, GRNs, and Purchase Returns.
However, **Delivery Notes (DN)** and **Sales Returns (SR)** can only be **created**, not edited.

When a user tries to edit and save an existing DN or SR, they get a hard error:
- DN: *"Updating existing Delivery Notes is not yet supported. Please create a new one."* (`useVoucherActions.ts:843`)
- SR: *"Updating existing Sales Returns is not yet supported. Please create a new one."* (`useVoucherActions.ts:877`)

The purchases module already has a working pattern for `updateReturn` — replicate it on the sales side.

---

## ⚠️ MANDATORY FIRST STEP — Verify the Gap

**Before writing a single line of code**, confirm these gaps still exist:

### 1. Check backend routes
Open `backend/src/api/routes/sales.routes.ts` and verify:
- [ ] There is NO `router.put('/delivery-notes/:id', ...)` line
- [ ] There is NO `router.put('/returns/:id', ...)` line

### 2. Check backend controller
Open `backend/src/api/controllers/sales/SalesController.ts` and verify:
- [ ] There is NO `static async updateDN(...)` method
- [ ] There is NO `static async updateReturn(...)` method (sales version)

### 3. Check backend use cases
Open `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts` and verify:
- [ ] There is NO `updateDN` or `updateDeliveryNote` function/class

Open `backend/src/application/sales/use-cases/SalesReturnUseCases.ts` and verify:
- [ ] There is NO `updateReturn` or `updateSalesReturn` function/class

### 4. Check frontend API client
Open `frontend/src/api/salesApi.ts` and verify:
- [ ] There is NO `updateDN(id, payload)` function
- [ ] There is NO `updateReturn(id, payload)` function (sales version)

**If ANY of these already exist → STOP. Report what you found to the product owner before proceeding.**

---

## Scope — Exactly What To Build

### Backend

#### A. `DeliveryNoteUseCases.ts`
Add a new `UpdateDeliveryNoteInput` interface and `updateDeliveryNote()` use case function.

The use case must:
1. Load the existing DN from the repository by `companyId` + `id`
2. Return `ApiError.notFound('Delivery Note not found')` if not found
3. Return `ApiError.badRequest('Only DRAFT delivery notes can be edited')` if status is not `DRAFT`
4. Apply the allowed field updates (date, warehouse, notes, lines)
5. Save and return the updated DN
6. Follow the exact same pattern as `UpdateSalesOrderInput` / `updateSalesOrder()` in `SalesOrderUseCases.ts`

Input shape:
```typescript
export interface UpdateDeliveryNoteInput {
  salesOrderId?: string;
  customerId?: string;
  deliveryDate?: string;
  warehouseId?: string;
  notes?: string;
  lines: {
    lineId?: string;
    lineNo?: number;
    soLineId?: string;
    itemId: string;
    deliveredQty: number;
    uomId?: string;
    uom?: string;
    description?: string;
  }[];
}
```

#### B. `SalesReturnUseCases.ts`
Add a new `UpdateSalesReturnInput` interface and `updateSalesReturn()` use case function.

The use case must:
1. Load the existing SR from the repository by `companyId` + `id`
2. Return `ApiError.notFound('Sales Return not found')` if not found
3. Return `ApiError.badRequest('Only DRAFT sales returns can be edited')` if status is not `DRAFT`
4. Apply the allowed field updates
5. Save and return the updated SR
6. Follow the exact same pattern as `updateReturn()` in PurchaseController as reference

Input shape:
```typescript
export interface UpdateSalesReturnInput {
  returnDate?: string;
  warehouseId?: string;
  reason?: string;
  notes?: string;
  currency?: string;
  exchangeRate?: number;
  lines: {
    lineId?: string;
    lineNo?: number;
    siLineId?: string;
    dnLineId?: string;
    soLineId?: string;
    itemId: string;
    returnQty: number;
    uomId?: string;
    uom?: string;
    unitPriceDoc?: number;
    taxCodeId?: string;
    warehouseId?: string;
    description?: string;
  }[];
}
```

#### C. `SalesController.ts`
Add two new static methods:
- `static async updateDN(req, res, next)` — reads `req.params.id` + `req.body`, calls the use case, returns `res.json(result)`
- `static async updateReturn(req, res, next)` — same pattern for SR

Follow the exact pattern of `SalesController.updateSO()`.

#### D. `sales.routes.ts`
Add two new routes:
```typescript
router.put('/delivery-notes/:id', SalesController.updateDN);  // after GET /delivery-notes/:id
router.put('/returns/:id', SalesController.updateReturn);      // after GET /returns/:id
```

---

### Frontend

#### E. `frontend/src/api/salesApi.ts`
Add two new API client functions following the pattern of `updateSO(id, payload)`:
- `updateDN(id: string, payload: UpdateDNPayload): Promise<DeliveryNote>`
- `updateReturn(id: string, payload: UpdateReturnPayload): Promise<SalesReturn>`

#### F. `frontend/src/hooks/useVoucherActions.ts`
Replace the error blocks with real API calls.

**DN section (around line 841-845) — REMOVE this:**
```typescript
if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
  throw new Error('Updating existing Delivery Notes is not yet supported. Please create a new one.');
}
savedVoucher = await salesApi.createDN(dnPayload);
```

**REPLACE WITH:**
```typescript
savedVoucher = cleanPayload.id
  ? await salesApi.updateDN(cleanPayload.id, dnPayload)
  : await salesApi.createDN(dnPayload);
```

**SR section (around line 875-879) — REMOVE this:**
```typescript
if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
  throw new Error('Updating existing Sales Returns is not yet supported. Please create a new one.');
}
savedVoucher = await salesApi.createReturn(srPayload);
```

**REPLACE WITH:**
```typescript
savedVoucher = cleanPayload.id
  ? await salesApi.updateReturn(cleanPayload.id, srPayload)
  : await salesApi.createReturn(srPayload);
```

---

## Acceptance Criteria

- [ ] `PUT /tenant/sales/delivery-notes/:id` returns 200 with updated DN for a DRAFT record
- [ ] `PUT /tenant/sales/delivery-notes/:id` returns 400 if the DN is not DRAFT
- [ ] `PUT /tenant/sales/delivery-notes/:id` returns 404 if DN not found
- [ ] `PUT /tenant/sales/returns/:id` returns 200 with updated SR for a DRAFT record
- [ ] `PUT /tenant/sales/returns/:id` returns 400 if the SR is not DRAFT
- [ ] `PUT /tenant/sales/returns/:id` returns 404 if SR not found
- [ ] `salesApi.updateDN()` and `salesApi.updateReturn()` exist in frontend
- [ ] `useVoucherActions.ts` no longer has the "not yet supported" error blocks
- [ ] `backend: tsc --noEmit` passes
- [ ] `frontend: tsc --noEmit` passes
- [ ] No existing tests broken

---

## Files To Touch (6 total)

| File | Change |
|------|--------|
| `backend/src/application/sales/use-cases/DeliveryNoteUseCases.ts` | Add `UpdateDeliveryNoteInput` + `updateDeliveryNote()` |
| `backend/src/application/sales/use-cases/SalesReturnUseCases.ts` | Add `UpdateSalesReturnInput` + `updateSalesReturn()` |
| `backend/src/api/controllers/sales/SalesController.ts` | Add `updateDN()` + `updateReturn()` static methods |
| `backend/src/api/routes/sales.routes.ts` | Add `PUT /delivery-notes/:id` + `PUT /returns/:id` |
| `frontend/src/api/salesApi.ts` | Add `updateDN()` + `updateReturn()` client functions |
| `frontend/src/hooks/useVoucherActions.ts` | Replace error blocks with real update calls |

---

## Reference Files (read before coding)

1. `backend/src/application/sales/use-cases/SalesOrderUseCases.ts` — update pattern
2. `backend/src/api/controllers/purchases/PurchaseController.ts` → `updateReturn()` method
3. `backend/src/api/routes/purchases.routes.ts` — PUT route pattern
4. `frontend/src/api/salesApi.ts` → `updateSO()` — frontend client pattern
