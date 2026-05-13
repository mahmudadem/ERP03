# 🎯 Current Focus

**Task:** AI Assistant Remaining Polish — Rate limiting, keywords, sidebar
**Started:** 2026-05-13
**Status:** ✅ ALL COMPLETE
**Agent/IDE:** OpenCode (CTO Mode)
**Branch:** `feat/ai-proposal-sandbox`

---

## Next Recommended Move

1. ✅ All 4 AI polish tasks committed and documented.
2. Merge `feat/ai-proposal-sandbox` to main.
3. Begin Phase 1 core stabilization: end-to-end testing of the 4 core ERP modules.
4. Before June 1: Firestore security rules.

---

## 2026-05-13 Result — Phase 7.1 Per-User AI Rate Limiting

**Status:** ✅ COMPLETE
**Estimate:** 60-90m
**Actual time:** ~30m

### Changes

1. **`AiRateLimiterService.ts`** — Added per-user per-minute burst rate limiting:
   - In-memory sliding window tracks requests per `companyId:userId` key
   - Default: 20 messages per 60-second window per user
   - Returns `429 RATE_LIMIT_BURST` with "wait X seconds" message when exceeded
   - Burst check runs FIRST (cheap, in-memory) before daily check (requires DB)
   - Static `clearBurstMap()` for test isolation
   - Exports `RateLimitResult` type for future use

2. **`SendChatMessageUseCase.ts`** — Updated rate limiter call to pass `userId`:
   - `checkAndIncrement(companyId)` → `checkAndIncrement(companyId, userId)`

3. **`aiErrorMessages.ts`** — Added burst limit vs daily limit distinction:
   - New `extractErrorCode()` function to check `err.response.data.code`
   - 429 with `RATE_LIMIT_BURST`: "Slow Down" + "wait a moment" + `canRetry: true`
   - 429 with `RATE_LIMIT_EXCEEDED`: "Daily Limit Reached" + `canRetry: false`

4. **i18n** (EN/AR/TR) — Added `chat.errors.burstLimitTitle` and `chat.errors.burstLimit`

5. **Tests** — Updated `AiRateLimiterService.test.ts`:
   - 4 new burst limit tests + 1 combined test
   - Added `AiRateLimiterService.clearBurstMap()` to `SendChatMessageUseCase` test `beforeEach`

### Verification

- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- AiRateLimiterService` ✅ — 13/13
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 35/35
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

---

## 2026-05-13 Result — Phase 4.1 Language Rule (ALREADY EXISTS)

**Status:** ✅ VERIFIED — Already implemented at `AiContextBuilder.ts` line 117
Rule 17: "Always respond in the SAME LANGUAGE that the user writes in."

---

## 2026-05-13 Result — Phase 4.2 Broader Intent Keywords

**Status:** ✅ COMPLETE
**Estimate:** 15m
**Actual time:** ~10m

### Changes

1. **`domain-skills.config.ts`** — Expanded trigger keywords for all 6 domain skills:
   - **accounting-guidance**: Added balance sheet, P&L, cash flow, receivable, payable, ageing, bookkeeping, reconciliation, GL, accrual, depreciation, retained earnings, closing entries, "what is my", "show me", "how much"
   - **inventory-guidance**: Added out of stock, items, goods, material, SKU, stock movement, stock transfer, stock adjustment, available, on hand, in stock, backorder, "how many", "how much stock", "do we have"
   - **sales-guidance**: Added delivery note, sales order, sales return, top customer, overdue, unpaid, collect, selling, sold, buyer, client, "how much did", "revenue from", "who owes"
   - **purchases-guidance**: Added goods receipt, purchase return, expense, buying, bought, procurement, "how much did we spend", "owed to", "supplier balance"
   - **reports-guidance**: Added trend, metric, analytics, insights, "give me a report", "show me the numbers", "what is the status", "where do we stand"
   - **platform-guidance**: Added "how to", "where can i find", "can i", "is it possible", "need help", "stuck", "don't know how", setup, configure, enable, disable, permission, role, user management, company settings

### Verification

- `backend`: `npx tsc --noEmit` ✅

---

## 2026-05-13 Result — Frontend Conversation History Sidebar

**Status:** ✅ COMPLETE
**Estimate:** 60-90m
**Actual time:** ~30m

### Changes

1. **`aiAssistantApi.ts`** — Updated `ConversationMetaDTO` interface:
   - Added `title?`, `messageCount?`, `lastMessageAt?`, `createdAt?` fields
   - Updated `getRecentConversations` return type to use `ConversationMetaDTO`

2. **`GlobalAiWidget.tsx`** — Updated sidebar to show titles and metadata:
   - `ConversationSummary` now has `title`, `messageCount`, `lastMessageAt`, `createdAt`
   - Sidebar shows conversation title (fallback to content preview)
   - Each item shows message count and timestamp
   - Date grouping uses `lastMessageAt` instead of `lastMessage.createdAt`
   - i18n keys for "No previous chats", "New conversation", "messages"

3. **`AiAssistantHomePage.tsx`** — Updated full-page conversation sidebar:
   - Replaced `ConversationSummary` with `ConversationMetaDTO`
   - Shows `conv.title` with fallback to "New conversation"
   - Shows message count and timestamp from metadata
   - Removed dependency on `conv.lastMessage` (deprecated field)

4. **i18n** (EN/AR/TR) — Added `chat.noConversations`, `chat.untitledConversation`, `chat.messages`

### Verification

- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

---

**Status:** ✅ COMPLETE
**Estimate:** 30-45m
**Actual time:** ~30m

### Changes

1. **`frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`**
   - Integrated `AiSetupWizard` into the Provider tab.
   - Wizard shows only for users who can manage AI settings when settings are loaded, AI is enabled, and the current tenant config is still unconfigured/default.
   - Treats these as configured states:
     - `DISABLED` runtime mode.
     - `CREDITS` mode with selected certified profile id/hash.
     - `BYOK` mode with a non-mock provider and either an API key or Ollama provider.
   - Hides the normal Save button while loading or while the wizard is active.
   - Redirects to `/ai-assistant` after setup if the user also has chat permission.

2. **`frontend/src/modules/ai-assistant/components/AiSetupWizard.tsx`**
   - Moved the `isConfigured` null render after hooks to preserve React hook ordering.
   - Guarded data-loading and auto-diagnostic effects when `isConfigured=true`.

3. **Graphify**
   - Ran `npm run graph:update` after code changes.

### Verification

- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅
- `npm run graph:update` ✅

### Documentation

- `1-TODO/done/90-ai-setup-wizard-integration.md`

---

## 2026-05-13 Result — Phase 6.6 Simplified Tenant AI Setup Wizard

**Status:** ✅ COMPLETE
**Estimate:** 45-60m
**Actual time:** ~40m

### Changes

1. **`frontend/src/modules/ai-assistant/components/AiSetupWizard.tsx`** (NEW) — 3-step setup wizard component:
   - **Step 1: Choose Mode** — Radio selection between CREDITS ("Use AI Credits — No API key needed") and BYOK ("Bring Your Own Key — Connect your own AI provider"). Visual cards with icons, clear i18n descriptions.
   - **Step 2: Configure Provider** — For CREDITS mode: shows certified model grid with name, provider, status badges, and category/certification info. For BYOK mode: shows provider dropdown, model dropdown/input, API key input, and endpoint input. BYOK loads providers dynamically via `aiAssistantApi.listAvailableProviders()` and models via `aiAssistantApi.listProviderModels()`.
   - **Step 3: Test & Activate** — Auto-runs diagnostic after configuration. Shows pass/fail result with details. "Activate AI Assistant" button saves settings via `aiAssistantApi.updateSettings()` and calls `onComplete()`. Failed diagnostics show detailed check results and "Retry Test" button.

   **Component interface:**
   ```typescript
   interface AiSetupWizardProps {
     onComplete: () => void;    // called after successful activation
     isConfigured: boolean;     // if true, don't render
   }
   ```

   **Key behaviors:**
   - Returns `null` when `isConfigured=true` (parent controls visibility)
   - Reuses existing API functions (`updateSettings`, `checkProviderHealth`, `listTenantCertifiedProfiles`, `listAvailableProviders`, `listProviderModels`)
   - CREDITS mode: sets `runtimeMode='CREDITS'`, `mode='certified_profile'`, populates `selectedModelProfileId`, `selectedProfileHash`, `providerId` from certified profile
   - BYOK mode: sets `runtimeMode='BYOK'`, `mode='legacy_unverified'`, populates `providerId`, `provider`, `model`, `apiEndpoint`, `apiKey`
   - Step indicator: numbered circles (1 ● 2 ○ 3 ○) with connecting lines and completed-step checkmarks
   - Smooth transitions between steps, centered card layout max-width 600px
   - Back/Next/Activate buttons at bottom
   - All user-facing strings use i18n with `t()` fallbacks

2. **i18n** (EN/AR/TR) — Added `setupWizard` section with 20 keys each:
   - `title`, `step1Title`, `step1Description`, `creditsMode`, `creditsDescription`, `byokMode`, `byokDescription`
   - `step2Title`, `step2CreditsDesc`, `step2ByokDesc`
   - `step3Title`, `step3Description`, `testingConnection`
   - `back`, `next`, `selectProvider`, `selectModel`, `retryTest`
   - `activating`, `diagnosticPassed`, `diagnosticFailed`, `activateButton`
   - `activationError`, `configurationSummary`, `modeLabel`

### Verification

- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅
- i18n JSON validity (EN/AR/TR) ✅

### Files Changed

New files:
- `frontend/src/modules/ai-assistant/components/AiSetupWizard.tsx`

Modified files:
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`

---

## 2026-05-13 Result — Phase 6.5 Provider Failure UX for AI Chat

**Status:** ✅ COMPLETE
**Estimate:** 30-45m
**Actual time:** ~30m

### Changes

1. **`aiErrorMessages.ts`** (NEW) — Error mapping utility at `frontend/src/modules/ai-assistant/utils/`
   - `AiErrorResponse` interface with `title`, `message`, `canRetry`, `actionLabel?`, `actionUrl?`
   - `mapAiError(error: unknown): AiErrorResponse` function mapping HTTP status codes to user-friendly messages:
     - 429 → Rate limit (no retry)
     - 401 → Auth failed (Go to Settings link)
     - 403 → No credits (Go to Settings link)
     - 409 → Conflict / request in progress (no retry)
     - 408 → Timeout (retry)
     - 500/502/503/504 → Provider down (retry)
     - Default → Provider error detection via regex, then generic error (retry)
   - Uses i18n for all user-facing strings

2. **`AiErrorDisplay.tsx`** (NEW) — Error display component at `frontend/src/modules/ai-assistant/components/`
   - Takes `error: unknown` and optional `onRetry?: () => void`
   - Renders styled card with color-coded icon (amber for retryable, red for non-retryable)
   - Shows "Retry" button only if `canRetry` is true AND `onRetry` is provided
   - Shows "Go to Settings" link if `actionUrl` is provided
   - Uses `role="alert"` for accessibility

3. **`GlobalAiWidget.tsx`** (MODIFIED) — Replaced raw error text with `AiErrorDisplay`
   - Added `error?: unknown` to `DisplayMessage` interface
   - Removed `isProviderError` from `DisplayMessage` (replaced by `error` field)
   - Removed old multi-branch error handling (429/403/provider-regex/generic) with single `mapAiError` usage
   - Error messages now rendered as `AiErrorDisplay` cards in the message stream
   - Added `handleRetry()` function: removes error message, pre-fills last user message, focuses input
   - Removed old inline error bar near the input box (errors now inline in chat)
   - Removed `AlertCircle` import (now in AiErrorDisplay)
   - Feedback buttons only shown for non-error messages (was already the case via `!msg.isProviderError`, now via `!msg.error`)

