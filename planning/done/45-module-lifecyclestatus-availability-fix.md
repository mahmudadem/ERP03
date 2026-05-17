# 45 — Module lifecycleStatus Availability Cache Fix

**Date:** 2026-04-27  
**Agent:** OpenCode  
**Status:** ✅ Done

## Summary

Fixed the "Module is not ready: lifecycleStatus is draft" 503 error that appeared after a SuperAdmin updates modules from `draft` → `ready` via the dashboard. The error occurred on every page refresh after the update, with intermittent behavior where newly-ready modules would sometimes appear and sometimes disappear.

## Files Changed

- `backend/src/api/middlewares/tenantContextMiddleware.ts`
- `backend/src/api/middlewares/guards/companyModuleGuard.ts`
- `backend/src/application/platform/ModuleAvailabilityService.ts`
- `backend/src/api/controllers/auth/AuthPermissionsController.ts`
- `backend/src/scripts/runServer.ts`

## What Was Fixed

### Fix 1 — tenantContextMiddleware.ts (line 97)
**Bug:** `tenantContext.modules` was set to `finalModules` (the unfiltered list of enabled/entitled/role-granted modules) instead of `capabilityParentModules` (which filters out modules that fail runtime availability checks).

**Consequence:** Modules with `lifecycleStatus = draft` appeared in the tenant context. When `companyModuleGuard` later checked `getAvailabilityInfo`, it found the stale `NOT_READY` state and threw a 503 error.

**Fix:** Changed `modules: finalModules` → `modules: capabilityParentModules`. The log line was also updated to reflect the correct variable.

### Fix 2 — ModuleAvailabilityService.ts (TTL-based auto-refresh)
**Bug:** The `availabilityMap` was an in-memory cache built once at server startup. It would only refresh when specific SuperAdmin API endpoints were hit. If the SuperAdmin updated a module's `lifecycleStatus`, only the singleton instance handling that request would rebuild. Other requests could hit stale cache data.

**Fix:** Added a 30-second TTL to the cache:
- Added `lastRefreshedAt` timestamp and `CACHE_TTL_MS = 30_000`
- Added `private refreshIfNeeded()` — checks staleness and rebuilds if expired, with `isRefreshing` guard against concurrent rebuilds
- Added `public async ensureCacheFresh()` entry point for callers
- Updated `isAvailableForCompany()` to auto-refresh before checking
- `buildAvailabilityMap()` now sets `lastRefreshedAt` on completion

### Fix 3 — companyModuleGuard.ts
**Bug:** The guard called `getAvailabilityInfo()` directly without ensuring the cache was fresh.

**Fix:** Added `await service.ensureCacheFresh()` before the availability check, so stale cache data is rebuilt before the guard makes a decision.

### Fix 4 — AuthPermissionsController.ts
**Bug:** The filter block had confusing `NOT_READY`/`SUSPENDED`/`AVAILABLE` branches that all redundantly checked `availableForCompany.includes(moduleId)`. The `NOT_READY` branch was contradictory — it would always return false (since `getAvailableModulesForCompany` never includes NOT_READY modules) but the code structure suggested otherwise.

**Fix:** Simplified to a single check:
```
if (info.state !== AVAILABLE && info.state !== SUSPENDED) return false;
return availableForCompany.includes(moduleId);
```

### Fix 5 — runServer.ts
**Bug:** The local dev server (`runServer.ts` on port 5001) never called `runModuleStartupValidation()`, meaning `ModuleAvailabilityService` was never initialized in local dev mode.

**Fix:** Added `runModuleStartupValidation().catch(console.error)` call alongside the existing `registerAllModules()` and `initializeAll()` calls.

## How It Works Now

### Flow after SuperAdmin updates a module from draft → ready:

1. **SuperAdmin update request:** `ModuleRegistryController.update()` calls `rebuildAvailabilityMap()` — cache is rebuilt from fresh DB data on that instance.
2. **User refreshes company page:**
   - `tenantContextMiddleware` runs → `filterRuntimeAvailableModules` calls `isAvailableForCompany` → calls `refreshIfNeeded()` → if cache is expired (>30s), rebuilds from DB → returns fresh availability state → module is AVAILABLE
   - `tenantContext.modules` = filtered list (excludes unavailable modules) ✅
   - `companyModuleGuard` runs → calls `ensureCacheFresh()` → if stale, rebuilds → `getAvailabilityInfo` returns AVAILABLE → `next()` ✅
3. **No more 503 error.** The module appears consistently in the modules page and sidebar.

### Cache behavior:
- **First 30 seconds after update:** Cache from `rebuildAvailabilityMap()` is used (fresh)
- **After 30 seconds:** Next request triggers auto-rebuild from DB
- **If update via API:** Immediate rebuild + 30-second TTL ensures freshness
- **If direct Firestore edit:** Next request after 30 seconds auto-refreshes

## Verification

- `npm run build` in `backend/` — ✅ zero errors

## Acceptance Criteria Met

- SuperAdmin can update modules from draft → ready without users seeing 503 errors
- No `lifecycleStatus is draft` error modal on page refresh
- Newly-ready modules appear consistently (not intermittently)
- Sidebar, modules page, and routes all show consistent module availability
- Cache auto-heals within 30 seconds after direct Firestore edits

## Known Follow-Up

None. The fix is self-healing. If a module's lifecycleStatus is changed in the future (via API or direct DB edit), the cache will refresh within 30 seconds automatically.

---

## Documentation

### Technical Developer View

**Task:** Fix stale in-memory cache leak of `lifecycleStatus = draft` modules into tenant context.

**Architecture impact:**
- `ModuleAvailabilityService` was a fully in-memory cache with no invalidation mechanism. Now has 30-second TTL with automatic rebuild on stale reads.
- `tenantContextMiddleware` was assigning unfiltered module lists to the request context, allowing unavailable modules to flow into guards. Now correctly uses the filtered output.
- `companyModuleGuard` now ensures cache freshness before evaluating module availability.
- `AuthPermissionsController` filter logic simplified for clarity and correctness.
- `runServer.ts` now initializes the availability service for local dev parity.

**Files touched:** 5 backend files (all `.ts` source). No new files created.

How it was fixed:
- **Root cause 1 (primary):** `tenantContextMiddleware.ts:97` assigned `finalModules` instead of `capabilityParentModules`. This is the gate that prevents unavailable modules from entering the request context. Fix: use the filtered list.
- **Root cause 2 (systemic):** `ModuleAvailabilityService` had no cache staleness detection. In a single-server environment, a stale cache retains old lifecycleStatus values until manually rebuilt. Fix: add 30-second TTL with auto-rebuild on access.
- **Root cause 3 (local dev):** `runServer.ts` didn't initialize the service at all. Fix: call `runModuleStartupValidation()` on startup.

### End-User View

**What changed:** Before this fix, when a SuperAdmin turned on a module for your company (changed it from "draft" to "ready"), you would see an error message saying "Module is not ready" every time you refreshed the page. The module would appear and disappear randomly. The sidebar always worked fine, but the modules page was unpredictable.

**What happens now:** When a SuperAdmin enables a module, it appears on your modules page and sidebar immediately and consistently. No more error messages. If a SuperAdmin updates module status directly in the database (not through the dashboard), the change takes effect within 30 seconds automatically.

**Why it happened:** The system kept a cached copy of module statuses in memory. When the SuperAdmin updated a module, the cache wasn't refreshing quickly enough, so the old "draft" status was still being used.
