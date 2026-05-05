# Task 65: Sales Return — Zero-Cost Fix + DIRECT Return Context

**Priority:** 🔴 Critical (broken user workflow)  
**Estimate:** 3.5h  
**Prerequisite reads:** Expert review discussed with product owner on 2026-05-05

> **AGENT INSTRUCTION: DO NOT update ACTIVE.md, JOURNAL.md, or ROADMAP.md.** The product owner will audit and update those files manually.

---

## Problem Statement

1. **Sales Return requires positive inventory cost unconditionally** — but Sales Invoice allows zero cost in INVOICE_DRIVEN mode. The return is stricter than the sale.
2. **Sales Return requires a source link** (SI or DN) — but in Simplified mode, accountants need free-form standalone returns with no source document.
3. The `ReturnContext` type only has `AFTER_INVOICE | BEFORE_INVOICE` — no `DIRECT` context for standalone returns.
4. **Sales Return line input and seeder template are incomplete** — missing `unitPriceDoc`, `lineTotal`, `siLineId`, `dnLineId` fields. Without `unitPriceDoc`, revenue reversal has no amount. Real-world returns (e.g. 3 of 10 invoice items) need these fields.

## Architecture Decision (Pre-Approved by Product Owner)

- **INVOICE_DRIVEN mode:** allow zero-cost returns, mark movement as unsettled. Allow standalone returns with no source link.
- **PERPETUAL mode:** require positive cost. Require source link.
- **When source invoice exists:** inherit its cost (even if zero).
- The `costSettled`, `unsettledQty`, `unsettledCostBasis` fields already exist in `StockMovement` entity and are used in `PostSalesInvoiceUseCase` (see line ~712-714 of SalesInvoiceUseCases.ts for the pattern).

---

## Layer 1: Entity — SalesReturn.ts

**File:** `backend/src/domain/sales/entities/SalesReturn.ts`

1. **Line 2** — Expand `ReturnContext`:
   - FROM: `export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE';`
   - TO: `export type ReturnContext = 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT';`

2. **Line 65** — Update `RETURN_CONTEXTS` array:
   - FROM: `const RETURN_CONTEXTS: ReturnContext[] = ['AFTER_INVOICE', 'BEFORE_INVOICE'];`
   - TO: `const RETURN_CONTEXTS: ReturnContext[] = ['AFTER_INVOICE', 'BEFORE_INVOICE', 'DIRECT'];`

---

## Layer 2: Policy — DocumentPolicyResolver.ts

**File:** `backend/src/application/common/services/DocumentPolicyResolver.ts`

1. **Update `shouldSalesReturnReverseInventoryAccounting` signature** (line 65-71) to accept `'DIRECT'`:
```typescript
static shouldSalesReturnReverseInventoryAccounting(
    mode: SupportedAccountingMode,
    returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT'
): boolean {
    if (mode === 'PERPETUAL') return true;
    return returnContext === 'AFTER_INVOICE' || returnContext === 'DIRECT';
}
```

2. **Add new method** after `shouldSalesReturnReverseInventoryAccounting`:
```typescript
static shouldRequirePositiveCostOnReturn(
    mode: SupportedAccountingMode
): boolean {
    return mode === 'PERPETUAL';
}
```

---

## Layer 3: Input DTOs + CreateSalesReturnUseCase

**File:** `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`

### 3a. Expand `SalesReturnLineInput` (line 41-52)

The DTO is missing pricing and linking fields. The frontend can't send `unitPriceDoc` or source line IDs:

```typescript
// BEFORE:
export interface SalesReturnLineInput {
    lineId?: string;
    lineNo?: number;
    siLineId?: string;
    dnLineId?: string;
    soLineId?: string;
    itemId?: string;
    returnQty?: number;
    uomId?: string;
    uom?: string;
    description?: string;
}

// AFTER:
export interface SalesReturnLineInput {
    lineId?: string;
    lineNo?: number;
    siLineId?: string;
    dnLineId?: string;
    soLineId?: string;
    itemId?: string;
    returnQty?: number;
    uomId?: string;
    uom?: string;
    unitPriceDoc?: number;    // Selling price — needed for revenue reversal
    taxCodeId?: string;       // Tax code for the return line
    warehouseId?: string;     // Per-line warehouse override
    description?: string;
}
```

