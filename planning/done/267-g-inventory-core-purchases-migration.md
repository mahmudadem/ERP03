# Task 267-G — Inventory core ownership completion (Purchases)

## Technical Developer View

**What the task was:**
To prevent source modules from bypassing inventory core logic and to centralize stock movement creation, `new StockMovement` and `StockLevel.createNew` calls in the Purchases module needed to be routed through `IInventoryCore` (similar to FUP-4 for Sales). This was part of the System Core Engine Management Plan.

**What was changed:**
- **InventoryIntegrationContracts:** Added `computeStockReceiptInMovement` to handle inbound purchases behavior-preservingly, alongside `createStockLevel` and `cloneStockLevel` helpers. Extended `ComputeStockOutMovementInput` to take `reversesMovementId`.
- **GoodsReceiptUseCases:** Replaced direct `new StockMovement` and `StockLevel.createNew` with delegates from `IInventoryCore`.
- **PurchaseInvoiceUseCases:** Replaced direct `new StockMovement` and `StockLevel.createNew` with delegates from `IInventoryCore`.
- **PurchaseReturnUseCases:** Replaced direct `new StockMovement` and `StockLevel.createNew` with `computeStockOutMovement` and `createStockLevel` from `IInventoryCore`.
- **SystemCoreBoundaries.test.ts:** Added an architecture guard to ensure `StockMovement` and `StockLevel` objects are not directly constructed in the `application/purchases` namespace.

**What was tested:**
All backend tests passed, notably:
- `GoodsReceiptGoldenVoucher.test.ts`
- `PurchaseInvoiceGoldenVoucher.test.ts`
- `PurchaseReturnGoldenVoucher.test.ts`
- `SystemCoreBoundaries.test.ts`

This confirms that the refactor is purely architectural and perfectly preserves existing movement construction and accounting paths.

## End-User View

**Feature Explanation:**
This update streamlines how the inventory engine handles stock records and computations coming from the Purchases side (like receiving goods, recording invoices, and returning purchases). It centralizes the logic in one "core engine" to ensure stability and accuracy in your stock values, preventing any module from incorrectly creating unmonitored stock records. Your purchase transactions will continue to seamlessly update your stock quantities and values as they did before, with greater structural safety under the hood.
