# Completion Report — Epic 240 Phase 4: Periodic posting mode

**Date:** 2026-06-18 · **Branch:** `codex/240d-periodic-posting-mode` · **Spec:** [tasks/240d](../tasks/240d-phase4-periodic-posting-mode.md) · **Epic:** [240](../tasks/240-simple-periodic-mode-and-item-costing-epic.md)

## Technical developer view

### What changed

`PERIODIC` is now a real `InventoryAccountingMode` instead of a legacy alias for `INVOICE_DRIVEN`.

- **Mode plumbing**
  - `InventorySettings` now accepts `PERIODIC` directly and preserves legacy `inventoryAccountingMethod = PERIODIC` as `accountingMode = PERIODIC`.
  - `DocumentPolicyResolver` now branches all inventory document behavior across three distinct modes: `PERIODIC`, `INVOICE_DRIVEN`, `PERPETUAL`.
  - Inventory DTOs / validators / frontend API types / onboarding summaries now expose `PERIODIC` as a real mode.

- **Posting behavior**
  - **Purchase Invoice** in `PERIODIC`: Dr Purchases / Cr AP (+ tax), with quantity receipt only if no GRN already moved the goods.
  - **Sales Invoice** in `PERIODIC`: Dr AR / Cr Sales (+ tax), with quantity issue only if no DN already moved the goods.
  - **Purchase Return** in `PERIODIC`: Dr AP / Cr Purchase Returns.
  - **Sales Return** in `PERIODIC`: Dr Sales Returns / Cr AR.
  - **Goods Receipt / Delivery Note** in `PERIODIC`: quantity only, no GL.
  - **Stock Adjustment** in `PERIODIC`: quantity only, no GL voucher.
  - **Opening Stock** in `PERIODIC`: Dr Goods / Opening Inventory / Cr Opening Balance Equity, using the inventory-settings asset account rather than item-specific asset routing.

- **Settings / COA / starter**
  - Added periodic-only settings defaults for:
    - `defaultPurchaseReturnAccountId`
    - `defaultPurchaseDiscountAccountId`
    - `defaultSalesReturnAccountId`
  - Added hardcoded COA template `periodic_trading`.
  - Updated `SimpleTradingCompanyInitializer` to use:
    - `coaTemplate = periodic_trading`
    - `inventory.accountingMode = PERIODIC`
    - linked periodic return / discount accounts
  - Sidebar wiring now marks SO / DN / PO / GRN as hidden-by-default for simple companies through `moduleMenuMap.ts` + recursive filtering in `useSidebarConfig.ts`.

### Files changed

- Backend mode/policy core:
  - `backend/src/domain/inventory/entities/InventorySettings.ts`
  - `backend/src/application/common/services/DocumentPolicyResolver.ts`
  - `backend/src/application/inventory/use-cases/ConfigureInventoryFinancialIntegrationUseCase.ts`
  - `backend/src/application/inventory/use-cases/InitializeInventoryUseCase.ts`
