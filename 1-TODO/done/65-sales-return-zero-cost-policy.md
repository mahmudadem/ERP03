# Completion Report: Sales Return Zero-Cost Policy & Standalone Returns (Task 65)

## Technical Developer View
**Objective:** Enable standalone (DIRECT) sales returns in "Invoice-Driven" accounting mode and enforce strict zero-cost blocking in "Perpetual" mode to maintain stock ledger integrity.
**Files Touched:**
- `backend/src/domain/sales/entities/SalesReturn.ts`
- `backend/src/application/common/services/DocumentPolicyResolver.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- `backend/src/api/dtos/SalesDTOs.ts`
- `backend/src/tests/application/sales/SalesReturnUseCases.test.ts`
- `backend/src/seeder/seedSystemVoucherTypes.ts`
- `frontend/src/api/salesApi.ts` (verified)

**Implementation Details:**
1. **ReturnContext Expansion:** Added `DIRECT` to the `ReturnContext` enum in the entity and DTO layers, allowing returns to be created without a source document link.
2. **Accounting Mode Policy:** Added `shouldRequirePositiveCostOnReturn(accountingMode)` in `DocumentPolicyResolver` to enforce that zero-cost returns are blocked in `PERPETUAL` mode (which requires strict unit costs for moving averages) but allowed in `INVOICE_DRIVEN` mode.
3. **Standalone Use Case Logic:** Updated `CreateSalesReturnUseCase` to accept standalone DTO inputs, allowing direct item selection, manual price entry, and warehouse selection without source document inheritance.
4. **Mode-Aware Settlement:** Updated `PostSalesReturnUseCase` to evaluate the inventory accounting mode. If a zero-cost return is posted in `INVOICE_DRIVEN` mode, the `costSettled` flag on the stock movement is correctly set to `false`, deferring cost assignment to the periodic cost settlement process. Removed illegal OUT-only settlement flags (`unsettledQty`, `unsettledCostBasis`) from the IN movement payload, adhering to the strict `StockMovement` entity constructor rules.
5. **Seeder Verification:** Fixed a syntax issue in the system voucher seeder for the `sales_invoice_service` template that was causing the build to fail.
6. **Testing:** Updated `SalesReturnUseCases.test.ts` to correctly mock the `PERIODIC` inventory setting for the invoice-driven test cases, ensuring the test correctly covers the zero-cost allowance path.

## End-User View
**What changed?**
You can now create standalone "Direct" Sales Returns. This is useful when a customer returns an item but you cannot find or do not want to link it to the original sales invoice. 

**How does it work?**
When you create a direct return, you manually select the items, quantities, and prices being refunded. 
Behind the scenes, the system protects your inventory valuation based on your accounting settings:
- If you use **Perpetual Inventory**, the system will enforce that a known cost exists for the item being returned so your real-time profitability remains accurate. 
- If you use **Invoice-Driven (Periodic) Inventory**, the system will accept the return even if the cost is unknown, allowing you to process the refund immediately. The system will flag this transaction so your accountant can settle the correct cost at month-end.