### 3b. Add `customerId` and `customerName` to `CreateSalesReturnInput` (line 54-65)

```typescript
export interface CreateSalesReturnInput {
    companyId: string;
    salesInvoiceId?: string;
    deliveryNoteId?: string;
    salesOrderId?: string;
    customerId?: string;      // Required for DIRECT returns
    customerName?: string;    // Required for DIRECT returns
    returnDate: string;
    warehouseId?: string;
    reason: string;
    notes?: string;
    lines?: SalesReturnLineInput[];
    createdBy: string;
}
```

### 3c. `determineReturnContext` (line 85-89)
Remove the throw. Change to:
```typescript
const determineReturnContext = (input: CreateSalesReturnInput): ReturnContext => {
    if (input.salesInvoiceId) return 'AFTER_INVOICE';
    if (input.deliveryNoteId) return 'BEFORE_INVOICE';
    return 'DIRECT';
};
```

### 3d. `CreateSalesReturnUseCase.execute()` (line 169-246)

Restructure the source document fetching to handle three branches:

```typescript
async execute(input: CreateSalesReturnInput): Promise<SalesReturn> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Sales module is not initialized');

    const returnContext = determineReturnContext(input);
    
    // BEFORE_INVOICE requires SO workflow
    if (returnContext === 'BEFORE_INVOICE' && !settings.requireSOForStockItems) {
        throw new Error('BEFORE_INVOICE returns require "Require Sales Orders for Stock Items" to be enabled.');
    }

    let salesInvoice: SalesInvoice | null = null;
    let deliveryNote: DeliveryNote | null = null;
    let lines: SalesReturnLine[];

    if (returnContext === 'AFTER_INVOICE') {
        // ... existing SI fetch + validation (unchanged)
        lines = this.prefillLinesFromSalesInvoice(salesInvoice!, input.lines);
    } else if (returnContext === 'BEFORE_INVOICE') {
        // ... existing DN fetch + validation (unchanged)
        lines = this.prefillLinesFromDeliveryNote(deliveryNote!, input.lines);
    } else {
        // DIRECT: standalone return
        if (!input.lines?.length) {
            throw new Error('Standalone returns require at least one line with item details');
        }
        if (!input.warehouseId && !settings.defaultWarehouseId) {
            throw new Error('warehouseId is required for standalone returns');
        }
        lines = input.lines.map((inputLine, index) => ({
            lineId: inputLine.lineId || randomUUID(),
            lineNo: inputLine.lineNo ?? index + 1,
            itemId: inputLine.itemId || '',
            itemCode: '',
            itemName: '',
            returnQty: inputLine.returnQty || 0,
            uomId: inputLine.uomId,
            uom: inputLine.uom || 'EA',
            unitPriceDoc: inputLine.unitPriceDoc ?? 0,
            unitPriceBase: inputLine.unitPriceDoc ?? 0, // will be FX-adjusted at posting
            unitCostBase: 0,
            fxRateMovToBase: 1,
            fxRateCCYToBase: 1,
            taxCodeId: inputLine.taxCodeId,
            taxRate: 0,
            taxAmountDoc: 0,
            taxAmountBase: 0,
            stockMovementId: null,
            description: inputLine.description,
        }));
    }

    // ... rest of constructor + save (unchanged)
}
```

Also update `mapSalesInvoiceLineToReturnLine` (line 296-334) to accept `unitPriceDoc` from input override:
```typescript
// line 304: allow input override
const unitPriceDoc = inputLine?.unitPriceDoc ?? salesInvoiceLine.unitPriceDoc;
```

---

## Layer 4: PostSalesReturnUseCase (CRITICAL)

**File:** `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`

### 4a. Add DIRECT branch to source validation (after line 404)

