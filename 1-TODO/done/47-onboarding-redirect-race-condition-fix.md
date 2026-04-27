# Completion Report: Onboarding Redirect Race Condition Fix

**Date:** 2026-04-28
**Task:** Fix intermittent redirect to `/onboarding/plan` after backend rebuild/refresh
**Agent:** OpenCode (CTO mode)

---

## Problem

After rebuilding the backend and refreshing the browser, users were sometimes redirected to `/onboarding/plan` even though they had already completed onboarding and had an active company.

### Root Cause

The `RequireOnboarding` guard makes an API call to `getOnboardingStatus()` on every page load. When the backend is still starting up (connection refused, 502, or timeout), the API call fails. The error handler treated **any non-401 error** as "user needs onboarding" and redirected to `/onboarding/plan`:

```tsx
// BEFORE — too aggressive
if (err.response?.status !== 401) {
  setStatusError(true); // triggers redirect to /onboarding/plan
}
```

This was a timing issue: fast refreshes during backend startup hit the redirect, while slower refreshes (after backend was ready) worked normally.

## What Changed

### `frontend/src/components/auth/RequireOnboarding.tsx`

1. **Added retry logic with exponential backoff** — 3 retries with delays of 1.5s, 3s, 4.5s for network errors (connection refused, 500+, timeout)
2. **Added `backendConnecting` state** — shows "Connecting to server..." message during retries instead of a blank spinner
3. **Separated network errors from auth errors** — 401 errors immediately stop retrying (let auth guard handle it)
4. **Only redirects to `/onboarding/plan` after all retries are exhausted** — not on the first failure

### Key Changes

| Before | After |
|--------|-------|
| Single API call | Up to 3 retries with backoff |
| Any error → redirect | Network errors retried, only final failure redirects |
| Generic spinner | "Connecting to server..." message during retries |
| `checkStatus()` | `checkStatusWithRetry()` with loop |

## Files Changed

- `frontend/src/components/auth/RequireOnboarding.tsx` — Added retry logic, connecting state, and improved error classification

## What Was Tested

- TypeScript compilation: `npx tsc --noEmit` — zero errors
- Manual reproduction not possible (timing-dependent), but logic verified through code review

## Acceptance Criteria

- [x] No more immediate redirects to `/onboarding/plan` on transient backend errors
- [x] User sees "Connecting to server..." during retries instead of being bounced
- [x] TypeScript compiles cleanly
- [x] 401 auth errors still handled correctly (no retry)

## Known Issues

- Cannot easily reproduce the original bug since it requires catching the exact moment the backend is starting up. The fix is defensive — it handles the case rather than relying on timing.

---

## Technical View (for developers)

The fix adds a retry loop in the `useEffect` that checks onboarding status. Network errors (`!err.response` or `status >= 500`) trigger a retry with exponential backoff. Auth errors (401) bail out immediately. A new `backendConnecting` state is used to show a more informative loading message during retries.

## End-User View (for user guide)

**Fixed:** After restarting the server, the app now waits for the backend to be ready instead of showing the "Choose a plan" page. You'll see a "Connecting to server..." message while the app reconnects.
