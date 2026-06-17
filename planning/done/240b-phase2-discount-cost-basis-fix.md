# Task 240b — Phase 2 discount cost-basis fix

**Date:** 2026-06-18  
**Status:** Complete on branch `codex/240b-discount-cost-basis-fix`  
**Time spent:** ~2.2h

## Summary

Closed the purchase-invoice discount cost-basis mismatch for the two perpetual modes only:
- `INVOICE_DRIVEN`
- `PERPETUAL`

The fix is intentionally narrow. Purchase Invoice stock receipts now capitalize tracked stock at the **net discounted line total**, so:
- stock movement cost
- resulting moving average
- Inventory GL debit

all use the same basis.

No changes were made to:
- `PERIODIC`
- AP/AR math
- tax math
- voucher balancing logic outside the stock-cost basis

## Files changed

- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts`
- `docs/architecture/inventory.md`
- `planning/tasks/223-inventory-revaluation-value-only-correction.md`
- `planning/JOURNAL.md`
- `planning/ACTIVE.md`
- `planning/done/240b-phase2-discount-cost-basis-fix.md`
- `planning/tasks/240-simple-periodic-mode-and-item-costing-epic.md`
- `planning/tasks/240b-phase2-discount-cost-basis-fix.md`

## Technical developer view

### Root cause

`PurchaseInvoiceUseCases.ts` posted the Inventory GL side from discounted line totals (`line.lineTotalBase` / `line.lineTotalDoc`) but the direct PI stock receipt path still valued stock from the gross unit price (`line.unitPriceBase`). That made every voucher balance while leaving stock value higher than the Inventory GL by the discount amount.

### Implementation

In the direct tracked-item PI receipt path:
- `unitCostBase` is now `roundMoney(line.lineTotalBase / qtyInBaseUom)`
- `totalCostBase` is now `line.lineTotalBase`
- `unitCostCCY` is now `roundMoney(line.lineTotalDoc / qtyInBaseUom)`
- `totalCostCCY` is now `line.lineTotalDoc`
- the moving-average blend uses the same net discounted unit cost
- the in-memory `StockLevel` average/last-cost fields are updated before persistence so the written level matches the receipt valuation immediately

The GRN-backed perpetual flow was rechecked and remains correct:
- GRN owns the stock receipt
- PI clears GRNI at the discounted net amount
- PI does not create a second stock receipt

### Regression coverage added

`PurchasePostingUseCases.test.ts` now covers:
- invoice-driven direct PI with a 5% line discount: stock movement cost, stock level average, and Inventory GL debit all tie at 475
- perpetual GRN→PI discounted flow: no second receipt is posted and the PI debit stays on GRNI at the net amount

## End-user view

Purchase Invoices with line discounts no longer inflate stock value in perpetual inventory modes. If a user buys 50 units at a discounted invoice total, stock value and the accounting entry now use that same discounted amount, so the Inventory GL reconciliation report no longer shows a drift caused only by the discount.

## QA script

### Automated

```powershell
cd D:\DEV2026\ERP03\backend
npm test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts
npm test -- --runInBand src/tests/application/purchases src/tests/application/inventory
npm run build
```

### Real round-trip on compiled backend (`lib/`)

1. Start Firebase emulators for `auth`, `firestore`, and `functions`.
2. Use a fresh throwaway tenant.
3. Create company and initialize Accounting.
4. Initialize Inventory in `INVOICE_DRIVEN`.
5. Initialize Purchases with direct invoicing enabled.
6. Create one tracked item and one vendor.
7. Create a Purchase Invoice for 50 units at 10.00 with a 5% line discount.
8. Post the invoice.
9. Check stock level and Inventory GL reconciliation.

### Expected result

- Posted PI subtotal / grand total: `475.00`
- Stock level:
  - qty on hand: `50`
  - avg cost base: `9.50`
  - last cost base: `9.50`
- Reconciliation:
  - stock value: `475.00`
  - Inventory GL balance: `475.00`
  - drift: `0.00`

## Verification results

- `npm test -- --runInBand src/tests/application/purchases/PurchasePostingUseCases.test.ts` ✅
  - 18/18 tests passed
- `npm test -- --runInBand src/tests/application/purchases src/tests/application/inventory` ✅
  - 19 suites passed
  - 128 tests passed
- `npm run build` ✅
- Emulator round-trip on compiled backend (`lib/`) ✅
  - posted PI subtotal/grand total base = `475`
  - stock level qty = `50`
  - stock avg cost base = `9.5`
  - Inventory GL reconciliation drift = `0`

## Acceptance

- GP05 step-4 style Inventory-vs-GL reconciliation drift for this scenario is `0` ✅
- Voucher balancing unchanged ✅
- AP/AR/tax math unchanged ✅
- `PERIODIC` untouched ✅

## Follow-up

- [Task 223](../tasks/223-inventory-revaluation-value-only-correction.md) remains backlog for **value-only correction** scenarios. Task 240b closed the discount cost-basis mismatch only; it did not add a manual inventory revaluation document.
