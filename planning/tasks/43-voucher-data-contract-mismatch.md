# Task 43: Voucher Data Contract Mismatch (Data Contract Alignment)

## Description
There is a critical inconsistency (data contract mismatch) between the frontend forms (Voucher Types / Forms) and what the backend expects when saving, cloning, or posting vouchers. 

## Technical Audit Findings
- **Backend Domain/DTOs:** Expect semantic field names for quantities:
    - Sales Order: `orderedQty`
    - Sales Invoice: `invoicedQty`
    - Delivery Note: `deliveredQty`
    - Purchase Order: `orderedQty`
    - Purchase Invoice: `invoicedQty`
    - Goods Receipt: `receivedQty`
    - Sales/Purchase Returns: `returnQty`
- **System Seeder (`seedSystemVoucherTypes.ts`):** Uses generic `quantity` or `qty` for several modules (Purchase Order, Purchase Invoice, etc.), leading to payload validation failures.
- **Dynamic Renderer (`GenericVoucherRenderer.tsx`):** Contains normalization logic that maps `qty` to `quantity`, but doesn't always handle the semantic variants consistently during data extraction.

## Backend Contract Mapping (Reference)

| Voucher Type | Header Fields | Line Field (Qty) | Mandatory Line Fields |
| :--- | :--- | :--- | :--- |
| **Sales Order** | `customerId`, `orderDate`, `currency`, `exchangeRate` | `orderedQty` | `itemId`, `unitPriceDoc`, `uom` |
| **Sales Invoice** | `customerId`, `invoiceDate`, `currency`, `exchangeRate` | `invoicedQty` | `itemId`, `unitPriceDoc`, `uom` |
| **Delivery Note** | `customerId`, `deliveryDate`, `warehouseId` | `deliveredQty` | `itemId`, `uom`, `soLineId` (opt) |
| **Sales Return** | `customerId`, `returnDate`, `warehouseId`, `reason` | `returnQty` | `itemId`, `uom`, `siLineId` (opt) |
| **Purchase Order** | `vendorId`, `orderDate`, `currency`, `exchangeRate` | `orderedQty` | `itemId`, `unitPriceDoc`, `uom` |
| **Purchase Invoice** | `vendorId`, `invoiceDate`, `currency`, `exchangeRate` | `invoicedQty` | `itemId`, `unitPriceDoc`, `uom`, `accountId` |
| **Goods Receipt** | `vendorId`, `receiptDate`, `warehouseId` | `receivedQty` | `itemId`, `uom`, `poLineId` (opt) |
| **Purchase Return** | `vendorId`, `returnDate`, `warehouseId`, `reason` | `returnQty` | `itemId`, `uom`, `piLineId` (opt) |

> [!IMPORTANT]
> **Purchase Invoice `accountId`:** The backend requires a valid GL `accountId` on every line of a Purchase Invoice. If the form designer uses a generic `account` field, the renderer MUST map it to `accountId` in the final payload.


## Required Actions

### 1. Synchronize Seeder (Backend)
**File:** `backend/src/seeder/seedSystemVoucherTypes.ts`
Update the `fieldId` in `tableColumns` and `layout.lineFields` for the following voucher types:
- **Purchase Order:** Change `quantity` -> `orderedQty`.
- **Purchase Invoice:** Change `quantity` -> `invoicedQty`.
- **Sales Order:** Ensure it uses `orderedQty` (Audit required).
- **Sales Invoice:** Ensure it uses `invoicedQty` (Currently correct, but verify consistency).
- **Delivery Note:** Change `quantity` -> `deliveredQty` if applicable.

### 2. Update Dynamic Renderer (Frontend)
**File:** `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
- Refine `normalizeTableColumnId` to ensure it doesn't override correct semantic IDs.
- Ensure `getLineQuantity` and other "getter" helpers correctly prioritize the semantic field names defined in the seeder.

### 3. Verify Hardcoded Pages
**File:** `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` (and similar)
- Verify `buildLinePayload` correctly maps form state to DTO fields.

### 4. Database Sync
- After updating the seeder, the user must go to **Tools > Forms Designer** and click **"Restore System Defaults"** for the affected vouchers to update their active company configuration.

## Verification Plan
1. **Purchase Invoice:** Create a new PI in "Windows Mode", save it, and verify the payload contains `invoicedQty`.
2. **Sales Order -> Invoice:** Verify that `orderedQty` is correctly handled.
3. **Tests:** Run `backend/src/use-cases/sales/SalesPostingUseCases.test.ts` to ensure backend validation still passes with the aligned contract.

## Time Estimate
- **Audit & Seeder Update:** 15 mins
- **Renderer Refinement:** 20 mins
- **Manual Verification:** 15 mins
- **Total:** ~50 mins
