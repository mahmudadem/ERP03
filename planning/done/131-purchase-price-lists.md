# 131 - Phase F Purchase Price Lists

Date: 2026-05-28  
Branch: `codex/phase-f-vendor-groups`  
Scope: Purchases module, Phase F parity

## Summary

Purchases now has Purchase Price Lists as optional currency-specific supplier pricing agreements. This mirrors Sales Price Lists at the structural level: lists can be created, edited, deleted, and marked as currency defaults. Vendors can be assigned a default price list under Commercial Terms, and unit prices are auto-resolved dynamically when adding items or updating quantities in Purchase Orders, Purchase Invoices, and Forms Designer purchases documents.

## Technical Developer View

### What changed

- Added `PurchasePriceList` domain entity with tiered/quantity-break matching logic.
- Added `IPurchasePriceListRepository` interface and Firestore repository.
- Added use cases: `CreatePurchasePriceListUseCase`, `UpdatePurchasePriceListUseCase`, `DeletePurchasePriceListUseCase`, and `GetEffectivePurchasePriceUseCase`.
- Added Purchase master-data controller handlers and REST routes under `/tenant/purchase/price-lists`.
- Registered `IPurchasePriceListRepository` in DI container.
- Added frontend Purchases API client methods for price lists.
- Created `PurchasePriceListsPage.tsx` under purchases pages.
- Registered lazy load routes and sidebar navigation menu mappings.
- Added `Default Price List` dropdown selector to vendor Commercial Terms.
- Created `purchaseLinePriceResolver.ts` containing price resolution helper.
- Integrated pricing triggers into `GenericVoucherRenderer.tsx` (for Forms Designer purchases documents), `PurchaseOrderDetailPage.tsx`, and `PurchaseInvoiceDetailPage.tsx`.
- Added English, Arabic, and Turkish i18n locales.

### Files changed

- [PurchasePriceList.ts](file:///d:/DEV2026/ERP03/backend/src/domain/purchases/entities/PurchasePriceList.ts) [NEW]
- [IPurchasePriceListRepository.ts](file:///d:/DEV2026/ERP03/backend/src/repository/interfaces/purchases/IPurchasePriceListRepository.ts) [NEW]
- [index.ts](file:///d:/DEV2026/ERP03/backend/src/repository/interfaces/purchases/index.ts)
- [FirestorePurchasePriceListRepository.ts](file:///d:/DEV2026/ERP03/backend/src/infrastructure/firestore/repositories/purchases/FirestorePurchasePriceListRepository.ts) [NEW]
- [PurchasePriceListUseCases.ts](file:///d:/DEV2026/ERP03/backend/src/application/purchases/use-cases/PurchasePriceListUseCases.ts) [NEW]
- [PurchaseMasterDataController.ts](file:///d:/DEV2026/ERP03/backend/src/api/controllers/purchases/PurchaseMasterDataController.ts)
- [purchases.routes.ts](file:///d:/DEV2026/ERP03/backend/src/api/routes/purchases.routes.ts)
- [bindRepositories.ts](file:///d:/DEV2026/ERP03/backend/src/infrastructure/di/bindRepositories.ts)
- [PurchasePriceListUseCases.test.ts](file:///d:/DEV2026/ERP03/backend/src/tests/application/purchases/PurchasePriceListUseCases.test.ts) [NEW]
- [purchasesApi.ts](file:///d:/DEV2026/ERP03/frontend/src/api/purchasesApi.ts)
- [PurchasePriceListsPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/PurchasePriceListsPage.tsx) [NEW]
- [purchaseLinePriceResolver.ts](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/services/purchaseLinePriceResolver.ts) [NEW]
- [GenericVoucherRenderer.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx)
- [PurchaseOrderDetailPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx)
- [PurchaseInvoiceDetailPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx)
- [PartyMasterCard.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/shared/components/PartyMasterCard.tsx)
- [routes.config.ts](file:///d:/DEV2026/ERP03/frontend/src/router/routes.config.ts)
- [moduleMenuMap.ts](file:///d:/DEV2026/ERP03/frontend/src/config/moduleMenuMap.ts)
- [common.json (en)](file:///d:/DEV2026/ERP03/frontend/src/locales/en/common.json)
- [common.json (ar)](file:///d:/DEV2026/ERP03/frontend/src/locales/ar/common.json)
- [common.json (tr)](file:///d:/DEV2026/ERP03/frontend/src/locales/tr/common.json)
- [purchases.md](file:///d:/DEV2026/ERP03/docs/architecture/purchases.md)
- [README.md (user-guide)](file:///d:/DEV2026/ERP03/docs/user-guide/purchases/README.md)
- [purchase-price-lists.md](file:///d:/DEV2026/ERP03/docs/user-guide/purchases/purchase-price-lists.md) [NEW]

### Accounting and controls impact

- Unit prices automatically populate from valid price agreements but can be manually overridden at purchase entry.
- Only one default price list can exist per currency; saving a new default de-activates the previous default list for that currency.
- Deletion is audited and shielded by a standard user confirmation dialog.

## End-User View

Users can configure Purchase Price Lists under `Purchases -> Price Lists`. When entering Purchase Orders or Invoices, the unit price will auto-resolve based on the vendor, currency, item, and quantity. The vendor's default list can be selected in the vendor card's Commercial Terms.

## Verification

- `npm --prefix backend run build` passed.
- `npm --prefix frontend run typecheck` passed.
- `npm --prefix backend test -- PurchasePriceListUseCases.test.ts` passed: 18/18 tests.

## Manual QA Script

1. Open `Purchases -> Price Lists` and click `New Price List`.
2. Name it `USD Wholesale Vendor`, select currency `USD`, set as default: `Yes`.
3. Add a line: Item `Widget A`, Min Qty `10`, Unit Price `85.00`.
4. Click `Save`.
5. Create a new Purchase Order for a vendor using USD. Select `Widget A`, quantity `5`. Price should not resolve to 85.00 (min quantity is 10).
6. Change quantity to `10`. Price should auto-resolve to `85.00`.
7. Override manually to `80.00` to verify overrides work.
8. Go to vendor card, set default price list to `USD Wholesale Vendor`.
9. Verify that deletion of a price list triggers the ConfirmDialog.

## Follow-ups

- Continue Phase F parity with RFQ next.