- Backend posting:
  - `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
  - `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`
  - `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
  - `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
  - `backend/src/application/inventory/use-cases/StockAdjustmentUseCases.ts`
  - `backend/src/application/inventory/use-cases/OpeningStockDocumentUseCases.ts`
- Settings / starter / COA:
  - `backend/src/domain/purchases/entities/PurchaseSettings.ts`
  - `backend/src/domain/sales/entities/SalesSettings.ts`
  - DTO / validator / use-case wiring under `backend/src/api/**`, `backend/src/application/**`
  - `backend/src/application/accounting/templates/COATemplates.ts`
  - `backend/src/seeder/seedSystemMetadata.ts`
  - `backend/src/application/onboarding/use-cases/SimpleTradingCompanyInitializer.ts`
- Frontend:
  - `frontend/src/api/inventoryApi.ts`
  - `frontend/src/api/purchasesApi.ts`
  - `frontend/src/api/salesApi.ts`
  - `frontend/src/utils/documentPolicy.ts`
  - `frontend/src/modules/inventory/wizards/InventoryInitializationWizard.tsx`
  - `frontend/src/modules/purchases/wizards/PurchaseInitializationWizard.tsx`
  - `frontend/src/modules/sales/wizards/SalesInitializationWizard.tsx`
  - `frontend/src/modules/onboarding/api/onboardingApi.ts`
  - `frontend/src/config/moduleMenuMap.ts`
  - `frontend/src/hooks/useSidebarConfig.ts`

### Tests added / updated

- Policy and mode normalization:
  - `backend/src/application/common/services/__tests__/DocumentPolicyResolver.test.ts`
  - `backend/src/tests/domain/inventory/InventorySettings.test.ts`
  - `backend/src/tests/application/inventory/ConfigureInventoryFinancialIntegrationUseCase.test.ts`
- Posting behavior:
  - `backend/src/tests/application/purchases/PurchasePostingUseCases.test.ts`
  - `backend/src/tests/application/purchases/PurchaseReturnUseCases.test.ts`
  - `backend/src/tests/application/sales/SalesPostingUseCases.test.ts`
  - `backend/src/tests/application/sales/SalesReturnUseCases.test.ts`
  - `backend/src/tests/application/inventory/OpeningStockDocumentUseCases.test.ts`
  - `backend/src/tests/application/inventory/StockAdjustmentGLValuation.test.ts`
- Starter:
  - `backend/src/application/onboarding/use-cases/__tests__/SimpleTradingCompanyInitializer.test.ts`

### Verification

- Targeted periodic/mode suites: **10 suites, 121 tests passed**
- Full backend suite: **159 suites passed, 2 skipped; 1,444 tests passed, 18 skipped**
- Backend compiled build: `npm --prefix backend run build` ✅
- Frontend production build: `npm --prefix frontend run build` ✅
- Root `npm run build`: **not available in this repo**. Root `package.json` exposes `build:web` and `build:api`, not `build`.

### Sample periodic vouchers

Periodic Purchase Invoice sample:

```text
PI-0001
Dr Purchases                 500.00
Cr Accounts Payable          500.00
```

What must NOT exist on that voucher:

```text
Inventory Asset              0.00 lines
GRNI                         0.00 lines
COGS                         0.00 lines
```

Periodic Sales Invoice sample:

```text
SI-0001
Dr Accounts Receivable       300.00
Cr Sales                     300.00
```

What must NOT exist on that voucher:

```text
Inventory Asset              0.00 lines
COGS                         0.00 lines
```

## End-user view

ERP03 can now run a company in **Periodic inventory accounting mode**.

- Your Purchase Invoices post to **Purchases**, not to the Inventory asset account.
- Your Sales Invoices post to **Sales**, not to COGS / Inventory.
- Stock quantities still go up and down correctly, so warehouse control keeps working.
- Sales Returns and Purchase Returns use their own contra accounts.
- If you use the **Simple Trading Company** starter, ERP03 now chooses the Periodic Trading chart of accounts automatically and hides the extra operational stock documents by default.

This is aimed at simpler trading companies that want clean day-to-day books without full perpetual inventory accounting on every sale and purchase.

## QA script

1. Create a fresh company with the **Simple Trading Company** starter.
2. Confirm the policy summary shows `Inventory accounting mode = Periodic` and `COA template = periodic_trading`.
3. Post a direct Purchase Invoice for a tracked item with no GRN.
   Expected:
   - stock quantity increases
   - voucher = Dr Purchases / Cr AP (+ tax if used)
   - no Inventory / GRNI line
4. Post a Goods Receipt first, then post the linked Purchase Invoice.
   Expected:
   - GRN owns the quantity move
   - PI does not create a second stock receipt
   - PI still posts Dr Purchases / Cr AP
5. Post a direct Sales Invoice for a tracked item with no DN.
   Expected:
   - stock quantity decreases
   - voucher = Dr AR / Cr Sales (+ tax if used)
   - no COGS / Inventory voucher
6. Post a Delivery Note first, then post the linked Sales Invoice.
   Expected:
   - DN owns the quantity move
   - SI does not issue stock again
   - SI still posts only the revenue voucher
7. Post a Purchase Return and Sales Return.
   Expected:
   - Purchase Return uses Purchase Returns
   - Sales Return uses Sales Returns
   - neither posts Inventory / COGS lines
8. Post Opening Stock with accounting effect enabled.
   Expected:
   - Dr Goods / Opening Inventory
   - Cr Opening Balance Equity
9. Open the sidebar on the starter company.
   Expected:
   - Sales Orders, Delivery Notes, Purchase Orders, and Goods Receipts are hidden by default.

## Remaining follow-up

- Phase 5: report-time inventory valuation / Trading Account
- Phase 6: mode-lock / migration wizard / COA hardening
- Phase 7: fresh-tenant golden-path QA for periodic mode
