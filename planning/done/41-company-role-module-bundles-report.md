# Company Role Module Bundle Derivation — Completion Report

**Date:** 2026-04-27  
**Status:** Done

## What Changed
- Added backend role module derivation from permission IDs.
- Company Admin role creation now persists:
  - `permissions`
  - `explicitPermissions`
  - `resolvedPermissions`
  - derived `moduleBundles`
- Company Admin role update now recomputes those fields when permissions change.
- Metadata-only role updates preserve existing permission/module access metadata.
- Added regression tests for Accounting permission-derived module access.

## Files Changed
- `backend/src/application/company-admin/services/RoleModuleBundleDeriver.ts`
- `backend/src/application/company-admin/use-cases/CreateCompanyRoleUseCase.ts`
- `backend/src/application/company-admin/use-cases/UpdateCompanyRoleUseCase.ts`
- `backend/src/application/company-admin/use-cases/__tests__/CompanyRoleModuleBundles.test.ts`

## Tested
- `npm test -- CompanyRoleModuleBundles`
- `npm test -- Phase3ModuleAccess`
- `npm run build` in `backend/`
- `npm run build` in `frontend/`

## Acceptance Criteria Met
- A new custom role with `accounting.*` permissions now saves `moduleBundles: ['accounting']`.
- A re-saved existing custom role gets the same derived module access.
- Deep permissions are available through `resolvedPermissions`, so route entry and API checks use the same selected permissions.
- No data backfill was performed.

## Known Follow-Ups
- Manually verify the full browser flow with a newly created non-owner Accounting role.
- Later consolidate or retire the separate legacy Settings/RBAC role path.