4. **i18n** (EN/AR/TR) — Added `chat.errors` section with 10 keys each:
   - `rateLimitTitle`, `rateLimit`
   - `authFailedTitle`, `authFailed`
   - `noCreditsTitle`, `noCredits`
   - `conflictTitle`, `conflict`
   - `timeoutTitle`, `timeout`
   - `providerDownTitle`, `providerDown`
   - `providerErrorTitle`
   - `genericTitle`, `generic`
   - `retry`, `goToSettings`

### Verification

- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅
- i18n JSON validity (EN/AR/TR) ✅

### Files Changed

New files:
- `frontend/src/modules/ai-assistant/utils/aiErrorMessages.ts`
- `frontend/src/modules/ai-assistant/components/AiErrorDisplay.tsx`

Modified files:
- `frontend/src/modules/ai-assistant/components/GlobalAiWidget.tsx`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`

---

**Status:** ✅ COMPLETE
**Estimate:** 45-60m
**Actual time:** ~40m

### Changes

1. **`AiChatMessage.ts`** — Added `feedback` field (`'positive' | 'negative'`) as optional property
   - Added `AiChatFeedback` type
   - Added to `AiChatMessageProps`, constructor, `toJSON()`, `fromJSON()`
   - Added `setFeedback()` method for toggle logic
   - `create()` passes `undefined` for feedback (no feedback on new messages)

2. **`IAiChatRepository.ts`** — Added two new methods:
   - `getById(companyId, messageId)` — Get a single message by ID, scoped to company
   - `updateFeedback(companyId, messageId, feedback)` — Update the feedback field on a message

3. **`FirestoreAiChatRepository.ts`** —Implemented `getById()` and `updateFeedback()`
   - `getById()` reads the document directly by ID from the chat_messages collection
   - `updateFeedback()` reads the document, calls `message.setFeedback()`, and persists the update

4. **`PrismaAiChatRepository.ts`** — Implemented `getById()` and `updateFeedback()`
   - Added `feedback` field to `create()` data
   - `getById()` uses `findFirst` with `id` and `companyId` filter
   - `updateFeedback()` uses Prisma `update` with `data: { feedback }`

5. **`schema.prisma`** — Added `feedback String?` column to `AiChatMessage` model

6. **`AiAssistantDTOs.ts`** — Added `feedback` field to `toChatMessageResponse()` mapper

7. **`AiAssistantController.ts`** — Added `updateMessageFeedback()` controller method
   - Route: `PATCH /tenant/ai-assistant/messages/:messageId/feedback`
   - Validates `feedback` is `'positive'` or `'negative'`
   - Validates message exists and belongs to the company
   - Validates message is an assistant message
   - Toggle: same feedback value removes it; different value changes it
   - Returns updated message via `AiAssistantDTOMapper`

8. **`ai-assistant.routes.ts`** — Added route:
   - `PATCH /messages/:messageId/feedback` with `permissionGuard('ai-assistant.chat.use')`

9. **`aiAssistantApi.ts`** (frontend) — Added `updateMessageFeedback()` API client function and `feedback` field to `ChatMessageDTO`

10. **`FeedbackButtons.tsx`** (NEW) — New React component:
    - Shows ThumbsUp/ThumbsDown icons below assistant messages
    - Clicking sends PATCH request to update feedback
    - Visual feedback: selected icon gets colored (green for positive, red for negative)
    - Toggle: clicking same value removes feedback
    - Switch: clicking opposite changes to new value
    - Disabled while submitting
    - i18n-aware with `aiAssistant.chat.feedback.positive/negative`

11. **`GlobalAiWidget.tsx`** — Integrated FeedbackButtons:
    - Added `feedback` field to `DisplayMessage` interface
    - Populated `feedback` from `ChatMessageDTO` on send and on history load
    - Renders `<FeedbackButtons>` below each non-error assistant message
    - Receives `companyId` from `useCompanyAccess()`
    - `onFeedbackSubmitted` callback updates message state in-place

12. **i18n files** (EN/AR/TR) — Added `chat.feedback.positive` and `chat.feedback.negative`:
    - EN: "Helpful" / "Not helpful"
    - AR: "مفيد" / "غير مفيد"
    - TR: "Faydalı" / "Faydalı değil"

13. **Test updates**:
    - `SendChatMessageUseCase.test.ts` — Added `getById` and `updateFeedback` to all mock chat repos
    - `AiToolCalling.test.ts` — Added `getById` and `updateFeedback` to mock chat repo

### Verification

- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 35/35
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

### Files Changed

New files:
- `frontend/src/modules/ai-assistant/components/FeedbackButtons.tsx`

Modified files:
- `backend/src/domain/ai-assistant/entities/AiChatMessage.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiChatRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiChatRepository.ts`
- `backend/src/infrastructure/prisma/repositories/ai-assistant/PrismaAiChatRepository.ts`
- `backend/prisma/schema.prisma`
- `backend/src/api/dtos/AiAssistantDTOs.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/api/routes/ai-assistant.routes.ts`
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/components/GlobalAiWidget.tsx`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
- `backend/src/tests/application/ai-assistant/AiToolCalling.test.ts`

---

## Next Recommended Move

Phase 6.3 backend is complete. Next recommended move:
1. Frontend: Build the conversation history sidebar that calls `GET /tenant/ai-assistant/conversations` and displays titles/message counts.
2. Phase 4.1: Add "Respond in User's Language" rule to system prompt.
3. Phase 4.2: Add broader intent keywords to skills.

---

## 2026-05-13 Urgent Detour Result — Module Access 403 Trace

**Status:** ✅ COMPLETE
**Estimate:** 45-60m
**Actual time:** ~55m

### Root Cause

Super Admin grants entitlements, but tenant module access is resolved from:
1. company module enablement records,
2. entitlement state,
3. module registry availability.

The seeder was creating module registry records without `code`, `version`, `lifecycleStatus`, or `implementationStatus`. The Firestore registry repository then defaulted those records to `lifecycleStatus='draft'` and `implementationStatus='unchecked'`, so implemented modules could be granted by Super Admin but still filtered out from Company Admin availability.

Follow-up browser verification exposed a second root cause: `platform.router` was mounted before `/tenant`, and platform sub-routers with root-level `assertSuperAdmin` guards intercepted authenticated `/tenant/...` requests before `tenant.router` could handle them.

### Changes

- `backend/src/seeder/seedOnboardingData.ts`
  - Seed implemented modules as registry-ready: `ready`, `available`, `passed`, `version=1.0.0`, `code=<moduleId>`.
- `backend/src/errors/errorHandler.ts`
  - Root backend error handler now returns `ApiError.statusCode` correctly.
- `frontend/src/api/companyModules.ts`
  - Company module list no longer converts API failures to an empty list.
- `frontend/src/pages/company-admin/pages/ModulesPage.tsx`
  - Company Admin Modules page now shows the actual module-load error instead of "No modules available" when the API fails.
- `frontend/src/locales/{en,ar,tr}/common.json`
  - Added translated Company Admin module-load error strings.
- `backend/src/api/server/router.ts`
  - Moved `/tenant` before `platformRouter` so Company Admin tenant routes cannot be intercepted by root-mounted Super Admin platform guards.
- `backend/src/api/__tests__/routerOrdering.test.ts`
  - Added regression coverage for tenant-before-platform route ordering.
- Emulator data
  - Targeted registry update applied for `accounting`, `inventory`, `purchase`, `sales`, and `ai-assistant`.
  - Rebuilt and restarted emulator from `firebase-export-before-routefix-20260513-024048`.

### Verification

- `backend`: targeted module availability/access tests ✅ — 33/33
- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run typecheck` ✅
- `backend`: router-order regression test ✅
- Runtime endpoint check ✅
  - `/tenant/company-admin/modules` returns 200 with SYCO modules.
  - `/tenant/company-admin/modules/active` returns 200 with active module IDs.
  - `/system/module-settings/definitions` still returns the expected Super Admin 403 for tenant users.

### Next Step

Hard refresh the frontend and verify Company Admin Modules shows the five granted modules, then verify tenant Accounting/Inventory pages load.

---

## 2026-05-13 Result — AI Assistant Fixing Plan Phase 3B/3C Tool Truncation Signals

**Status:** ✅ COMPLETE, reviewed, verified
**Estimate:** 60-90m
**Actual time:** ~50m

### Changes

Added explicit truncation signals (`truncated`, `displayedCount`/`totalCount`, `truncationNote`) to ALL 12 AI tools that limit results with `.slice()`:

**Accounting/Reporting tools:**
1. **`GetTrialBalanceSummaryTool.ts`** — `accountCount`, `displayedCount`, `truncated`, `truncationNote`
2. **`GetChartOfAccountsSummaryTool.ts`** — `totalAccounts`, `displayedCount`, `truncated`, `truncationNote`
3. **`GetGeneralLedgerSummaryTool.ts`** — `totalAccounts`, `displayedCount`, `truncated`, `truncationNote`
4. **`GetProfitAndLossTool.ts`** — `totalRevenueAccounts`, `totalExpenseAccounts`, `displayedRevenue`, `displayedExpenses`, `truncated`, `truncationNote`
5. **`GetBalanceSheetTool.ts`** — `totalAssetAccounts`, `totalLiabilityAccounts`, `totalEquityAccounts`, `displayedAssets/Liabilities/Equity`, `truncated`, `truncationNote`
6. **`GetCashFlowTool.ts`** — `totalItems`/`displayedCount` per section (operating/investing/financing), `truncated`, `truncationNote`
7. **`GetAgingReceivablesTool.ts`** — `totalAccounts`, `displayedCount`, `truncated`, `truncationNote`
8. **`GetAgingPayablesTool.ts`** — `totalAccounts`, `displayedCount`, `truncated`, `truncationNote`

**Sales/Purchases tools:**
9. **`GetSalesSummaryTool.ts`** — `totalCustomers`, `displayedCount`, `truncated`, `truncationNote`
10. **`GetPurchaseSummaryTool.ts`** — `totalSuppliers`, `displayedCount`, `truncated`, `truncationNote`
11. **`GetTopCustomersTool.ts`** — `totalCount`, `displayedCount`, `truncated`, `truncationNote`
12. **`GetTopSuppliersTool.ts`** — `totalCount`, `displayedCount`, `truncated`, `truncationNote`

**Tools NOT modified (no truncation):**
- `GetFinancialOverviewTool.ts` — aggregated totals only
- `GetMonthlyComparisonTool.ts` — all months in period
- `GetFiscalYearStatusTool.ts` — single status object
- `GetAccountStatementSummaryTool.ts` — single account summary
- `GetAccountBalanceTool.ts` — single account balance

**Detour fix:**
- **`GlobalAiWidget.tsx`** — Added missing `X` icon import from lucide-react (pre-existing build blocker).

### Verification

- `backend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

### Documentation

- `1-TODO/done/88-ai-assistant-phase3b-truncation-signals.md`

---

## 2026-05-13 Progress — AI Assistant Fixing Plan Phase 3A

**Status:** ✅ Phase 3A complete, reviewed, verified
**Estimate:** 45-60m
**Actual time:** ~45m

### Changes

1. **`SendChatMessageUseCase.ts`**
   - Added `estimateTokenCount(text)` using `Math.ceil(text.length / 3.5)`.
   - Added context-window overflow guard after `providerMessages` is built and before provider request execution.
   - If estimated prompt tokens exceed 90% of `modelProfile.maxContextTokens`, the use case adds a runtime warning and trims oldest history messages until under 85% of the model limit.
   - The guard preserves the system prompt and the current user message.

2. **`SendChatMessageUseCase.test.ts`**
   - Added tests for overflow warning behavior.
   - Added tests verifying system prompt/current user message preservation.
   - Added test verifying normal short context does not trigger overflow warning.

### Review / Verification

- `erp-reviewer`: ✅ PASS with medium follow-up notes.
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 35/35
- `backend`: `npm run build` ✅

### Follow-Up Notes

- Current guard estimates message content only. Tool-definition serialization overhead is not counted yet.
- The guard runs before the first provider call. Multi-round tool-planning messages can still grow context mid-loop; consider re-checking `activeMessages` before each provider round in a later refinement.

---