```typescript
const isAfterInvoice = salesReturn.returnContext === 'AFTER_INVOICE';
const isBeforeInvoice = salesReturn.returnContext === 'BEFORE_INVOICE';
const isDirect = salesReturn.returnContext === 'DIRECT';

if (isAfterInvoice) {
    // existing SI validation (unchanged)
} else if (isBeforeInvoice) {
    // existing DN/SO validation
    // Remove the requireSOForStockItems check here (line 405-407) — it belongs in Create only
} else if (isDirect) {
    if (accountingMode === 'PERPETUAL') {
        throw new Error('Standalone returns require a source document in Real-Time Costing mode');
    }
}
```

### 4b. Phase 1D — handle DIRECT lines (inside the loop starting line 515)

Add a third branch for `isDirect` after the `isAfterInvoice` and `BEFORE_INVOICE` blocks:

```typescript
if (isAfterInvoice) {
    // ... existing SI line matching (unchanged)
} else if (isBeforeInvoice) {
    // ... existing DN line matching (unchanged)
} else {
    // DIRECT: no source line to match
    // Item must exist
    if (!item) throw new Error(`Item not found: ${line.itemId}`);
    line.itemCode = line.itemCode || item.code;
    line.itemName = line.itemName || item.name;
    line.uomId = line.uomId || item.salesUomId || item.baseUomId;
    line.uom = line.uom || item.salesUom || item.baseUom;
    // unitCostBase will be resolved from stock level below
}
```

