# AI Assistant Rate Limiting Architecture

**Date:** 2026-05-13
**Status:** Implemented
**Related:** Phase 7.1

---

## Overview

The AI Assistant uses a two-tier rate limiting system to prevent abuse and manage costs:

1. **Per-user burst limit** — prevents rapid-fire requests from a single user
2. **Per-company daily limit** — caps total daily usage per company

---

## Architecture

```
Request → [Per-User Burst Check] → [Per-Company Daily Check] → Process
              (in-memory)              (persisted in Firestore)
              20 req/60s              Configurable (default: 100/day)
              429 RATE_LIMIT_BURST    429 RATE_LIMIT_EXCEEDED
              canRetry: true          canRetry: false
```

---

## Burst Limit (Per-User)

| Property | Value |
|----------|-------|
| Storage | In-memory `Map<string, BurstEntry>` |
| Key | `companyId:userId` |
| Window | 60 seconds (sliding) |
| Limit | 20 requests per window |
| Error | 429 `RATE_LIMIT_BURST` |
| Retry | Yes — "Slow down, wait X seconds" |
| Reset | Server restart |
| Scope | Tenant users only (Super Admin diagnostics exempt) |

**Implementation:** `AiRateLimiterService.checkBurstLimit()`

- Uses a sliding window: each request pushes `Date.now()` into the user's array
- Expired timestamps (outside the window) are pruned on each check
- When limit exceeded, returns `retryAfter` seconds until the oldest request expires
- Static `clearBurstMap()` for test isolation

## Daily Limit (Per-Company)

| Property | Value |
|----------|-------|
| Storage | `AiProviderConfig` in Firestore |
| Key | `companyId` |
| Window | Calendar day (resets at midnight UTC) |
| Limit | `maxRequestsPerDay` (default: 100) |
| Error | 429 `RATE_LIMIT_EXCEEDED` |
| Retry | No — "Try again tomorrow" |
| Reset | Midnight UTC |
| Durability | Persists across server restarts |

**Implementation:** `AiRateLimiterService.checkDailyLimit()`

- Uses `dailyRequestCount` and `dailyRequestDate` fields on `AiProviderConfig`
- `getTodaysRequestCount()` auto-resets count when the stored date is not today
- Incremented and saved atomically on each successful check

## Frontend Error Handling

`mapAiError()` in `aiErrorMessages.ts` distinguishes the two 429 codes:

| Code | Title | Message | canRetry |
|------|-------|---------|----------|
| `RATE_LIMIT_BURST` | "Slow Down" | "You're sending messages too quickly. Please wait a moment and try again." | Yes |
| `RATE_LIMIT_EXCEEDED` | "Daily Limit Reached" | "You've reached your daily AI request limit. Try again tomorrow..." | No |

---

## Testing

- `AiRateLimiterService.test.ts` — 13 tests covering burst limits, daily limits, and combined behavior
- `SendChatMessageUseCase.test.ts` — 35 tests, each clears burst map in `beforeEach`
- Both test suites pass independently and together