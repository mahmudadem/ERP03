# Module Access 403 Trace Completion Report

**Date:** 2026-05-13
**Estimate:** 45-60m
**Actual:** ~55m
**Status:** Complete

## Technical Developer View

### Task
Trace why a company had modules granted from Super Admin, but tenant screens returned 403 errors and Company Admin showed no available modules.

### Root Cause
Super Admin grants module entitlements only. Tenant module visibility also requires the module registry to mark the module as implemented and ready. The onboarding seeder wrote sparse registry records, and `FirestoreModuleRegistryRepository` defaulted missing values to `lifecycleStatus='draft'` and `implementationStatus='unchecked'`. `ModuleAvailabilityService` correctly filtered those modules out, so granted modules appeared unavailable in Company Admin.

The frontend also hid one important symptom: `companyModulesApi.list()` caught all failures and returned `[]`, so a real API error could render as "No modules available."

Follow-up browser verification found the direct cause of the `SUPER_ADMIN access required` message: `platform.router` was mounted before `/tenant`, and system platform sub-routers had root-level `assertSuperAdmin` middleware. Authenticated tenant requests were passing through those platform guards before reaching `tenant.router`.

### Files Changed
- `backend/src/seeder/seedOnboardingData.ts`
- `backend/src/errors/errorHandler.ts`
- `frontend/src/api/companyModules.ts`
- `frontend/src/pages/company-admin/pages/ModulesPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `backend/src/api/server/router.ts`
- `backend/src/api/__tests__/routerOrdering.test.ts`
- `ACTIVE.md`
- `JOURNAL.md`
- `docs/architecture/module-access-403-trace.md`
- `docs/user-guide/company-admin-modules.md`

### Fix
- Seed implemented modules with `code`, `version`, `lifecycleStatus='ready'`, `runtimeStatus='available'`, and `implementationStatus='passed'`.
- Preserve API `ApiError.statusCode` in the root Express error handler.
- Stop converting company-module list errors into empty arrays.
- Show a visible Company Admin Modules load error when the API fails.
- Added i18n keys for the new error state.
- Moved `/tenant` before platform routes in the root API router.
- Added route-order regression coverage.
- Applied a targeted emulator registry update for `accounting`, `inventory`, `purchase`, `sales`, and `ai-assistant`.
- Rebuilt and restarted the Firebase emulator from a timestamped safety export.

### Verification
- `backend`: `npm test -- --runTestsByPath src/application/platform/__tests__/ModuleAvailabilityService.test.ts src/application/company-admin/use-cases/__tests__/Phase3EntitlementEnabledState.test.ts src/api/__tests__/Phase3ModuleAccess.test.ts` passed, 33/33.
- `backend`: `npm test -- --runTestsByPath src/api/__tests__/routerOrdering.test.ts src/api/__tests__/Phase3ModuleAccess.test.ts` passed.
- `frontend`: `npm run typecheck` passed.
- `backend`: `npm run typecheck` passed.
- Runtime endpoint check passed: Company Admin module tenant endpoints return 200; Super Admin system endpoint still returns 403 for tenant users.

## End-User View

Company Admin can now see a real error if the module list cannot load, instead of seeing a misleading "No modules available" message. Modules granted by Super Admin can appear for Company Admin enablement once the module is implemented and registered as ready.

If a granted module still does not appear immediately, refresh the page and restart the backend so its module availability cache reloads.

## Follow-Ups

- Confirm in the browser that Company Admin can enable Accounting and Inventory for the affected company.
- Confirm All Vouchers and Inventory Overview load after the module is enabled for the company.