Skip the return-qty-vs-source validation for DIRECT (the `currentRunQtyBySource` tracking doesn't apply).

### 4c. Replace `assertPositiveTrackedCost` call (line 621-626)

```typescript
// BEFORE (line 621-626):
this.assertPositiveTrackedCost(
    qtyInBaseUom, unitCostBase,
    line.itemName || item.name,
    `sales return ${salesReturn.returnNumber}`
);

// AFTER:
if (DocumentPolicyResolver.shouldRequirePositiveCostOnReturn(accountingMode)) {
    this.assertPositiveTrackedCost(
        qtyInBaseUom, unitCostBase,
        line.itemName || item.name,
        `sales return ${salesReturn.returnNumber}`
    );
}
```

### 4d. Fix `costSettled` flag (line 678)

```typescript
// BEFORE:
costSettled: true,

// AFTER:
costSettled: unitCostBase > 0,
unsettledQty: unitCostBase > 0 ? 0 : qtyInBaseUom,
unsettledCostBasis: unitCostBase > 0 ? undefined : 'MISSING',
```

### 4e. Update `resolveReturnUnitCostBase` (line 979-987)

Add optional `sourceLineCost` parameter:

```typescript
private resolveReturnUnitCostBase(
    currentCostBase: number | undefined,
    level: StockLevel,
    sourceLineCost?: number
): number {
    // Source line cost takes priority (inherit from original document, even if zero)
    if (sourceLineCost !== undefined && sourceLineCost !== null) {
        return roundMoney(sourceLineCost);
    }
    const current = roundMoney(currentCostBase || 0);
    if (current > 0) return current;
    const avg = roundMoney(level.avgCostBase || 0);
    if (avg > 0) return avg;
    return roundMoney(level.lastCostBase || 0);
}
```

Update the call site (line 618) to pass source cost:
```typescript
const sourceLineCost = isAfterInvoice && salesInvoice
    ? findSILine(salesInvoice, line.siLineId, line.itemId)?.unitCostBase
    : isBeforeInvoice && deliveryNote
    ? findDNLine(deliveryNote, line.dnLineId, line.itemId)?.unitCostBase
    : undefined;

const unitCostBase = roundMoney(
    this.resolveReturnUnitCostBase(line.unitCostBase, level, sourceLineCost)
);
```

### 4f. Revenue reversal for DIRECT returns (line 844)

Change condition to include DIRECT:
```typescript
// BEFORE:
if (shouldPostAccounting && isAfterInvoice) {

// AFTER:
if (shouldPostAccounting && (isAfterInvoice || isDirect)) {
```

Guard the SI outstanding amount update (line 884-888) so it only runs for AFTER_INVOICE:
```typescript
if (isAfterInvoice && salesInvoice) {
    const invoice = salesInvoice as SalesInvoice;
    invoice.outstandingAmountBase = roundMoney(invoice.outstandingAmountBase - salesReturn.grandTotalBase);
    invoice.paymentStatus = recalcPaymentStatus(invoice);
    invoice.updatedAt = new Date();
    await this.salesInvoiceRepo.update(invoice, transaction);
}
```

For DIRECT returns, the revenue reversal should still use the customer's AR account (already resolved above).

### 4g. AR account for DIRECT returns

The `resolveARAccount` call (line 767) uses `customer` which is already fetched. For DIRECT returns, the customer comes from `salesReturn.customerId` which is already loaded on line 439. **No change needed.**

---

## Layer 5: Tests

**File:** `backend/src/tests/application/sales/SalesReturnUseCases.test.ts`

### 5a. Modify Test 18 (line 729-790)

Change the inventory settings to PERPETUAL explicitly and keep the assertion:
```typescript
it('18) PERPETUAL: zero cost blocks posting', async () => {
    // Change: ensure inventorySettingsRepo returns PERPETUAL
    // Keep: await expect(...).rejects.toThrow('Missing positive inventory cost');
});
```

### 5b. Add new tests after test 19:

**Test 20: INVOICE_DRIVEN mode allows zero-cost return:**
- Source SI has `unitCostBase: 0`, stock level all zeros
- `inventorySettingsRepo` returns `PERIODIC` (maps to INVOICE_DRIVEN)
- Expect: `posted.status === 'POSTED'`
- Expect: movement `costSettled === false`

**Test 21: DIRECT standalone return posts in INVOICE_DRIVEN mode:**
- Return with `returnContext: 'DIRECT'`, no `salesInvoiceId`/`deliveryNoteId`
- `inventorySettingsRepo` returns `PERIODIC`
- Expect: `posted.status === 'POSTED'`
- Expect: revenue reversal voucher created

**Test 22: DIRECT standalone return blocked in PERPETUAL mode:**
- Return with `returnContext: 'DIRECT'`
- `inventorySettingsRepo` returns `PERPETUAL`
- Expect: `rejects.toThrow('Standalone returns require a source document')`

Helper needed: `makeDirectReturn()`:
```typescript
const makeDirectReturn = (): SalesReturn =>
    new SalesReturn({
        id: 'sr-3',
        companyId: COMPANY_ID,
        returnNumber: 'SR-00003',
        customerId: 'cus-1',
        customerName: 'Customer One',
        returnContext: 'DIRECT',
        returnDate: '2026-02-15',
        warehouseId: 'wh-1',
        currency: 'USD',
        exchangeRate: 1,
        lines: [{
            lineId: 'sr-line-3', lineNo: 1,
            itemId: 'item-1', itemCode: 'IT-1', itemName: 'Stock Item',
            returnQty: 10, uom: 'EA',
            unitPriceDoc: 10, unitPriceBase: 10,
            unitCostBase: 0,
            fxRateMovToBase: 1, fxRateCCYToBase: 1,
            taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0,
            stockMovementId: null,
        }],
        subtotalDoc: 100, taxTotalDoc: 0, grandTotalDoc: 100,
        subtotalBase: 100, taxTotalBase: 0, grandTotalBase: 100,
        reason: 'Customer return',
        status: 'DRAFT',
        revenueVoucherId: null, cogsVoucherId: null,
        createdBy: USER_ID,
        createdAt: nowDate(), updatedAt: nowDate(),
    });
```

---

## Layer 6: Seeder — seedSystemVoucherTypes.ts (FIX REQUIRED)

**File:** `backend/src/seeder/seedSystemVoucherTypes.ts`

The current `sales_return` template (lines 500-546) is **incomplete**. It's missing pricing columns that users need to fill in.

### Current (broken):
```
tableColumns: [
    itemId, warehouseId, returnQty, uom, taxCodeId, description
]
```

### Required (fixed):
```typescript
tableColumns: [
    { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
    { fieldId: 'siLineId', label: 'Invoice Line', type: 'TEXT', width: '130px' },
    { fieldId: 'dnLineId', label: 'DN Line', type: 'TEXT', width: '130px' },
    { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
    { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
    { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
    { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
    { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
    { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
    { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
],
```

### Also update `layout.lineFields` to match:
```typescript
lineFields: fieldsFromColumns([
    { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
    { fieldId: 'siLineId', label: 'Invoice Line', type: 'TEXT' },
    { fieldId: 'dnLineId', label: 'DN Line', type: 'TEXT' },
    { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
    { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
    { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
    { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
    { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
    { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
    { fieldId: 'description', label: 'Description', type: 'TEXT' },
]),
```

**After updating the seeder file, run the seeder** to update existing templates:
```bash
cd backend && npx ts-node src/seeder/runSeeders.ts
```

---

## Layer 7: Frontend Verification & Fixes

### Files to check and fix if blocking:

1. **`frontend/src/hooks/useVoucherActions.ts`** — Verify `sales_return` save payload:
   - Does NOT throw when `salesInvoiceId` and `deliveryNoteId` are both missing
   - DOES include `unitPriceDoc` from line items in the payload
   - DOES include `customerId` from header in the payload

2. **`frontend/src/modules/accounting/document-runtime/sales/SalesDocumentProfiles.ts`** — Verify no mandatory check on source fields.

3. **`frontend/src/modules/tools/pages/DynamicDocumentPage.tsx`** — Verify:
   - Sales return list/detail routing works with DIRECT context
   - The `lineTotal` calculated field works (returnQty × unitPriceDoc)

4. **`frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`** — Verify the `lineTotal` column renders correctly for sales_return (should compute `returnQty * unitPriceDoc`).

---

## Verification Commands

```bash
cd backend && npm run build
cd frontend && npm run build
cd backend && npm test -- --runTestsByPath src/tests/application/sales/SalesReturnUseCases.test.ts
```

## Execution Checklist

| # | Task | Est. |
|---|---|---|
| 1 | Entity: expand ReturnContext to include DIRECT | 5 min |
| 2 | Policy: add `shouldRequirePositiveCostOnReturn`, update type signature | 10 min |
| 3 | DTO: expand `SalesReturnLineInput` + `CreateSalesReturnInput` | 10 min |
| 4 | CreateSalesReturnUseCase: allow DIRECT context, map lines with prices | 25 min |
| 5 | PostSalesReturnUseCase: mode-aware cost check, DIRECT branch, costSettled logic | 40 min |
| 6 | PostSalesReturnUseCase: resolveReturnUnitCostBase with source inheritance | 15 min |
| 7 | PostSalesReturnUseCase: revenue reversal for DIRECT, guard SI update | 10 min |
| 8 | **Seeder: fix sales_return template (add unitPriceDoc, lineTotal, siLineId, dnLineId)** | 15 min |
| 9 | Tests: split test 18, add tests 20-22 | 30 min |
| 10 | Frontend: verify useVoucherActions, GenericVoucherRenderer for SR fields | 15 min |
| 11 | `npm run build` backend + frontend | 5 min |
| 12 | `npm test` targeted sales return tests | 5 min |
| 13 | Run seeder to update templates | 5 min |
| **Total** | | **~3.5h** |

## Acceptance Criteria

- [ ] Standalone Sales Return (no SI/DN link) posts in INVOICE_DRIVEN mode
- [ ] Standalone Sales Return blocked in PERPETUAL mode with clear error
- [ ] Linked return (AFTER_INVOICE) with zero-cost source SI posts with `costSettled: false`
- [ ] Linked return with positive cost posts with `costSettled: true` (no regression)
- [ ] PERPETUAL mode still blocks zero-cost returns
- [ ] Revenue reversal voucher created for DIRECT returns
- [ ] Stock movement has `unsettledCostBasis: 'MISSING'` when cost is zero
- [ ] SR form shows `unitPriceDoc`, `lineTotal`, `siLineId`, `dnLineId` columns
- [ ] SR form allows saving without source invoice/DN selected (DIRECT mode)
- [ ] Partial return from 10-item invoice works (select 3 lines only)
- [ ] Backend build: zero errors
- [ ] Frontend build: zero errors
- [ ] All sales return tests pass (existing + new)
- [ ] Seeder run updates existing sales_return template