## 2026-05-12 Result — AI Assistant Fixing Plan Phase 2 Security Hardening

**Status:** ✅ COMPLETE, reviewed, verified
**Estimate:** 60-90m
**Actual time:** ~1h 20m

### Completed Subtasks

1. **Phase 2A — Prompt injection sanitization**
   - Added recursive `sanitizeForPrompt()` in `AiToolCallingOrchestrator`.
   - Sanitizes ERP tool-result data before AI prompt insertion.
   - Covers direct tool-result context and structured provider context.
   - Avoids corrupting legitimate business terms containing `inst`, `sys`, or `system` substrings.

2. **Phase 2B — Concurrent request deduplication**
   - Added per-process active lock set in `SendChatMessageUseCase`.
   - Lock key: `companyId:userId:conversationId`.
   - Same company/user/conversation concurrent sends return 409 Conflict.
   - Different conversations/users/companies are not blocked.
   - Locks are released in `finally` on success or error.

### Verification

- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 32/32
- `frontend`: `npm run build` ✅
- `npm run graph:update` ✅ — graphify updated after Phase 2 changes

### Notes

- `AiToolCalling` targeted prompt-sanitization tests pass, but the full `npm run test -- AiToolCalling` command still includes two pre-existing unrelated `CheckProviderHealthUseCase - Cooldown` failures.
- Concurrent locks are process-local. Distributed locking should be considered if the backend runs across multiple instances.

### Documentation

- `1-TODO/done/87-ai-assistant-phase2-security-hardening.md`
- `docs/architecture/ai-assistant-security-hardening.md`
- `docs/user-guide/ai-assistant-security.md`

---

## 2026-05-12 Progress — AI Assistant Fixing Plan Phase 2A

**Status:** ✅ Phase 2A complete, reviewed; targeted tests pass
**Estimate:** 30-45m
**Actual time:** ~35m

### Changes

1. **`AiToolCallingOrchestrator.ts`**
   - Added recursive `sanitizeForPrompt()` for tool-result data before it enters AI prompt context.
   - Sanitizes common prompt-injection phrases such as ignoring previous instructions, revealing secrets/keys/tokens, role override phrases, and instruction-forgetting phrases.
   - Sanitizes bracket/angle prompt markers like `[SYSTEM]`, `[INST]`, `[SYS]`, `<SYSTEM>` without corrupting legitimate words like `INSTALLATION`, `INSTITUTE`, `SYSTEMIC`, or `sysadmin`.
   - Applied sanitization in both `formatToolResultsForContext()` and `formatStructuredResultsForProviderContext()` before `JSON.stringify()`.

2. **`AiToolCalling.test.ts`**
   - Added prompt-sanitization tests for direct tool-result context and structured provider context.
   - Added regression tests for nested objects/arrays and false-positive business terms.

### Review / Verification

