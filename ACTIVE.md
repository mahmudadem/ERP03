# 🎯 Current Focus

**Task:** (No active task — previous task completed)

**Previous Task:** Onboarding Redirect Race Condition Fix (Task 47)
**Started:** 2026-04-28
**Completed:** 2026-04-28
**Agent/IDE:** OpenCode
**Status:** ✅ Done

## What Was Done

Fixed intermittent redirect to `/onboarding/plan` after backend rebuild + browser refresh. Root cause: `RequireOnboarding` guard treated any non-401 API error as "user needs onboarding" and redirected immediately. During backend startup, connection refused/502/timeout errors triggered the redirect.

### Fixes Applied
1. **`RequireOnboarding.tsx`** — Added 3 retries with exponential backoff (1.5s, 3s, 4.5s) for network errors
2. **`RequireOnboarding.tsx`** — Added `backendConnecting` state with "Connecting to server..." message
3. **`RequireOnboarding.tsx`** — Separated network errors from auth errors (401 bails out immediately)

### Verification
- `npx tsc --noEmit` (frontend) — ✅ zero errors

## Detours
- None

## Rabbit Holes Found (DO NOT START — just log here)
- None

## Blockers
- None

## Recommended Next Step
Select next task from ROADMAP.md.
