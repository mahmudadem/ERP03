# 130 - Phase F Vendor Groups

Date: 2026-05-28  
Branch: `codex/phase-f-vendor-groups`  
Scope: Purchases module, Phase F parity

## Summary

Purchases now has Vendor Groups as optional supplier segmentation master data. This mirrors Sales Customer Groups at the structural level but intentionally stays classification-only: groups can be created, edited, deleted when unused, and assigned to vendor Party records through `vendorGroupId`.

## Technical Developer View

### What changed

- Added `VendorGroup` domain entity.
- Added `IVendorGroupRepository` and Firestore implementation under the Purchases repository pattern.
- Added Vendor Group use cases for create/update/delete/get/list/assign.
- Added Purchase master-data controller and `/tenant/purchase/vendor-groups` routes.
- Added `Party.vendorGroupId` to the shared Party model and persistence mapping.
- Added vendor group validation when shared Party create/update receives `vendorGroupId`.
- Added frontend Purchases API methods for vendor groups.
- Added `VendorGroupsPage` and route/menu entry at `Purchases -> Vendor Groups`.
- Added Vendor Group selector on vendor Party commercial terms.
- Added i18n strings for English, Arabic, and Turkish.

### Files changed

- `backend/src/domain/purchases/entities/VendorGroup.ts`
- `backend/src/repository/interfaces/purchases/IVendorGroupRepository.ts`
- `backend/src/repository/interfaces/purchases/index.ts`
- `backend/src/infrastructure/firestore/repositories/purchases/FirestoreVendorGroupRepository.ts`
- `backend/src/application/purchases/use-cases/VendorGroupUseCases.ts`
- `backend/src/api/controllers/purchases/PurchaseMasterDataController.ts`
- `backend/src/api/routes/purchases.routes.ts`
- `backend/src/domain/shared/entities/Party.ts`
- `backend/src/application/shared/use-cases/PartyUseCases.ts`
- `backend/src/api/controllers/shared/SharedController.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/infrastructure/prisma/repositories/shared/PrismaPartyRepository.ts`
- `backend/prisma/schema.prisma`
- `backend/src/tests/application/purchases/VendorGroupUseCases.test.ts`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/api/sharedApi.ts`
- `frontend/src/modules/purchases/pages/VendorGroupsPage.tsx`
- `frontend/src/modules/shared/components/PartyMasterCard.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/config/moduleMenuMap.ts`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/purchases.md`
- `docs/user-guide/purchases/README.md`
- `docs/user-guide/purchases/vendor-groups.md`

### Accounting and controls impact

- No posting behavior changes.
- No AP, tax, inventory valuation, payment status, or voucher amount changes.
- Vendor group assignment is stored on the vendor Party record for future filtering/reporting.
- Inactive groups cannot be assigned.
- Groups cannot be deleted while vendors still reference them.

## End-User View

Users can create Vendor Groups from `Purchases -> Vendor Groups`, then assign vendors to a group from the vendor card. This helps organize suppliers, especially when a company has many vendors. The feature is classification-only and does not change accounting results.

## Verification

- `npm --prefix backend run build` passed.
- `npm --prefix frontend run typecheck` passed.
- `npm --prefix backend test -- VendorGroupUseCases.test.ts` passed: 6/6 tests.

## Manual QA Script

Pre-req: logged in as a user with Purchases access.

1. Open `Purchases -> Vendor Groups`.
2. Create `Local Suppliers`.
3. Confirm the group appears in the list.
4. Edit the description/status and save.
5. Open `Purchases -> Vendors` and open a vendor.
6. On `Commercial Terms`, assign the vendor to `Local Suppliers` and save.
7. Reopen the vendor and confirm the group persists.
8. Try deleting `Local Suppliers` while the vendor still references it.
9. Expected: deletion is blocked.
10. Clear the group from the vendor and save.
11. Delete `Local Suppliers`.
12. Expected: deletion succeeds.

## Follow-ups

- Continue Phase F parity with Purchase Price Lists next, then RFQ.
- Future reports can add vendor-group filters now that `Party.vendorGroupId` exists.
