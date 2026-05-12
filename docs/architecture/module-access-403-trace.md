# Module Access 403 Trace

**Date:** 2026-05-13

## Summary

Tenant module access is not based on Super Admin entitlements alone. The runtime path combines company enablement records, Super Admin entitlements, and global module availability from the module registry.

## Access Flow

1. Super Admin grants or revokes module entitlement.
2. Company Admin sees entitled modules only if `ModuleAvailabilityService` classifies them as available.
3. Company Admin enables a module for the company, creating or updating a company module record.
4. Tenant requests pass through tenant context and module guards.

## Root Cause

`seedOnboardingData.ts` seeded `system_metadata/modules/items/*` with sparse data. Missing registry fields defaulted to:

- `lifecycleStatus='draft'`
- `runtimeStatus='available'`
- `implementationStatus='unchecked'`
- `version='1.0.0'`

`ModuleAvailabilityService` treats draft or unchecked modules as unavailable. This made modules look granted in Super Admin but unavailable to Company Admin and tenant pages.

A second routing issue caused the exact `Forbidden: SUPER_ADMIN access required` response on tenant pages. The root API router mounted `platformRouter` before `/tenant`. Some platform system routers include root-level `authMiddleware` and `assertSuperAdmin`, so authenticated `/tenant/...` requests were intercepted before tenant routing.

## Fix

Implemented modules are now seeded as:

- `code=<moduleId>`
- `version='1.0.0'`
- `lifecycleStatus='ready'`
- `runtimeStatus='available'`
- `implementationStatus='passed'`
- `dependencies=[]`

The root Express error handler also now recognizes `backend/src/api/errors/ApiError`, preserving intended HTTP status codes like 403.

The frontend company module API no longer returns `[]` on failure, so access bugs remain visible.

The root API router now mounts `/tenant` before platform routes. A regression test covers this ordering with a mocked root-mounted platform guard.

## Operational Note

Existing emulator data must be updated or reseeded after this fix. A targeted update was applied locally for `accounting`, `inventory`, `purchase`, `sales`, and `ai-assistant`.
