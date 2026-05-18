# Phase 0 Audit Report — Shared Services (Party + TaxCode)

## Date: 2026-04-01 09:17

## Task 0A: Domain Entities
| Entity | File | Lines | Fields match SCHEMAS.md? |
|--------|------|-------|------------------------|
| Party | domain/shared/entities/Party.ts | 1-130 | ✅ |
| TaxCode | domain/shared/entities/TaxCode.ts | 1-101 | ✅ |

- [x] Party validates roles array not empty
- [x] TaxCode validates EXEMPT/ZERO_RATED rate = 0
- [x] Both have toJSON() and fromJSON()

## Task 0B: Repositories
| File | Collection Path | Methods |
|------|----------------|---------|
| FirestorePartyRepository.ts | companies/{cid}/shared/Data/parties/{id} | create, update, getById, getByCode, list, delete |
| FirestoreTaxCodeRepository.ts | companies/{cid}/shared/Data/tax_codes/{id} | create, update, getById, getByCode, list |

- [x] DI container updated
- [x] Date ↔ Timestamp conversion works

## Task 0C: Use Cases
- [x] CreatePartyUseCase: code uniqueness validated
- [x] CreateTaxCodeUseCase: rate consistency validated
- [x] ListTaxCodesUseCase: scope filtering (PURCHASE returns PURCHASE + BOTH)

## Task 0D: API
| Method | Path | Status |
|--------|------|--------|
| POST | /api/shared/parties | ✅ |
| GET | /api/shared/parties | ✅ |
| GET | /api/shared/parties/:id | ✅ |
| PUT | /api/shared/parties/:id | ✅ |
| POST | /api/shared/tax-codes | ✅ |
| GET | /api/shared/tax-codes | ✅ |
| GET | /api/shared/tax-codes/:id | ✅ |
| PUT | /api/shared/tax-codes/:id | ✅ |

## Task 0E: Item Extension
- [x] defaultPurchaseTaxCodeId added to Item entity
- [x] defaultSalesTaxCodeId added to Item entity
- [x] DTOs updated
- [x] ItemDetailPage has tax code dropdowns

## Task 0F: Frontend
| Page | File | Renders? |
|------|------|---------|
| Vendors List | VendorsListPage.tsx | ✅ |
| Vendor Detail | VendorDetailPage.tsx | ✅ |
| Tax Codes | TaxCodesPage.tsx | ✅ |

- [x] Routes registered
- [x] sharedApi.ts created with all endpoints

## Compile & Build
- Backend tsc: PASS
- Frontend build: PASS

## Deviations from Spec
- Shared endpoints are mounted under `/tenant/shared/*` (platform routing convention) instead of direct `/api/shared/*`.
- Shared routes were registered in `tenant.router.ts` as tenant-scoped routes (not module-registry mounted) to avoid `companyModuleGuard` blocking a non-module shared service.
- Vendor creation is implemented as a route-based form (`/purchases/vendors/new`) triggered by the “Add Vendor” button.
