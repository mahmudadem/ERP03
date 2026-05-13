# 91 — AI Assistant Remaining Polish: Rate Limiting, Keywords, Sidebar

**Date:** 2026-05-13
**Status:** ✅ COMPLETE
**Branch:** `feat/ai-proposal-sandbox`
**Estimate:** 2.5–3h
**Actual:** ~1h 10m

---

## Summary

Completed all remaining AI Assistant polish tasks: per-user burst rate limiting, broader domain-skill intent keywords, and conversation history sidebar showing titles/count/timestamps.

---

## Changes

### 1. Phase 7.1 — Per-User AI Rate Limiting

**Problem:** One user could send unlimited rapid requests, draining company credits and degrading performance for all users.

**Solution:** Two-tier rate limiting — per-user burst (in-memory) checked before per-company daily (persisted).

**Files changed:**

| File | Change |
|------|--------|
| `backend/src/application/ai-assistant/services/AiRateLimiterService.ts` | Added in-memory per-user burst limit (20 req/60s), `checkBurstLimit()`, `clearBurstMap()`, `RateLimitResult` type |
| `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts` | Pass `userId` to `rateLimiter.checkAndIncrement()` |
| `backend/src/tests/application/ai-assistant/AiRateLimiterService.test.ts` | Rewrote: 4 burst tests + 1 combined test + 8 daily tests |
| `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` | Added `AiRateLimiterService.clearBurstMap()` to `beforeEach` |
| `frontend/src/modules/ai-assistant/utils/aiErrorMessages.ts` | Added `extractErrorCode()`, burst vs daily 429 distinction |
| `frontend/src/locales/en/aiAssistant.json` | Added `burstLimitTitle`, `burstLimit` |
| `frontend/src/locales/ar/aiAssistant.json` | Added `burstLimitTitle`, `burstLimit` |
| `frontend/src/locales/tr/aiAssistant.json` | Added `burstLimitTitle`, `burstLimit` |

**Design decisions:**
- Burst limit: 20 messages per 60-second window per user, in-memory, resets on server restart (acceptable for burst)
- Daily limit: per-company, persisted in `AiProviderConfig` (survives restarts)
- Burst checked FIRST (cheap, no DB) then daily (requires DB read/write)
- Super Admin diagnostics are NOT rate-limited (only tenant-user chat)
- Frontend shows "Slow Down, wait X seconds" for burst (retryable) vs "Daily Limit Reached" for daily (not retryable)

### 2. Phase 4.1 — Respond in User's Language

**Status:** Already implemented in `AiContextBuilder.ts` line 117. No changes needed.

### 3. Phase 4.2 — Broader Intent Keywords

**Problem:** AI skill matching was limited to exact domain terms, missing many natural user queries.

**Solution:** Expanded keyword lists for all 6 domain skills with conversational patterns, abbreviations, and translations.

**File changed:**

| File | Change |
|------|--------|
| `backend/src/application/ai-assistant/skills/domain-skills.config.ts` | Expanded `triggerKeywords` for all 6 skills |

**Keywords added per skill:**
- **accounting-guidance**: balance sheet, P&L, cash flow, receivable, payable, ageing, bookkeeping, reconciliation, GL, accrual, depreciation, "what is my", "show me", "how much"
- **inventory-guidance**: out of stock, items, goods, material, SKU, stock movement, stock transfer, stock adjustment, available, on hand, in stock, backorder, "how many", "do we have"
- **sales-guidance**: delivery note, sales order, sales return, top customer, overdue, unpaid, collect, selling, sold, buyer, client, "how much did", "revenue from", "who owes"
- **purchases-guidance**: goods receipt, purchase return, expense, buying, bought, procurement, "how much did we spend", "owed to", "supplier balance"
- **reports-guidance**: trend, metric, analytics, insights, "give me a report", "show me the numbers", "what is the status", "where do we stand"
- **platform-guidance**: "how to", "where can I find", "can I", "is it possible", "need help", "stuck", setup, configure, enable, disable, permission, role, user management, company settings

### 4. Frontend Conversation History Sidebar

**Problem:** Sidebar showed raw message previews instead of meaningful conversation titles and metadata.

**Solution:** Use the Phase 6.3 backend metadata API (`title`, `messageCount`, `lastMessageAt`) in the sidebar UI.

**Files changed:**

| File | Change |
|------|--------|
| `frontend/src/api/aiAssistantApi.ts` | Added `ConversationMetaDTO` type, updated `getRecentConversations` return type |
| `frontend/src/modules/ai-assistant/components/GlobalAiWidget.tsx` | Updated `ConversationSummary` to include title/messageCount/lastMessageAt, sidebar shows title + count + timestamp |
| `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx` | Replaced `ConversationSummary` with `ConversationMetaDTO`, show title + message count + timestamp, date grouping uses `lastMessageAt` |
| `frontend/src/locales/en/aiAssistant.json` | Added `chat.noConversations`, `chat.untitledConversation`, `chat.messages` |
| `frontend/src/locales/ar/aiAssistant.json` | Same keys |
| `frontend/src/locales/tr/aiAssistant.json` | Same keys |

---

## Verification

- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run test -- AiRateLimiterService` ✅ — 13/13
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 35/35
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅
- `npm run graph:update` ✅

---

## Technical Developer View

### Rate Limiting Architecture

```
User sends chat message
  │
  ├─► Per-user BURST check (in-memory)
  │   Key: "companyId:userId"
  │   Window: 60 seconds sliding
  │   Limit: 20 requests
  │   On exceed: 429 RATE_LIMIT_BURST (retryable)
  │
  ├─► Per-company DAILY check (persisted in Firestore)
  │   Key: companyId
  │   Resets: midnight UTC
  │   Limit: configurable (default 100)
  │   On exceed: 429 RATE_LIMIT_EXCEEDED (not retryable)
  │
  └─► Proceed to chat processing
```

### Burst Limit Details
- `AiRateLimiterService.burstMap` is a static `Map<string, { timestamps: number[] }>`
- Each request pushes `Date.now()` into the user's array
- Expired entries (outside 60s window) are pruned on each check
- `clearBurstMap()` available for testing
- Burst limit does NOT apply to Super Admin diagnostics

### Intent Keyword Matching
- Keywords are matched via `AiSkillRegistry.selectDomainSkills(message)`
- All keywords are case-insensitive substring matches
- New conversational patterns cover common user phrasings in EN/AR/TR

---

## End-User View

### Rate Limiting
- If you send messages too quickly, you'll see a "Slow Down" message asking you to wait a few seconds before trying again.
- If you reach your company's daily AI request limit, you'll see a "Daily Limit Reached" message suggesting you try again tomorrow or contact your admin to increase the limit.

### Better Skill Matching
- The AI now understands a wider range of questions in English, Arabic, and Turkish — including casual phrasing like "how much did we spend?", "who owes us money?", "give me a report", and "where do we stand?"

### Conversation Sidebar
- The chat sidebar now shows conversation titles (auto-generated from your first message) instead of just message previews.
- Each conversation shows how many messages it contains and when it was last active.
- Titles make it easier to find and switch between conversations.