- `erp-reviewer`: ✅ PASS.
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- AiToolCalling` ⚠️ new sanitization tests pass, but two pre-existing `CheckProviderHealthUseCase - Cooldown` tests in the same file still fail because health checks return `ready=false` instead of expected `true`.

### Rabbit Hole Logged

- Pre-existing cooldown test failures in `AiToolCalling.test.ts` unrelated to Phase 2A. Needs separate investigation after Phase 2 unless it blocks a later verification gate.

---

## 2026-05-12 Result — AI Assistant Fixing Plan Phase 1 Business Model Fix

**Status:** ✅ COMPLETE, reviewed, verified
**Estimate:** 4-5h
**Actual time:** ~3h 15m

### Completed Subtasks

1. **Phase 1A — Runtime mode domain/API cleanup**
   - Replaced active `PLATFORM_MANAGED` runtime mode with `CREDITS` in backend domain/DTO/validator/Prisma documentation.
   - Kept legacy `PLATFORM_MANAGED` → `CREDITS` mapping in `AiProviderConfig.fromJSON()`.

2. **Phase 1B — Credit ledger foundation**
   - Added `AiCreditLedger` domain entity.
   - Added `IAiCreditLedgerRepository`.
   - Added Firestore repository at `companies/{companyId}/ai_credit_ledger/current`.
   - Registered `aiCreditLedgerRepository` in DI.

3. **Phase 1C — Runtime credit enforcement**
   - CREDITS mode checks credit balance before provider call.
   - CREDITS mode uses provider `platformRuntimeCredential` for platform-funded execution.
   - Successful chat responses debit 1 credit after provider success.
   - Failed provider requests do not consume credits.
   - Added audit event `AI_CREDIT_DEBIT_FAILED` for debit/save failures.

4. **Phase 1D — Frontend runtime-mode migration**
   - Frontend runtime-mode types now support `BYOK | CREDITS | DISABLED`.
   - Removed frontend `PLATFORM_MANAGED` and `BUILT_IN` runtime-mode references.
   - Added EN/AR/TR CREDITS labels and descriptions.

5. **Phase 1E — Credit APIs**
   - Added `GET /tenant/ai-assistant/credits`.
   - Added `POST /platform/ai-assistant/credits/grant`.
   - Added frontend API client functions for both endpoints.
   - Fixed Super Admin guard detour: `assertSuperAdmin` now enforces whenever applied, including `/platform/*` routes.

### Verification

- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 28/28
- `backend`: `npm run test -- assertSuperAdmin` ✅ — 4/4
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅
- `frontend/src`: no `PLATFORM_MANAGED` or `BUILT_IN` occurrences ✅
- `backend/src`: only accepted legacy `PLATFORM_MANAGED` mapping remains in `AiProviderConfig.fromJSON()` ✅
- `npm run graph:update` ✅ — graphify updated after code changes

### Detours

- **Super Admin guard security fix (~15m):** `assertSuperAdmin` previously skipped enforcement unless URL contained `/super-admin`, which left `/platform/*` routes insufficiently protected despite route-level `router.use(assertSuperAdmin)`. Fixed middleware and added tests.

### Documentation

- `1-TODO/done/86-ai-assistant-phase1-credits.md`
- `docs/architecture/ai-assistant-credits-runtime.md`
- `docs/user-guide/ai-assistant-credits.md`

---

## 2026-05-12 Progress — AI Assistant Fixing Plan Phase 1D

**Status:** ✅ Phase 1D complete, reviewed, verified
**Estimate:** 45-60m
**Actual time:** ~40m

### Changes

1. **`aiAssistantApi.ts`**
   - Updated frontend runtime-mode request types to `'BYOK' | 'CREDITS' | 'DISABLED'`.
   - Removed frontend `BUILT_IN` from runtime-mode unions.

2. **`AiAssistantSettingsPage.tsx`**
   - Migrated runtime-mode state/defaults from `PLATFORM_MANAGED` to `CREDITS`.
   - CREDITS mode now owns the certified-model/ERP03 provided model UI that previously belonged to PLATFORM_MANAGED.
   - BYOK API-key behavior remains unchanged.
   - Extracted the new diagnostics credits note into i18n.

3. **i18n EN/AR/TR**
   - Added/renamed `runtimeModeCREDITS` and `runtimeModeCREDITSDesc` in `aiAssistant.json`.
   - Replaced common runtime-mode `PLATFORM_MANAGED`/`BUILT_IN` labels with `CREDITS` labels.
   - Added missing `providerDesc`, `securityDesc`, and `diagnosticsCreditsNote` keys in EN/AR/TR.

### Review / Verification

- `erp-reviewer`: ✅ PASS for Phase 1D scope.
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅
- `frontend/src`: no `PLATFORM_MANAGED` or `BUILT_IN` occurrences ✅

### Rabbit Holes Logged

- `AiAssistantSettingsPage.tsx` has pre-existing i18n gaps for some certification labels and catch-block fallback errors. They are not part of Phase 1D but should be handled in a later i18n polish pass.

---

## 2026-05-12 Progress — AI Assistant Fixing Plan Phase 1C

**Status:** ✅ Phase 1C complete, reviewed, verified
**Estimate:** 60-90m
**Actual time:** ~55m

### Changes

1. **`SendChatMessageUseCase.ts`**
   - Added optional `IAiCreditLedgerRepository` dependency.
   - Replaced runtime `PLATFORM_MANAGED` logic with `CREDITS`.
   - Checks credit ledger before provider call.
   - Uses provider registry `platformRuntimeCredential` for CREDITS mode.
   - Debits 1 credit only after successful chat response.
   - Maps insufficient-credit debit failure to `ApiError.forbidden(...)`.
   - Adds `AI_CREDIT_DEBIT_FAILED` audit log when debit/save fails for non-insufficient-credit reasons.

2. **`CheckProviderHealthUseCase.ts`**
   - Replaced runtime credential logic/comment from `PLATFORM_MANAGED` to `CREDITS`.
   - Did not debit credits for diagnostics; Phase 1 plan only required chat debit.

3. **`AiAssistantController.ts`**
   - Wires `diContainer.aiCreditLedgerRepository` into `SendChatMessageUseCase`.

4. **`SendChatMessageUseCase.test.ts`**
   - Migrated runtime-mode tests from `PLATFORM_MANAGED` to `CREDITS`.
   - Added/updated tests for:
     - CREDITS success debits and saves ledger.
     - Missing/no-credit ledger rejects before provider call.
     - Provider failure does not debit credits.

5. **`AiAuditService.ts`**
   - Added `AI_CREDIT_DEBIT_FAILED` audit event type as a direct type dependency.

### Review / Verification

- `erp-reviewer`: ✅ APPROVE.
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 28/28 tests
- `PLATFORM_MANAGED` no longer appears in `SendChatMessageUseCase.ts` or `CheckProviderHealthUseCase.ts` ✅

---

## 2026-05-12 Progress — AI Assistant Fixing Plan Phase 1B

**Status:** ✅ Phase 1B complete, reviewed; expected typecheck follow-up remains for Phase 1C
**Estimate:** 45-60m
**Actual time:** ~35m

### Changes

1. **`AiCreditLedger.ts`** — New domain entity with:
   - `id`, `companyId`, `balance`, `totalPurchased`, `totalConsumed`, `lastDebitAt`, `lastCreditAt`, `createdAt`, `updatedAt`.
   - `create()`, `debit()`, `credit()`, `hasCredits()`, `toJSON()`, `fromJSON()`.
   - No transaction/mutation history in JSON output.
   - Throws a domain `Error` with the planned insufficient-credits message instead of importing API-layer `ApiError` into the domain layer.

2. **`IAiCreditLedgerRepository.ts`** — New repository interface with:
   - `getByCompanyId(companyId)`
   - `save(ledger)`

3. **`FirestoreAiCreditLedgerRepository.ts`** — New Firestore implementation:
   - Path: `companies/{companyId}/ai_credit_ledger/current`.
   - Preserves tenant isolation by scoping reads/writes under `companyId`.

4. **Repository / DI exports**
   - Added `IAiCreditLedgerRepository` barrel export.
   - Added `AiCreditLedger` domain barrel export as a direct export dependency.
   - Registered `aiCreditLedgerRepository` in `bindRepositories.ts`.

### Review / Verification

- `erp-reviewer`: ✅ PASS for Phase 1B scope.
- `backend`: `npx tsc --noEmit` ⚠️ still has only the expected 2 Phase 1C errors from `PLATFORM_MANAGED` comparisons in:
  - `CheckProviderHealthUseCase.ts`
  - `SendChatMessageUseCase.ts`
- No new Phase 1B type errors.

### Technical Decision

- The plan text said `debit()` should throw `ApiError.forbidden(...)`, but importing `ApiError` into a domain entity would violate Clean Architecture. We kept the domain entity API-agnostic and will map insufficient-credit failures to `ApiError.forbidden(...)` in Phase 1C use-case logic.

---

## 2026-05-12 Progress — AI Assistant Fixing Plan Phase 1A

**Status:** ✅ Phase 1A complete, reviewed; expected typecheck follow-up remains for Phase 1C
**Estimate:** 20-30m
**Actual time:** ~25m

### Changes

1. **`AiProviderConfig.ts`**
   - Changed `AiTenantRuntimeMode` to exactly `'BYOK' | 'CREDITS' | 'DISABLED'`.
   - Updated default `allowedRuntimeModes` to `['BYOK', 'CREDITS']`.
   - Kept `defaultForCompany()` runtime mode as `'BYOK'`.
   - Added legacy mapping from stored `'PLATFORM_MANAGED'` to `'CREDITS'` for both `runtimeMode` and `allowedRuntimeModes`.

2. **`AiAssistantDTOs.ts`**
   - Updated update-settings runtime-mode DTO unions to `'BYOK' | 'CREDITS' | 'DISABLED'`.

3. **`ai-assistant.validators.ts`**
   - Updated runtime-mode validator arrays to `['BYOK', 'CREDITS', 'DISABLED']`.

4. **`backend/prisma/schema.prisma`**
   - Updated runtime-mode comments/default documentation to `CREDITS`.

### Review / Verification

- `erp-reviewer`: ✅ PASS for Phase 1A scope.
- `backend`: `npx tsc --noEmit` ⚠️ expected 2 errors from later Phase 1C files:
  - `CheckProviderHealthUseCase.ts` still compares against `PLATFORM_MANAGED`.
  - `SendChatMessageUseCase.ts` still compares against `PLATFORM_MANAGED`.

### Rabbit Holes Logged

- Prisma `allowedRuntimeModes` read path appears to store JSON as a string but pass it directly to `AiProviderConfig.fromJSON()`, causing stored restrictions to fall back to defaults. This is pre-existing and should be fixed before/with Prisma credit-readiness work; current active runtime is Firestore-oriented.
- DTOs are still missing some pre-existing settings fields (`conversationContextMode`, `includePreviousToolResults`) in response/request contracts. Not part of Phase 1A.

---

## 2026-05-12 Progress — Super Admin Diagnostics Modal + UX Refactor

**Status:** ✅ Changes made, all compile clean
**Estimate:** 1-2h
**Actual time:** ~1h

### Changes

1. **`CheckProviderHealthUseCase.executeWithConfig()`** — New method that accepts a pre-built `AiProviderConfig` (with plaintext apiKey) and runs diagnostics without cooldown/decrypt/config-load steps. Used by the Super Admin diagnostics endpoint which provides its own API key.

2. **`AiToolCatalogController.runAdminModelProfileDiagnostics()`** — Fixed type errors:
   - Changed `profile.scope || 'GLOBAL'` (was `AiModelScope`) to `'legacy_unverified'` for the `mode` constructor param (which expects `AiTenantModelMode`)
   - Removed `profileId` from `executeWithConfig` options (not a valid field on `ExecuteWithConfigInput`)
   - Added clarifying comments about placeholder companyId and temporary config

3. **`AiModelProfilesPage.tsx`** — Refactored:
   - Replaced inline Edit/Delete text links with `ActionMenu` (⋮) dots menu with 4 items: Edit, Run Diagnostics, Manage Certifications, Delete
   - Added `SuperAdminDiagnosticsModal` — opened from dots menu "Run Diagnostics" item
   - Added `CertificationManagerModal` — opened from dots menu "Manage Certifications" item
   - Removed stale diagnostics/cert state from page (`testing`, `diagnosticCompanyId`, `diagnosticResult`, `companies`, `certifications`, `certSaving`, `shellCertCategory`, `showManualCertModal`, `manualCertForm`)
   - Removed stale handlers (`handleRunDiagnostics`, `handleRecordManualCert`, `handleRunShellCert`, `handleExpireCertification`, `loadCompanies`, `loadCertifications`)
   - Removed certification summary card from profile edit modal (cert now managed via dedicated modal)
   - Added imports for `ActionMenu`, `ActionMenuItem`, `SuperAdminDiagnosticsModal`

4. **`CertificationManagerModal.tsx`** — Removed diagnostics section:
   - Removed `Activity` import (no longer used)
   - Removed `ProviderHealthResponse` and `SuperAdminCompany` imports
   - Removed `companies` prop (was only used for diagnostics company selector)
   - Removed `diagnosticCompanyId`, `diagnosticResult`, `testing` state
   - Removed `handleRunDiagnostics` handler and diagnostics UI
   - Diagnostics now has its own dedicated `SuperAdminDiagnosticsModal` (uses admin's own API key)

5. **i18n** — Added `diagnosticsModal` section (EN/AR/TR) with: title, close, modelInfo, baseUrl, apiKey, apiKeyPlaceholder, apiKeyHelp, apiKeyFooterNote, infoText, runWithKey, results, noResults

### Detour Fix — Silent Mock Fallback in Diagnostics

**Problem:** Diagnostics could silently "pass" by falling back to `MockProvider` when:
- A tenant had no AI settings (defaulted to mock)
- A tenant had settings but no API key (`ProviderFactory` silently fell back to mock)
- Admin diagnostics ran without a key (same silent fallback)

The `MockProvider.isAvailable()` always returns `true` and `MockProvider.chat()` always succeeds, so all checks appeared green — but nothing was actually tested.

**Fix (Type B detour, ~20min):**
6. **`ProviderFactory.ts`** — Added `getProviderStrict()` method that throws `ProviderProviderError` instead of silently falling back to `MockProvider`. Added `isMockProvider()` static method. Added `ProviderProviderError` export class. For diagnostics, we want to FAIL loudly, not silently pass via mock.

7. **`CheckProviderHealthUseCase.ts`** — Both `execute()` and `executeWithConfig()` now:
   - Use `ProviderFactory.getProviderStrict()` instead of `getProvider()`
   - Catch `ProviderProviderError` and return a clear diagnostic failure with reason like "OpenAI-compatible provider requires an API key but none is configured"
   - Detect `MockProvider` and return a clear failure: "Provider is configured as 'mock' — diagnostics cannot test a mock provider"
   - `executeWithConfig()` also has an upfront guard for missing API keys (except mock/ollama)

**Impact:** `SendChatMessageUseCase` and other chat codepaths still use `getProvider()` (graceful mock fallback for chat). Only diagnostics uses `getProviderStrict()` (loud failure for configuration problems).

### Files Changed
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts` — Added `ExecuteWithConfigInput`, `executeWithConfig()`, replaced `getProvider` with `getProviderStrict` + mock detection, added API key guard
- `backend/src/application/ai-assistant/providers/ProviderFactory.ts` — Added `getProviderStrict()`, `createOpenAICompatibleProviderStrict()`, `createOllamaProviderStrict()`, `isMockProvider()`, `ProviderProviderError`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts` — Fixed type errors in `runAdminModelProfileDiagnostics`
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx` — Refactored with ActionMenu, removed stale state, wired dedicated modals
- `frontend/src/modules/super-admin/components/CertificationManagerModal.tsx` — Removed diagnostics section, removed companies prop
- `frontend/src/locales/en/common.json` — Added `diagnosticsModal` keys
- `frontend/src/locales/ar/common.json` — Added `diagnosticsModal` keys
- `frontend/src/locales/tr/common.json` — Added `diagnosticsModal` keys

### Verification
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

---

## 2026-05-12 Progress — Fix AI chat tool call pipeline and UX issues

**Status:** ✅ Changes made, all compile clean, reviewer feedback addressed
**Estimate:** 1-2h
**Actual time:** ~1h 30m

### Issues Fixed

1. **Save button not enabling when changing models/providers on tenant settings** — `hasChanges` was missing `providerId` comparison: `(settings.providerId || '') !== (selectedProviderId || '')`

2. **AI chat tool calls failing silently** — Three root causes:
   - **Provider endpoint not resolved from providerId**: When a tenant selected a dynamic provider (e.g., OpenRouter) but saved settings without an explicit `apiEndpoint`, the `ProviderFactory` defaulted to `https://api.openai.com/v1`. Fix: New `resolveProviderEndpoint()` method in `SendChatMessageUseCase` looks up `providerId` in the provider registry and applies `defaultBaseUrl`.
   - **Text-plan parser only recognized `[ERP_TOOL_PLAN]` format**: Models like Qwen output bare JSON `{"tool_call": "module.function"}`. The parser now has 3 strategies: (1) ERP_TOOL_PLAN markers, (2) JSON code blocks with tool_call/calls keys, (3) inline JSON.
   - **Tool name normalization inconsistency**: Strategy 1 kept dots (`accounting.getTrialBalanceSummary`) while Strategies 2/3 normalized to underscores. Now all strategies normalize dots to underscores for consistent Runtime Guard lookup.

3. **Provider column missing from AI Model Profiles table** — Added a "Provider" column showing provider name badge, and a filter dropdown to filter models by provider.

4. **ProviderFactory cache key excluded endpoint** — Cached providers by `companyId:provider:model` but not by endpoint, causing stale providers when switching between providers with different base URLs. Fix: Include `apiEndpoint` in cache key.

### Files Changed
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx` — Added `providerId` to `hasChanges`
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx` — Added Provider column + filter dropdown
- `frontend/src/locales/{en,ar,tr}/common.json` — Added `provider` column and `filterAllProviders` i18n keys
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts` — Added `resolveProviderEndpoint()`, improved `parseTextToolPlan()` with 3-strategy parsing + `tryParseBareToolJson()`, normalized tool names in Strategy 1
- `backend/src/application/ai-assistant/providers/ProviderFactory.ts` — Include `apiEndpoint` in cache key, keep protocol

---

## 2026-05-12 Progress — AI Provider-driven Settings UX Increment 1A

**Status:** ✅ Subtask complete, uncommitted
**Estimate:** 45-60m
**Actual time:** ~35m

Business decision captured:
- Super Admin AI Providers page is tenant-usable provider metadata only.
- Tenant-owned API keys stay in tenant AI settings, not provider definitions.
- ERP03-managed AI/subscription credentials and usage controls will belong to a separate future entitlement/credits engine.
- Provider records now carry one simple `byok` boolean: `true` means tenant brings their key; `false` means ERP03 manages the connection elsewhere.

Changed:
- `AiProvider.ts` — Added persisted/serialized `byok` boolean; removed provider credential flag from public JSON.
- `AiProviderRegistryUseCase.ts` — Accepts/validates/preserves `byok`; provider credential support retained only for backward compatibility with existing records.
- `AiToolCatalogController.ts` — Provider update now treats provider records as metadata.
- `superAdmin/index.ts` — Replaced platform credential API fields with `byok` metadata.
- `AiProvidersPage.tsx` — Removed provider API-key field; added BYOK checkbox and BYOK/ERP03-managed badges.
- i18n (en/ar/tr) — Updated provider-page wording and labels.

Verification:
- `backend`: `npx tsc --noEmit` ✅
- `frontend`: `npx tsc --noEmit` ✅

---

## 2026-05-12 Result — AI Provider-driven Settings UX Increment 1

**Status:** ✅ COMPLETE, ready for manual QA
**Estimate:** 5-7h
**Actual time:** ~2h 30m

Completed:
- Provider page changed to metadata-only with `byok` boolean.
- Added tenant-safe provider list endpoint: `GET /tenant/ai-assistant/providers`.
- Added tenant-safe model list endpoint: `GET /tenant/ai-assistant/providers/:providerId/models`.
- Added frontend API types/functions for tenant provider/model lists.
- Tenant AI Settings now uses provider dropdown + provider model dropdown with fallback behavior.
- API key field now follows provider `byok` + `authType`.
- Certified Models modal now shows score badges and a shell-certification disclaimer.
- Added architecture, user-guide, and completion report docs.

Verification:
- `erp-reviewer` ✅ approved after fixes
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

Documentation:
- `1-TODO/done/85-ai-provider-driven-settings-ux.md`
- `docs/architecture/ai-provider-driven-settings.md`
- `docs/user-guide/ai-provider-settings.md`

---

## 2026-05-11 Result — AI Settings UX Final Gaps (Subtasks 6 & 8)

**Status:** ✅ COMPLETE
**Estimate:** 45-60m
**Actual time:** ~1h 15m

### Subtask 8 — Restore Profile Reference on Reload
Fixed the gap where reloading the settings page lost all visual state for selected certified profiles and registered custom profiles.

Changed:
- Added bridging `useEffect` in `AiAssistantSettingsPage.tsx` that runs after both `settings` and `erp03AvailableModels` are loaded
- Matches `settings.selectedModelProfileId` + `settings.selectedProfileHash` against certified profiles → restores `selectedErp03Profile`
- If mode is `custom_uncertified` and profile exists in ALL query → restores `registeredProfileId` + `registeredProfileData`

### Subtask 6 — Profile Deprecation Endpoint
Implemented soft-delete flow for tenant custom model profiles.

Changed:
- `AiModelProfileUseCase.ts` — Added `deprecateTenantProfile()` method (marks as `deprecated`, sets `enabled=false`)
- `AiSettingsUseCase.ts` — Added `clearSelectedProfile()` method (clears profile reference, resets mode to `legacy_unverified`)
- `AiAssistantController.ts` — Added `deprecateTenantCustomModelProfile` controller (checks if active profile, clears settings)
- `ai-assistant.routes.ts` — Added `DELETE /settings/custom-model-profiles/:profileId` route
- `aiAssistantApi.ts` — Added `deleteTenantCustomModelProfile` API function
- `AiAssistantSettingsPage.tsx` — Added "Deprecate Profile" button with confirmation dialog
- i18n (en/ar/tr) — Added deprecate labels

Verification:
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 25/25
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

Completion report:
- `1-TODO/done/84-ai-settings-ux-final-gaps.md`

Next recommended move:
- Manual browser QA: test reload restoration (select certified model, save, reload page) and deprecation flow (register custom model, deprecate, verify settings reset)
- Commit all remaining uncommitted changes

---

## 2026-05-10 Result — Production Topbar Precision Widget Layout

**Status:** ✅ COMPLETE
**Estimate:** 2-4h
**Actual time:** ~2h 20m

Replaced the production top-bar widget layout with the 96-cell precision system validated in Canvas Dev.

Changed:
- Ported the precision grid into `frontend/src/components/topbar/DraggableWidgetSpace.tsx`.
- Replaced the legacy widget edit buttons in `frontend/src/layout/TopBar.tsx` with one list-style `Layout Actions` menu.
- Updated `frontend/src/store/widgetStore.ts` to store 96-cell widget layouts and richer style properties.
- Kept real top-bar widgets in use while moving border, background, bold, and padding control to the precision wrapper.
- Added selected-widget quick controls for 1-cell moves, typed width, bold, border variant, and background color.
- Expanded background choices and made border variants follow each widget background color.
- Fixed stacking/overflow by showing controls only for the selected widget and keeping color panels compact.
- Updated auto-align so active widgets divide the full 96-cell width equally.
- Added margin inside the top-bar widget area while widgets still use the available height.

Verification:
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅

Documentation:
- `1-TODO/done/83-topbar-precision-widget-layout.md`
- `docs/architecture/topbar-precision-widget-layout.md`
- `docs/user-guide/topbar-widget-layout.md`

Next recommended move:
- Browser QA the production top bar on desktop and narrow widths, then decide whether any default widget order/widths should be changed for launch.

---

## 2026-05-10 Result — Canvas Dev 96-Cell Widget Layout Sandbox

**Status:** ✅ COMPLETE
**Estimate:** 60-90m
**Actual time:** ~1h 10m

Added a dev-only precision top-bar layout implementation to `/canvas-dev` so the new widget architecture can be tested before replacing the production widget area.

Changed:
- Added a 96-cell horizontal precision grid sandbox in `frontend/src/pages/dev/CanvasDevPage.tsx`.
- Added sandbox-local `PrecisionWidgetConfig`, `PRECISION_MAX_CELLS = 96`, and `PRECISION_MIN_WIDGET_SPAN = 8`.
- Added `Edit & Layout`, `Auto Align`, and `Add Widget` controls for the candidate layout.
- Added predefined widget templates for clock, date, logo, text, weather, and battery.
- Added per-widget quick controls under each widget:
  - Move left/right by exactly 1 cell.
  - Type exact width/span.
  - Toggle bold, border, and background.
  - Remove widget.
- Follow-up fix: quick controls now appear only for the selected widget, preventing overlapping/staked toolbars across the bar.
- Follow-up fix: the 96-cell candidate now initializes from and adds the real application top-bar widgets (`company-logo`, `fiscal-year`, `base-currency`, `approval-mode`, `ui-mode`, `clock`, `date`, `notes`, `alarm`) instead of mocked weather/battery/text widgets.
- Follow-up fix: the Bold control now overrides real widget child typography, background styling now opens a compact color swatch panel, and real widget internal backgrounds/borders are disabled inside the sandbox so the candidate wrapper owns all styling.
- Kept all state local to the canvas dev page. The production `TopBar` and `DraggableWidgetSpace` were not changed.
- Detour fix: the legacy React Grid Layout canvas demo could trigger `Maximum update depth exceeded` because it wrote scaled 48-cell coordinates back into the shared widget store. The old demos are now hidden behind a toggle by default, and the RGL demo converts coordinates back before saving.

Verification:
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅

Completion report:
- `1-TODO/done/82-canvas-dev-96-cell-widget-layout.md`

Next recommended move:
- Open `/canvas-dev`, test the 96-cell candidate with realistic top-bar widths, then decide whether to port it into `DraggableWidgetSpace`. Estimate for production port after QA: 2-4h.

---

## 2026-05-10 Result — Emulator Data Restore and Export-Path Guardrail

**Status:** ✅ COMPLETE
**Estimate:** 10-15m
**Actual time:** ~10m

Restored the latest Firebase emulator export back into the normal `emulator-data` folder.

Root cause:
- The default `npm run emulators` script imported from `./emulator-data` but used `--export-on-exit` without a destination.
- Firebase wrote shutdown data to a timestamped folder such as `firebase-export-1778387915442YfJ0Al`.
- The next emulator startup looked for `./emulator-data`, which was missing, so data appeared lost.

Changed:
- Copied `firebase-export-1778387915442YfJ0Al` to `emulator-data`.
- Updated `package.json` so `npm run emulators` now uses `--export-on-exit=./emulator-data`.

Verification:
- `emulator-data/firebase-export-metadata.json` exists ✅
- `emulator-data/firestore_export/all_namespaces/all_kinds/output-0` exists ✅
- Restored Firestore export size: `3061301` bytes ✅

Next recommended move:
- Start emulators with `npm run emulators` or `npm run emulators:remote`; both now import and export through `./emulator-data`.

---

## 2026-05-10 Result — Graphify CLI Usability Fix

**Status:** ✅ COMPLETE
**Estimate:** 20-30m
**Actual time:** ~25m

Made graphify usable from the project root without depending on a global `graphify` executable on PATH.

Changed:
- Added npm scripts: `graph:update`, `graph:check`, `graph:query`, `graph:explain`, and `graph:path`.
- Added Windows wrappers: `scripts/graphify.bat` and `scripts/graphify.ps1`.
- Updated `scripts/watch-graphify.bat` to use `py -3.14 -m graphify watch .`.
- Rebuilt `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`.
- Added developer guidance in `docs/architecture/graphify-usage.md`.

Verification:
- `npm run graph:check` ✅
- `scripts\graphify.bat query "How does AI Assistant connect to Accounting tools?" --budget 300` ✅
- `powershell -ExecutionPolicy Bypass -File scripts\graphify.ps1 explain "SendChatMessageUseCase"` ✅
- `npm run graph:update` ✅ — rebuilt `12886 nodes`, `21549 edges`, `760 communities`

Completion report:
- `1-TODO/done/80-graphify-cli-wrappers.md`

Next recommended move:
- Return to the previous product work: create a clean checkpoint for current uncommitted AI/frontend responsiveness/docs changes, then proceed with Increment 3 frontend UI for Recommended Certified Models and tenant custom certification. Estimate: 5-7h.

---

## 2026-05-10 Result — Increment 2.5 Branch and Worktree Reconciliation

**Status:** ✅ COMPLETE
**Estimate:** 45-60m
**Actual time:** ~40m

Reconciled the branch/worktree state before starting AI Model Management Increment 3.

Findings:
- Starting branch and final branch are both `feat/ai-proposal-sandbox`.
- AI Model Management Increment 1 and Increment 2 backend/API work are committed on `feat/ai-proposal-sandbox` at HEAD commit `52e97549`.
- `main` is still at `b201766f` and does not contain the AI backend/certification commits.
- The frontend responsiveness fixes are not committed on `main`; they are currently uncommitted working-tree changes on top of `feat/ai-proposal-sandbox`.
- No merge or cherry-pick was needed because all current work already coexists on the AI feature branch.
- No conflicts were found or resolved.

Verification:
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `backend`: targeted AI certification/routing/API tests ✅ — 5 suites, 32 tests
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅
- `frontend`: `npm run dev -- --host 127.0.0.1 --port 5174` smoke start ✅ — HTTP 200, server stopped after check

Completion report:
- `1-TODO/done/79-branch-worktree-reconciliation.md`

Next recommended move:
- Before Increment 3 frontend UI work, create a clean checkpoint for the uncommitted responsiveness/docs changes, then proceed with the Recommended Certified Models and tenant custom certification UI. Estimate: 5-7h.

---

## 2026-05-09 Result — Responsiveness Fix Plan

**Status:** ✅ COMPLETE
**Estimate:** 4-6h
**Actual time:** ~1h 30m

Resolved systemic responsiveness and UI stability issues across the application.

Changed:
- **Infrastructure:** Created `useBreakpoint.ts` for consistent Tailwind-aligned breakpoint detection.
- **AppShell:** Replaced manual resize listeners with `useBreakpoint('lg')`. Implemented mobile-specific sidebar auto-close and backdrop overlay.
- **Preferences:** Added `showWidgetsOnMobile` and `showTopbarActionsOnMobile` toggles to `UserPreferencesContext` and backend API (`userPreferencesApi.ts`).
- **TopBar:** Merged layout-mode and widget-manager controls into a single unified dropdown. Implemented conditional visibility for mobile.
- **Widget Space:** Relocated per-widget style buttons to prevent top-bar overflow on small screens.
- **Appearance Settings:** Added "Mobile Display" configuration section for user-controlled responsiveness.
- **Layout Grids:** Fixed hardcoded `grid-cols-3/2` in `SalesReturnDetailPage`, `SalesSettingsPage`, and `PurchaseSettingsPage` to use `sm:` responsive prefixes.

Verification:
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅
- `frontend`: Manual verification of sidebar auto-close and backdrop overlay logic.

Completion report:
- `1-TODO/done/01-responsiveness-fix.md`

Next recommended move:
- Perform module-specific audits for other complex screens (Inventory/Accounting) to ensure grid-to-stack behavior is consistent.

---

## 2026-05-09 Result — AI Model Management Backend Trust Foundation

**Status:** ✅ COMPLETE  
**Estimate:** 6-8h for original increment; delivered minimum backend foundation in ~2h  
**Actual time:** ~2h

Implemented the minimum backend foundation to close the unsafe model-name trust gap for AI tool routing.

Changed:
- Added `AiProvider` entity/repository.
- Added fixed certification category registry.
- Added `AiModelCertificationResult` entity/repository.
- Extended `AiModelProfile` into an exact runtime profile with `scope`, `tenantId`, `providerId`, `modelId`, endpoint fingerprint, runtime settings, `profileHash`, `revision`, `enabled`, and expanded statuses.
- Added deterministic profileHash generation from runtime-relevant fields.
- Extended tenant AI settings with `mode`, `providerId`, `selectedModelProfileId`, and `selectedProfileHash`.
- Existing/free-text settings now hydrate as `legacy_unverified`.
- Added `AiModelRoutingGuard`.
- Wired routing guard into chat tool contract exposure and direct AI tool endpoint checks.
- Added certification gate checks inside `AiRuntimeGuard`.
- Kept `AiModelCapabilityCatalog` as display/diagnostics hinting only; it is not used as certification authority.

Safety outcome:
- `custom_uncertified` and `legacy_unverified` settings cannot expose or execute sensitive ERP tools.
- Diagnostics passed does not create certification.
- Stale `profileHash` is rejected.
- Same `modelId` with different provider/endpoint is not trusted.
- Tenant certification cannot be reused by another tenant.
- Proposal Sandbox remains non-executing; direct write/post operations remain blocked.

Verification:
- `backend`: `npm run typecheck` ✅
- `backend`: targeted trust tests ✅ — 4 suites, 53 tests
- `backend`: chat/diagnostics/tool regression slice ✅ — 3 suites, 38 tests
- `backend`: `npm run build` ✅

Completion report:
- `1-TODO/done/77-ai-model-management-backend-trust-foundation.md`

Next recommended move:
- Increment 2: add certification execution/API workflows, provider registry APIs, tenant custom certification API, and migration tooling. Estimate: 5-7h.

---

## 2026-05-09 Operational Detour — Tailscale Local Dev Access

**Status:** ✅ COMPLETE  
**Estimate:** 30-45m  
**Actual time:** ~35m

Configured local development access over Tailscale IP `100.72.126.75`.

Changed:
- `firebase.json`
- `package.json`
- `frontend/package.json`
- `frontend/.env.development.local`
- `frontend/src/config/firebase.ts`
- `JOURNAL.md`
- `1-TODO/done/76-tailscale-dev-environment.md`

Verification:
- `firebase.json` JSON parse ✅
- `frontend`: `npm run build` ✅
- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run typecheck` ✅

Non-blocking issue logged:
- `backend/functions`: `npm run build` fails due to unrelated package/version TypeScript issues. Root `firebase.json` uses `backend/` as the Functions source, so this does not block the active emulator setup.

Next:
- Start the emulators with `npm run emulators:remote`.
- Start the frontend with `npm run dev:remote` in `frontend/`.
- Test from another Tailscale device at `http://100.72.126.75:5173`.
- If unreachable, allow Windows Firewall inbound access for ports `5173`, `4000`, `5001`, `9099`, `8080`, `9001`, and `9199`.

---

## 2026-05-10 Result — Increment 3: Frontend AI Certification UI

**Status:** ✅ COMPLETE
**Estimate:** 5-7h
**Actual time:** ~5h

Implemented the frontend UI that uses the existing certification APIs.

**Phase 1 — API Client Contracts:**
- Added `scope=ALL` support to `AiModelCertificationUseCase.listValidCertifiedProfiles()` for GLOBAL + TENANT combined queries
- Updated `AiAssistantController.listTenantCertifiedProfiles` to accept `scope=ALL`
- Added full certification types to `superAdmin/index.ts`: `AiProvider`, `UpsertAiProviderPayload`, `AiCertificationCategory`, `AiCertificationStatus`, `AiCertificationResult`, `CertifiedProfileEntry`, `ManualCertificationPayload`, `RunCertificationPayload`
- Expanded `AiModelProfile` type to match full backend `toJSON()` (scope, tenantId, providerId, modelId, displayName, baseUrl, toolMode, profileHash, revision, enabled, etc.)
- Redefined `UpsertAiModelProfilePayload` as explicit interface (not Omit) matching backend contract
- Added provider API functions: `getAiProviders`, `getAiProvider`, `createAiProvider`, `updateAiProvider`, `enableAiProvider`, `disableAiProvider`
- Added certification API functions: `getAiModelProfileCertifications`, `recordGlobalCertification`, `runGlobalCertification`, `expireCertification`, `listValidCertifiedProfiles`
- Added tenant API functions to `aiAssistantApi.ts`: `createTenantCustomModelProfile`, `runTenantCustomModelDiagnostics`, `runTenantCustomModelCertification`, `listTenantCertifiedProfiles`

**Phase 2 — Super Admin Provider UI:**
- Created `AiProvidersPage.tsx` — full CRUD for AI providers (list, create, edit, enable/disable)
- Added route `/super-admin/ai-providers` and nav item with Server icon
- Full i18n for EN/AR/TR under `superAdmin.aiProviders.*`
- Provider types: openai, openai_compatible, google_gemini, anthropic, ollama, custom
- Provider auth types: api_key, bearer, none, custom
- Capability badges: Tools, JSON Mode, Model Sync

**Phase 3 — Super Admin Model Certification UI:**
- Enhanced `AiModelProfilesPage.tsx` with:
  - Certification Summary Panel (loads and displays certifications per profile)
  - Manual Certification Form (modal with all required fields)
  - Shell Certification inline form (profileHash + category)
  - Expire Certification button per certification row
  - Safety disclaimer: "Certification validates ERP module compatibility. Diagnostics only test connectivity."
- Full i18n for EN/AR/TR under `superAdmin.aiModels.certifications.*`

**Phase 4 — Tenant Recommended Certified Models:**
- Created `CertifiedModelsModal.tsx` — modal component showing certified profiles
- Fetches GLOBAL + TENANT certified profiles via `scope=ALL`
- Table with Model, Provider, Scope badge (GLOBAL/TENANT), Categories, Tool Mode, Status, Select button
- When user selects a certified model: populates provider, modelId, baseUrl, selectedModelProfileId, selectedProfileHash, mode=certified_profile
- Safety label about certification vs diagnostics
- Integrated into `AiAssistantSettingsPage.tsx` with "Browse Certified Models" button
- Selected profile indicator with green/gray status

**Phase 5 — Tenant Custom Model Flow:**
- Added custom model creation form to settings page with Provider Type, Base URL, Model ID, Display Name
- Creates TENANT-scoped custom profile via `createTenantCustomModelProfile`
- Shows profile status after creation (Custom/Uncertified + status badges)
- Runs diagnostics for custom profile via `runTenantCustomModelDiagnostics`
- Runs tenant certification via `runTenantCustomModelCertification`
- Cancel button resets all custom model state
- Safety labels: "Uncertified — sensitive ERP tools are blocked" and "Company certification is tenant-scoped only"

**Phase 6 — Safety Labels:**
- Diagnostics: "Connection and capability test only. This does not certify ERP module compatibility."
- Certification: "ERP compatibility approval for specific categories/modules."
- Custom uncertified: "Not certified. Sensitive ERP tools are blocked."
- Legacy unverified: "Legacy unverified model. Please select a certified profile or run company certification."
- Company certification: "Company certification is tenant-scoped only. It does not appear as global recommended."

**Phase 7 — Frontend Tests:**
- Skipped — no frontend test infrastructure exists yet (no Jest/Vitest/RTL config). Manual browser QA covers verification.

**Verification:**
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `backend`: targeted certification tests ✅ — 5 suites, 5 tests
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅

**Files Changed:**

Backend:
- `backend/src/application/ai-assistant/use-cases/AiModelCertificationUseCase.ts` — Added `scope=ALL` support
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts` — Accept `scope=ALL` parameter

Frontend (new):
- `frontend/src/modules/super-admin/pages/AiProvidersPage.tsx` — Provider registry UI
- `frontend/src/modules/ai-assistant/components/CertifiedModelsModal.tsx` — Certified models modal

Frontend (modified):
- `frontend/src/api/superAdmin/index.ts` — Provider + certification types and API functions
- `frontend/src/api/aiAssistantApi.ts` — Certification types and tenant API functions
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx` — Certification UI
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx` — Recommended models + custom model flow
- `frontend/src/layout/SuperAdminShell.tsx` — Nav item for AI Providers
- `frontend/src/router/routes.config.ts` — Route for AI Providers
- `frontend/src/locales/en/common.json` — Provider + certification i18n
- `frontend/src/locales/ar/common.json` — Provider + certification i18n
- `frontend/src/locales/tr/common.json` — Provider + certification i18n
- `frontend/src/locales/en/aiAssistant.json` — Certified models + custom model i18n
- `frontend/src/locales/ar/aiAssistant.json` — Certified models + custom model i18n
- `frontend/src/locales/tr/aiAssistant.json` — Certified models + custom model i18n

**Next Recommended Move:**
Manual browser QA in Super Admin and Tenant settings:
1. Super Admin → AI Providers: list/create/edit/enable/disable providers
2. Super Admin → AI Models: view certifications, record manual cert, run shell cert, expire cert
3. Tenant → AI Settings → Provider: open "Browse Certified Models", select certified model, save
4. Tenant → AI Settings → Provider: create custom model, run diagnostics, run certification
5. Verify: uncertified custom model shows warning; certified model carries selectedModelProfileId + selectedProfileHash

---

## Current Focus — Correct Credential/Provider Design (runtimeMode + platformRuntimeCredential)

**Status:** ✅ COMPLETE
**Actual time:** ~2.5h (including audit fixes)

### Problem
The previous implementation had a fundamental design flaw: `AiProvider.defaultApiKey` was used as an automatic silent fallback when tenants had no API key. This conflated three separate concerns:
1. **Certification** — testing model compatibility
2. **Tenant BYOK runtime** — company brings their own key
3. **Platform-managed runtime** — platform provides AI as a service

### Changes

**Backend — Entity Renames (2 files):**
- `AiProvider.ts`: Renamed `defaultApiKey` → `platformRuntimeCredential`. `toJSON()` returns `hasPlatformRuntimeCredential` (never the key). `fromJSON()` reads BOTH old and new field names for backward compatibility with existing Firestore docs.
- `AiProviderConfig.ts`: Added `runtimeMode: 'BYOK' | 'PLATFORM_MANAGED' | 'BUILT_IN' | 'DISABLED'` and `allowedRuntimeModes: AiTenantRuntimeMode[]`. Defaults: `runtimeMode = 'BYOK'`, `allowedRuntimeModes = ['BYOK', 'PLATFORM_MANAGED', 'BUILT_IN']`.

**Backend — Use Case Updates (3 files):**
- `AiProviderRegistryUseCase.ts`: Renamed `defaultApiKey` → `platformRuntimeCredential` in input interface and encryption logic.
- `SendChatMessageUseCase.ts`: **DELETED** `applyProviderDefaultApiKey()` (silent fallback). **ADDED** `resolveRuntimeCredential()` with explicit mode-based logic:
  - Mock provider → skip credential check entirely
  - `BYOK` → require tenant apiKey; reject if missing
  - `PLATFORM_MANAGED`/`BUILT_IN` → use platform credential from provider registry; reject if not configured
  - `DISABLED` → reject
- `AiSettingsUseCase.ts`: Added `runtimeMode` + `allowedRuntimeModes` to `UpdateSettingsInput`. Passes through to entity.

**Backend — Controller/DTO/Validator Updates (3 files):**
- `AiToolCatalogController.ts`: Renamed `hasDefaultApiKey` → `hasPlatformRuntimeCredential` in destructure.
- `AiAssistantController.ts`: Now passes `runtimeMode`, `allowedRuntimeModes`, `mode`, `providerId`, `selectedModelProfileId`, `selectedProfileHash` (fixed pre-existing gap where these were silently dropped).
- `AiAssistantDTOs.ts`: Added `runtimeMode` + `allowedRuntimeModes` + previously-missing fields to request/response DTOs.
- `ai-assistant.validators.ts`: Added validation for `runtimeMode`, `allowedRuntimeModes`, `mode`, `providerId`, `selectedModelProfileId`.

**Backend — Prisma Fix (2 files):**
- `schema.prisma`: Added 8 missing columns: `mode`, `providerId`, `selectedModelProfileId`, `selectedProfileHash`, `conversationContextMode`, `includePreviousToolResults`, `runtimeMode`, `allowedRuntimeModes`
- `PrismaAiSettingsRepository.ts`: Added all 8 fields to both create and update blocks. `allowedRuntimeModes` stored as JSON string.

**Frontend — Type & UI Updates (5 files):**
- `superAdmin/index.ts`: Renamed `defaultApiKey` → `platformRuntimeCredential` in `AiProvider` and `UpsertAiProviderPayload`.
- `AiProvidersPage.tsx`: Updated UI: "Platform Runtime Credential" label, "Platform credential" badge.
- `aiAssistantApi.ts`: Added `runtimeMode` + `allowedRuntimeModes` + previously-missing fields to `AiSettingsDTO` and `UpdateAiSettingsPayload`.
- `AiAssistantSettingsPage.tsx`: Added `runtimeMode` selector dropdown (filtered by `allowedRuntimeModes`) with mode-specific descriptions. Fixed `showApiKeyField` to only show when `runtimeMode === 'BYOK'`.
- `i18n (en/ar/tr)`: Added runtimeMode labels for all 4 modes + renamed provider credential labels.

**Tests:**
- `SendChatMessageUseCase.test.ts`: Added 8 new tests for `resolveRuntimeCredential()` covering all 4 modes + edge cases (BYOK with platform credential available, PLATFORM_MANAGED with/without credential, BUILT_IN, DISABLED). All 26 tests pass.

### Verification:
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 26 tests
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

### Design Rules Enforced:
1. Certification compatibility and runtime billing are separate concerns
2. No silent fallback from missing tenant key to platform key
3. Platform runtime credentials are ONLY used for PLATFORM_MANAGED/BUILT_IN tenants
4. BYOK tenants MUST have their own API key — rejected clearly if missing
5. `allowedRuntimeModes` set by Super Admin restricts what tenant can select
6. Tenant defaults to all available options: `['BYOK', 'PLATFORM_MANAGED', 'BUILT_IN']`
7. Mock provider never requires credentials

---

## Previous Focus — Fix Certification Failures + Add Provider API Key Management

**Status:** ✅ COMPLETE
**Actual time:** ~2h

### Problem
1. **Shell certification always FAILED** for ACCOUNTING, FINANCE_REPORTING, TOOL_CALLING, DATA_FILTERING categories because `UpsertAiModelProfileInput` didn't carry runtime config fields (`dataFilterPolicyId`, `safetyPolicyId`, `systemPromptPolicyId`, `toolMode`, `enabled`, `scope`, etc.) — the profile was created without these fields, and the certification engine correctly rejected profiles missing `dataFilterPolicyId`.
2. **Super Admin couldn't set API keys** for providers. The `AiProvider` entity only stored registry metadata (name, type, base URL), not API keys. Only tenant admins could set per-company keys.

### Changes — Subtask A: Backend Model Profile Runtime Config (3 files)
- **`UpsertAiModelProfileInput`** — Added 14 new optional fields: `scope`, `providerId`, `modelId`, `displayName`, `baseUrl`, `temperature`, `maxOutputTokens`, `toolMode`, `timeoutMs`, `retryPolicy`, `safetyPolicyId`, `systemPromptPolicyId`, `dataFilterPolicyId`, `enabled`
- **`AiModelProfileUseCase.upsertProfile()`** — When ANY runtime field is provided, uses the full constructor to preserve profileHash, scope, providerId, etc. Legacy path (no runtime fields) still works.
- **`AiToolCatalogController.validateModelProfilePayload()`** — Validates `toolMode`, `scope`, `temperature`, `maxOutputTokens`, `timeoutMs`

### Changes — Subtask B: Provider Default API Key (4 files)
- **`AiProvider` entity** — Added `defaultApiKey?: string` property. `toJSON()` returns `hasDefaultApiKey` boolean (never the key). `toPersistenceJSON()` includes the encrypted key for storage. `fromJSON()` deserializes the key.
- **`FirestoreAiProviderRepository`** — Uses `toPersistenceJSON()` (includes apiKey) instead of `toJSON()` (excludes apiKey).
- **`AiProviderRegistryUseCase`** — Accepts `defaultApiKey` in `UpsertAiProviderInput`. Encrypts on save (via `AesEncryptionService`), preserves existing key on update if not provided. Constructor now takes optional `IEncryptionService`.
- **`AiToolCatalogController.updateProvider()`** — Strips `hasDefaultApiKey` (computed field) from `existing.toJSON()` before merging with request body.
- **DI container** — Passes `encryptionService` to `AiProviderRegistryUseCase`.

### Changes — Subtask C: Chat Runtime API Key Fallback (1 file)
- **`SendChatMessageUseCase`** — Added `providerRepository?: IAiProviderRepository` dependency. New `applyProviderDefaultApiKey()` method: when tenant config has no API key, looks up the provider by `config.provider`, decrypts its `defaultApiKey`, and applies it as fallback. Added after `decryptConfig()` in the main flow.
- **DI container** — Passes `aiProviderRepository` to `SendChatMessageUseCase`.
- Import added for `IAiProviderRepository`.

### Changes — Subtask D: Frontend Updates (5+ files)
- **`AiModelProfilesPage.tsx`** — Added "Runtime Configuration" section to the modal with: scope, toolMode, temperature, maxOutputTokens, timeoutMs, retryPolicy, dataFilterPolicyId, safetyPolicyId, systemPromptPolicyId, enabled checkbox. Updated `emptyForm` and `openEditModal` to populate all new fields.
- **`AiProvidersPage.tsx`** — Added `defaultApiKey` masked input with show/hide toggle (Eye/EyeOff icons), hint text about encryption. Shows `hasDefaultApiKey` badge in the provider table.
- **`superAdmin/index.ts`** — Added `hasDefaultApiKey` to `AiProvider` type, `defaultApiKey` to `UpsertAiProviderPayload`, 14 new runtime config fields to `UpsertAiModelProfilePayload`.
- **i18n (en/ar/tr)** — Added keys: `form.scope`, `form.toolMode`, `form.temperature`, `form.maxOutputTokens`, `form.timeoutMs`, `form.retryPolicy`, `form.dataFilterPolicyId`, `form.safetyPolicyId`, `form.systemPromptPolicyId`, `form.enabled`, `form.runtimeConfig`, `form.runtimeConfigSubtitle` for models; `form.defaultApiKey`, `form.defaultApiKeyHint`, `form.keepExistingKey`, `flags.hasKey` for providers.

### Verification:
- `backend`: `npx tsc --noEmit` ✅
- `frontend`: `npx tsc --noEmit` ✅  
- `frontend`: `npm run build` ✅

### How to test:
1. **Super Admin → AI Models** — Edit a model profile. In the new "Runtime Configuration" section, set `dataFilterPolicyId` to `ai-data-filter-v1`, `safetyPolicyId` to `proposal-draft-sandbox-v1`, and `systemPromptPolicyId` to `erp-assistant-base-v1`. Set `toolMode` to `native_tools`. Save.
2. **Run Shell Certification** again for ACCOUNTING or TOOL_CALLING — should now pass structural checks (return WARNING instead of FAILED).
3. **Super Admin → AI Providers** — Edit a provider. The form now has a "Default API Key" field with show/hide toggle. Enter a key, save, and verify the table shows a green "Key set" badge.
4. **Tenant Chat** — If a tenant has no API key configured, the system now falls back to the provider's default API key.

---

## Previous Focus — Modal-based UX Rewrite for AiModelProfilesPage

**Status:** ✅ COMPLETE
**Actual time:** ~45m

Rewrote `AiModelProfilesPage.tsx` from a two-column side-panel layout to a clean full-width table + modal-based UX per user request ("instead of putting everything to side edit model must use modal scrollable and inside the modal a button run diagnostic and other for cert run, make all nice and clean").

### Changes:
- **`AiModelProfilesPage.tsx`** — Complete rewrite from 744-line side-panel layout to modal-based UX:
  - Full-width profile table with search and stats header
  - Click "Edit" or row model name → opens `SuperAdminModal` (size `xl`) with three scrollable sections:
    1. **Profile Details** — editable form fields (always visible)
    2. **Diagnostics** — company selector + run diagnostics button + results (editing only)
    3. **Certifications** — certification table + record manual cert button + shell cert form + expire action (editing only)
  - "New Model" button opens modal in create mode (only profile details section shown)
  - Delete button moved inside modal footer alongside Save/Cancel
  - Manual certification form remains a separate nested `SuperAdminModal`
  - Clean section dividers and section headers with icons
  - `SectionDivider` and `SectionHeader` helper components for modal content organization

- **`SuperAdminPage.tsx`** — Extended `SuperAdminModal` component:
  - Added `'sm'` and `'xl'` size options (previously only `'md'` and `'lg'`)
  - `xl` uses `max-w-4xl` for wider profile editing modal
  - `xl` size has `max-h-[70vh]` scrollable content area (vs `65vh` for others)

- **i18n:** Added new keys to all three locale files:
  - `superAdmin.aiModels.modal.profileDetails` — Section header for profile form
  - `superAdmin.aiModels.diagnosticsPanel.subtitle` — Helper text for diagnostics section
  - `superAdmin.aiModels.actions.cancel` — Cancel button label

### Verification:
- `frontend`: `npx tsc --noEmit` ✅ (no type errors)
- `frontend`: `npm run build` ✅ (produces dist output)

### Remaining:
- **Seed certification test data** — The dev seed script (`backend/src/scripts/seedAiCertifiedProfileDev.ts`) needs testing; manual seeding or emulator data may be needed
- **Browser QA** — Developer will manually verify the modal UX in browser
- **Commit** — Changes ready for commit after developer approval

---

## Previous Focus — AI-led Tool Planning (Completed)

---

## ✅ 2026-05-08 Result

Implemented AI-led tool planning:

- Super Admin chat keywords are now advisory hints, not deterministic execution triggers.
- The model receives schema-aware allowed tool cards and keyword hints.
- Known tool-capable models can request native structured tool calls.
- Unknown/text-only models can request guarded read-only tools through `ERP_TOOL_PLAN` JSON.
- Runtime Guard validates native and text-plan calls before execution.
- Multi-step tool chaining is supported across planning rounds.

### Verification

- `backend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` ✅ — 12 suites, 331 tests
- `backend`: `npm run build` ✅
- `graphify update .` attempted ❌ — command unavailable on PATH

### Follow-up Fix: Provider-Prefixed Model Names

Fixed model capability lookup so provider-prefixed model IDs such as `openai/gpt-4o-mini` resolve to the known `gpt-4o-mini` profile instead of being treated as unknown/text-only.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiRuntimeGuard.test.ts` ✅ — 13 tests
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅

### Follow-up: Free Model Test Profiles

Registered these OpenAI-compatible free models as known experimental profiles:

- `google/gemma-4-31b-it:free`
- `openai/gpt-oss-20b:free`
- `z-ai/glm-4.5-air:free`
- `tencent/hy3-preview:free` — marked for finance/accounting/reporting test use

Native provider tool calling remains off for these models until verified. They use guarded `ERP_TOOL_PLAN` text-plan mode for read-only ERP tools.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiRuntimeGuard.test.ts` ✅ — 15 tests
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅

### Follow-up: AI Settings Model Diagnostics

Added a diagnostics panel to **AI Assistant → Settings → Provider** so admins can test the saved provider/model before relying on it in chat.

The diagnostics now show:

- provider connection status,
- basic model response status,
- native OpenAI-style `tool_calls` support,
- guarded `ERP_TOOL_PLAN` fallback support,
- catalog model profile and recommended mode.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅ — 3 tests
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` ✅ — 13 suites, 338 tests
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅
- `graphify update .` attempted ❌ — command unavailable on PATH

### Follow-up: Conversation Context First Rules

Manual chat evaluation showed the assistant treated follow-up messages too independently. Example: after Trial Balance data exposed `cash syp1`, a later Arabic follow-up asking what happened to that account did not reuse the prior fetched data/context strongly enough.

Fix:
- Updated the base orchestration skill so every user message is treated as part of one ongoing conversation.
- Added broad rules: understand intent first, clarify ambiguous intent before answering/tooling, answer from existing context when sufficient, use minimum additional read-only tools when more ERP data is needed, and ask for extra info only when it is truly missing/contradictory/ambiguous.
- Added a compact `[RECENT ERP DATA FROM THIS CONVERSATION]` block built from recent assistant message `metadata.toolResults`.
- Updated tool planning rules to use current message, chat history, previous tool results, and schemas together.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts src/tests/application/ai-assistant/AiToolCalling.test.ts` ✅ — 2 suites, 32 tests
- `backend`: `npm run typecheck` ✅

Actual time: ~30m.

### Follow-up: Conversation Context Cost Settings

Added admin-controlled context budgets so customers using their own API key can decide how much conversation history and previous ERP tool-result data is sent to the model.

Fix:
- Added `conversationContextMode`: `minimal`, `balanced`, `deep`.
- Added `includePreviousToolResults`.
- Existing configs default to `balanced` with previous tool-result reuse enabled.
- `SendChatMessageUseCase` now limits fetched history, provider history, long message text, previous tool-result count, and previous tool-result total prompt size according to the saved setting.
- The assistant adds a runtime warning when context was trimmed to control AI token cost.
- AI Settings now exposes the controls with EN/AR/TR labels.
- Added completion report `1-TODO/done/74-ai-assistant-context-cost-settings.md`.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/domain/ai-assistant/AiProviderConfig.test.ts src/tests/application/ai-assistant/AiSettingsUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅ — 3 suites, 52 tests
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅
- `backend`: `npm run build` ✅

Actual time: ~45m.

### Follow-up: Editable AI Model Profiles

Fixed the diagnostics/chat mismatch for new models.

Root cause:
- Model diagnostics used live provider probes and could prove that a model responds and supports native tool calls.
- Chat runtime still used model capability/trust metadata separately.
- New models without a persisted profile could therefore pass diagnostics but still appear as untested/text-only in chat.

Fix:
- Added editable Super Admin AI model profiles backed by Firestore.
- Added DB-first model profile resolution for chat and diagnostics.
- Added Super Admin UI at `/super-admin/ai-models` to add, update, delete, sync, tag, and status model profiles.
- Diagnostics now stores the last diagnostic result on the model profile.
- Passing diagnostics does not automatically promote trust status; Super Admin explicitly controls whether a model is tested, experimental, custom, blocked, deprecated, or text-only.
- Chat badges now distinguish tested/experimental/custom/untested instead of showing tested models as untested.
- Detour fix: encoded internal Firestore document IDs so model names with `/` or `:` can be saved safely while still displaying the original model name in the UI.
- Added Super Admin model-profile diagnostics so platform admins can test a selected model profile using a selected company's saved AI provider settings without exposing API keys.
- Added completion report `1-TODO/done/75-ai-model-profile-management.md`.
- Updated architecture and user-guide docs.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅ — 2 suites, 22 tests
- `backend`: `npm run test -- --runInBand src/tests/domain/ai-assistant/AiModelProfile.test.ts src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅ — 2 suites, 5 tests
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/domain/ai-assistant/AiModelProfile.test.ts` ✅ — 2 suites, 6 tests
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npm run build` ✅

Actual time: ~1h 20m.

### Detour: AI Chat 30s Timeout

Manual chat testing with slower/free models hit `timeout of 30000ms exceeded`.

Fix:
- Kept the normal frontend API timeout at 30 seconds for ERP screens.
- Set AI chat requests to 120 seconds.
- Set AI diagnostics requests to 180 seconds.
- Set backend OpenAI-compatible provider chat timeout to 120 seconds.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/OpenAICompatibleProvider.test.ts src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅ — 33 tests
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅

### Detour: Frontend Ngrok Host Allowlist

Manual browser QA through ngrok was blocked by Vite's allowed-hosts guard for `caucus-garbage-unusable.ngrok-free.dev`.

Fix:
- Added the ngrok hostname to `frontend/vite.config.ts` under `server.allowedHosts`.

Verification:
- `frontend`: `npm run typecheck` ✅

Next:
- Restart the frontend Vite dev server, then reload the ngrok URL.

### Files Changed By This Task

- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts`
- `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts`
- `backend/src/api/validators/ai-assistant.validators.ts`
- `backend/src/tests/application/ai-assistant/AiRuntimeGuard.test.ts`
- `backend/src/tests/application/ai-assistant/AiToolCalling.test.ts`
- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
- `backend/src/tests/domain/ai-assistant/AiProviderConfig.test.ts`
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
- `backend/src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts`
- `backend/src/domain/ai-assistant/entities/AiModelProfile.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelProfileRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/index.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelProfileRepository.ts`
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/routes/ai-tool-catalog.routes.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx`
- `frontend/src/layout/SuperAdminShell.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
- `docs/architecture/ai-assistant-runtime-v2.md`
- `docs/user-guide/ai-assistant-runtime-v2.md`
- `1-TODO/done/71-ai-assistant-ai-led-tool-planning.md`
- `1-TODO/done/72-ai-settings-model-diagnostics.md`
- `1-TODO/done/73-ai-assistant-conversation-context.md`
- `1-TODO/done/74-ai-assistant-context-cost-settings.md`
- `1-TODO/done/75-ai-model-profile-management.md`
- `JOURNAL.md`
- `ACTIVE.md`

### Recommended Next Move

Manual browser QA in AI Assistant and Settings:

1. In AI Settings, run Model diagnostics for `tencent/hy3-preview:free`, `openai/gpt-oss-20b:free`, and one known native model such as `gpt-4o-mini`.
2. In Super Admin -> AI Models, sync defaults, then create or edit the tested model profile and confirm status/tags/tool-mode settings save and reload.
3. In AI Settings, save each Conversation Context mode once (`Minimal`, `Balanced`, `Deep`) and confirm settings reload correctly. Then leave it on `Balanced` with previous tool results enabled for normal QA.
4. In chat, test `openai/gpt-oss-120b:free` or the selected free model with prompts like “show account statement for account code 1010101”.
5. In `gpt-4o-mini`, retest a continuous Trial Balance conversation:
   - ask for Trial Balance,
   - ask Arabic follow-ups,
   - ask about an account from the prior tool result such as `cash syp1`,
   - confirm it reuses prior fetched data and calls another read-only tool only when movement details are needed.
6. Confirm tool cards/results display clearly and no hallucinated figures appear.

Estimate: 30-45m.

---

## ✅ What Was Completed

### 1. Implemented Flag on AI Tool Catalog
- Added `implemented: boolean` field to `AiToolDefinition` entity (default `false`)
- Marked 17 real tools as `implemented: true` in `AiToolCatalogSeed`
- Super Admin catalog page: new Implementation column (green "Implemented" / gray "Planned" badge), filter dropdown, stats bar
- Super Admin detail page: Implementation badge in Properties panel
- Full i18n (EN/AR/TR) for implemented/planned labels
- `implemented` is immutable from DB — always comes from seed (like mode/riskLevel)

### 2. Tool Detail Page Enhancement
- Added "About This Tool" panel with description, whenToUse, example prompts, safety notes
- Added "Read-only" badges on Properties, Input Schema, Output Schema panels
- All data sourced from `toJSON()` computed fields (whenToUse, safetyNotes, examples)
- Fixed `accounting.getAccountingPeriodStatus` seed: replaced `noInput/noOutput` with proper schemas
- Frontend `AiTool` type extended with v2 fields

### 3. Critical: Anti-Hallucination Safety Fix
- **Problem:** Unimplemented tool keywords matched queries like "unpaid invoices" but produced no data → AI hallucinated realistic financial figures ($29,040 fake AR aging)
- Removed 11 unimplemented intent entries from `tool-intents.config.ts` (inventory 5, sales 2, purchases 1, reports 3)
- Kept only 17 entries for tools with real implementations
- Added NO_DATA_AVAILABLE context injection when no tool data is retrieved
- Added rules 7-10 to system prompt: "NEVER fabricate financial figures"
- Strengthened base skill safety rules
- Added test: intent entries must only reference implemented tools

### 4. Firestore Undefined Fix
- `FirestoreAiToolCatalogRepository.save()` now strips `undefined` values before Firestore write
- Prevents `unavailabilityReason: undefined` error on `POST /platform/ai-tools/sync`

---

## 📋 Remaining Work / Future

| Item | Description | Priority |
|------|-------------|----------|
| Full regression run | Run complete backend/frontend test/build suite before merge | High before merge |
| Option B Phase 4 | Admin UI for editing keywords per tool (no code deploy needed) | ✅ DONE |
| Commit | Commit after developer approval | ✅ DONE |

AI Assistant v2 is now implemented as a guarded, provider-agnostic runtime that extends the existing AI Assistant, Tool System v1, and AI Proposal Sandbox.

### Backend Runtime ✅
- Added provider-agnostic AI tool contract/domain types.
- Extended provider interfaces to support structured tool calls and model capability metadata.
- Added Runtime Guard validation before any model-requested tool can execute.
- Added model capability catalog for known/custom/text-only models.
- Added AI audit service wrapper for non-blocking runtime audit events.
- Extended existing `AiToolCallingOrchestrator` rather than introducing a second orchestrator.
- Preserved deterministic fallback for providers/models without structured tool support.
- Kept write/proposal/draft requests out of direct execution; they clarify or create sandbox proposals only.

### Skill Templates ✅
- Added always-applied Base Skill instructions.
- Added safe domain skill templates.
- Skills are prompt/playbook guidance only; they do not execute tools or bypass permissions.

### Frontend Runtime UI ✅
- Chat now displays runtime model/provider status, warnings, text-only mode, clarification cards, tool-use status, and proposal-created state.
- Proposal list/detail pages now use the correct `aiAssistant` i18n namespace.
- Chat proposal cards translate proposal status and risk labels.
- Super Admin AI Proposal Policy page now has full EN/AR/TR i18n coverage.
- Sidebar `aiProposals` labels exist in all three common locale files.

### Review Fixes ✅
- Fixed reviewer i18n blockers in tenant proposal pages.
- Fixed reviewer i18n gaps in chat proposal cards and Super Admin proposal policy UI.
- Added missing chat quick-action and empty-message locale keys.
- Removed dead quick-action helper code without changing quick-action UX.
- i18n tooltip strings for delete/history controls are now translated.

---

## 🔐 Safety Guarantees

1. **Model output is untrusted.** Structured tool calls are requests only; backend guard decides.
2. **No direct AI writes.** Runtime Guard blocks write/proposal/draft tool execution.
3. **Tenant isolation enforced.** Model-supplied `companyId`/`userId` is rejected; tenant context is server-owned.
4. **RBAC enforced.** Tool execution still requires registered permissions.
5. **Provider-agnostic.** OpenAI-style tool contracts are generated from ERP-owned tool definitions.
6. **Fallback-safe.** Unknown/custom/text-only models use deterministic/text-only behavior with warnings.
7. **Proposal Sandbox remains non-executing.** Accepting a proposal does not create ERP records, post vouchers, or execute business actions.

---

## ✅ Verification

Commands run on 2026-05-07:

- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiRuntimeGuard.test.ts src/tests/application/ai-assistant/OpenAICompatibleProvider.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts src/tests/application/ai-assistant/AiProposalSandbox.test.ts` ✅
  - 4 suites passed
  - 103 tests passed
- Manual-test detour fix after trying “Show me the trial balance summary”:
  - Root cause: Firestore rejected `metadata.toolCallResults: undefined` on chat message persistence.
  - Fix: omit empty `toolCallResults`/`proposal` metadata keys in `SendChatMessageUseCase` and strip nested `undefined` values at the Firestore chat repository boundary.
  - `backend`: `npm run typecheck` ✅
  - `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/FirestoreAiChatRepository.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅
    - 2 suites passed
    - 16 tests passed
  - `backend`: `npm run build` ✅ — updates local `backend/lib` runtime output for Firebase emulator manual testing; do not commit generated `backend/lib` artifacts.

Reviewer status:
- `erp-reviewer` final meaningful review: ✅ PASS
- Last reviewer retry returned empty due to subagent/tool hiccup; direct verification passed afterward.

---

## 📚 Documentation Created / Updated

- `JOURNAL.md`
- `ACTIVE.md`
- `1-TODO/done/70-ai-assistant-runtime-v2.md`
- `docs/architecture/ai-assistant-runtime-v2.md`
- `docs/user-guide/ai-assistant-runtime-v2.md`

---

## 👉 Recommended Next Move

Run a full project regression before merge (`backend` + `frontend` full suites), then push branch and open PR.
