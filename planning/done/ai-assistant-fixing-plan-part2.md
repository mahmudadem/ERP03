# AI Assistant — Fixing Plan Part 2 (Phases 6-9)

**Continues from:** [ai-assistant-fixing-plan.md](./ai-assistant-fixing-plan.md)

---

## Phase 6: UX Improvements

### Task 6.1: Response Streaming (SSE)

**Goal:** Stream AI responses token-by-token to the frontend instead of waiting for the full response.

**Files:**
- Modify: `backend/src/application/ai-assistant/providers/IAiProvider.ts` — Add `chatStream()` method to interface
- Modify: `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts` — Implement streaming
- NEW: `backend/src/api/routes/tenant/ai-assistant/aiChatStreamRoute.ts` — SSE endpoint
- Modify: `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx` — Consume SSE stream

**Backend Changes:**

Add to `IAiProvider`:
```typescript
chatStream?(request: AiProviderRequest): AsyncGenerator<{ type: 'token' | 'tool_call' | 'done' | 'error'; content: string; metadata?: Record<string, unknown> }>;
```

In `OpenAICompatibleProvider`, implement using the OpenAI streaming API (`stream: true`):
```typescript
async *chatStream(request: AiProviderRequest) {
  const response = await fetch(this.endpoint, {
    method: 'POST',
    headers: this.headers,
    body: JSON.stringify({ ...this.buildBody(request), stream: true }),
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Parse SSE chunks and yield tokens
  // Handle tool_call chunks separately
  // Yield { type: 'done' } at the end
}
```

New SSE endpoint `POST /tenant/ai-assistant/chat/stream`:
- Uses the same auth middleware as existing chat endpoint
- Sets headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Runs all the same pre-checks (rate limit, config, routing guard, etc.)
- Instead of waiting for full response, streams tokens via `res.write(`data: ${JSON.stringify(chunk)}\n\n`)`
- Tool call rounds happen server-side; tool results are sent as `event: tool_result` SSE events
- Final metadata sent as `event: metadata` SSE event

**Frontend Changes:**
- Replace the `fetch()` call with `EventSource` or `fetch()` with `ReadableStream` reader
- Display tokens as they arrive in the chat bubble
- Show a typing indicator that transitions to streaming text
- Tool results appear as cards when `event: tool_result` is received

**Acceptance Criteria:**
- User sees tokens appearing one-by-one within 500ms of sending
- Tool call rounds are transparent — user sees "Fetching trial balance..." then the data
- Full response metadata (runtime warnings, tool results) is sent at the end
- Fallback: if streaming fails, fall back to non-streaming endpoint
- Frontend build passes
- Backend `tsc --noEmit` passes

### Task 6.2: Quick Action Buttons

**Goal:** Pre-built prompt buttons on the chat page for common queries.

**Files:**
- Modify: `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- NEW: `frontend/src/modules/ai-assistant/components/QuickActionButtons.tsx`

**Changes:**
Create a component that shows when the conversation is empty (no messages yet):

```typescript
const QUICK_ACTIONS = [
  { label: 'Financial Overview', icon: '📊', prompt: 'Give me an overview of our current financial position' },
  { label: 'Trial Balance', icon: '⚖️', prompt: 'Show me the trial balance summary' },
  { label: 'Top Expenses', icon: '💰', prompt: 'What are our biggest expenses this month?' },
  { label: 'Sales Summary', icon: '🛒', prompt: 'Show me the sales summary for this month' },
  { label: 'Outstanding Invoices', icon: '📋', prompt: 'What unpaid invoices do we have?' },
];
```

- Buttons arranged in a grid/flex layout
- Clicking a button fills the message input and auto-sends
- Buttons disappear once the first message is sent
- i18n: All labels must be in `frontend/src/i18n/` translation files (en, ar, tr)

**Acceptance Criteria:**
- Empty chat shows 5 quick action buttons
- Clicking sends the prompt immediately
- Buttons disappear after first message
- All strings are in i18n files
- Frontend build passes

### Task 6.3: Conversation Titles and History

**Goal:** Auto-generate conversation titles and show a conversation list.

**Files:**
- Modify: `backend/src/domain/ai-assistant/entities/AiChatMessage.ts` — Add conversation title field
- NEW or modify: Repository interface and implementation for conversation metadata
- Modify: `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx` — Add sidebar/drawer with conversation list

**Backend Changes:**
- Add a new collection/document for conversation metadata: `{ conversationId, companyId, userId, title, messageCount, lastMessageAt, createdAt }`
- Title is auto-generated from the first user message: first 50 characters, trimmed to last full word
- Add endpoint: `GET /tenant/ai-assistant/conversations` — returns list of conversations for the user
- Add endpoint: `DELETE /tenant/ai-assistant/conversations/:id` — deletes a conversation and its messages

**Frontend Changes:**
- Add a collapsible sidebar or drawer showing conversation history
- Each conversation shows: title, relative time ("2 hours ago"), message count
- "New Conversation" button at the top
- Click a conversation to load it
- Swipe or button to delete

**Acceptance Criteria:**
- Conversations have auto-generated titles
- User can see a list of past conversations
- User can start a new conversation
- User can delete a conversation
- i18n for all labels
- Frontend and backend build pass

### Task 6.4: Thumbs Up/Down Feedback

**Goal:** Let users rate AI responses for quality tuning.

**Files:**
- Modify: `backend/src/domain/ai-assistant/entities/AiChatMessage.ts` — Add `feedback?: 'positive' | 'negative'` field
- Add endpoint: `PATCH /tenant/ai-assistant/messages/:id/feedback` — body: `{ feedback: 'positive' | 'negative' }`
- Modify: `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx` — Add 👍/👎 buttons on assistant messages

**Changes:**
- Small 👍 👎 icons below each assistant message
- Clicking sends PATCH request to update the message
- Visual feedback: selected icon gets highlighted
- Feedback is stored with the message metadata for later analysis

**Acceptance Criteria:**
- Every assistant message has thumbs up/down
- Feedback is persisted
- Can only vote once per message (toggle is OK)
- Frontend build passes
- Backend `tsc --noEmit` passes

### Task 6.5: Provider Failure UX

**Goal:** Show user-friendly error messages with retry option when AI provider fails.

**Files:**
- Modify: `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`

**Changes:**
When the chat API returns an error:
- **429 (rate limit):** Show "You've reached your daily AI request limit. Try again tomorrow or contact your admin to increase the limit." with NO retry button.
- **401 (auth):** Show "Your AI provider API key is invalid or expired. Please update it in AI Settings." with a link to settings.
- **500/503 (provider down):** Show "The AI provider is temporarily unavailable. Please try again in a moment." with a "Retry" button.
- **408/timeout:** Show "The request took too long. This might happen with complex questions. Try simplifying your question." with a "Retry" button.
- **Generic error:** Show "Something went wrong. Please try again." with a "Retry" button.

The retry button re-sends the last user message.

**Acceptance Criteria:**
- Each error type has a distinct, user-friendly message
- Retry button appears only where appropriate
- No raw error messages shown to users
- i18n for all error strings
- Frontend build passes

### Task 6.6: Simplified Tenant AI Setup

**Goal:** Add a wizard/guided flow for first-time AI setup.

**Files:**
- NEW: `frontend/src/modules/ai-assistant/components/AiSetupWizard.tsx`
- Modify: `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx` — Show wizard if AI not configured

**Changes:**
3-step wizard:
1. **Choose mode:** "Use AI Credits" (credits) or "Bring Your Own Key" (BYOK)
2. **Provider & Model:** Select provider from list → select model. If BYOK: enter API key.
3. **Test & Confirm:** Run quick diagnostic → show result → "Activate AI Assistant"

Show this wizard ONLY when:
- AI module is activated for the company BUT
- No AI settings exist yet (no provider configured)

After wizard completion, save the full `AiProviderConfig` and redirect to chat.

**Acceptance Criteria:**
- First-time setup takes 3 clicks + API key entry
- Diagnostic runs automatically before activation
- After completion, user lands on chat page
- i18n for all wizard strings
- Frontend build passes

---

## Phase 7: Operational Readiness

### Task 7.1: Per-User Rate Limiting

**Files:**
- Modify: `backend/src/application/ai-assistant/services/AiRateLimiterService.ts`
- Modify: `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts` — Add `maxRequestsPerUserPerDay?: number`

**Changes:**
- Add optional `maxRequestsPerUserPerDay` to config (default: no limit = company limit applies)
- In `AiRateLimiterService.checkAndIncrement()`, add a user-level check using a separate counter key: `ai_rate_${companyId}_${userId}_${dateString}`
- Store per-user daily counts in the same settings document or a separate subcollection

**Acceptance Criteria:**
- Company admin can optionally set a per-user daily limit
- Per-user limit is enforced independently of company limit
- Clear error message when user limit reached: "You've reached your personal daily AI limit (X requests). Contact your admin for more."
- `tsc --noEmit` passes

### Task 7.2: Conversation Retention Policy

**Files:**
- NEW: `backend/src/application/ai-assistant/services/AiConversationCleanupService.ts`
- Add a scheduled function or admin endpoint to trigger cleanup

**Changes:**
Create a service that:
- Deletes conversations older than a configurable retention period (default: 90 days)
- Can be triggered via: `POST /platform/ai-assistant/maintenance/cleanup` (Super Admin only)
- Logs how many conversations/messages were deleted
- Never deletes conversations that have proposals in non-archived status

**Acceptance Criteria:**
- Conversations older than 90 days are deleted
- Associated messages are deleted
- Active proposals are NOT affected
- Cleanup is idempotent (running twice doesn't error)
- `tsc --noEmit` passes

### Task 7.3: Company Admin AI Usage Dashboard

**Files:**
- NEW: `frontend/src/modules/ai-assistant/pages/AiUsageDashboardPage.tsx`
- NEW: `backend/src/api/routes/tenant/ai-assistant/aiUsageRoutes.ts`

**Backend Changes:**
Add endpoint: `GET /tenant/ai-assistant/usage/summary` that returns:
```json
{
  "period": "2026-05",
  "totalRequests": 342,
  "totalTokensUsed": 125000,
  "creditsRemaining": 58,
  "requestsByUser": [
    { "userId": "...", "displayName": "Ahmad", "requests": 120 },
    { "userId": "...", "displayName": "Sara", "requests": 89 }
  ],
  "requestsByDay": [
    { "date": "2026-05-01", "count": 15 },
    { "date": "2026-05-02", "count": 23 }
  ],
  "topTools": [
    { "tool": "accounting.getTrialBalanceSummary", "count": 45 },
    { "tool": "reports.getFinancialOverview", "count": 38 }
  ]
}
```

Query from existing `AiUsageLog` collection.

**Frontend Changes:**
- Simple dashboard page with:
  - Credit balance card (if credits mode)
  - Requests this month (number)
  - Requests per day (simple bar chart or list)
  - Top users (table)
  - Top tools used (table)
- Accessible from AI Assistant settings or navigation

**Acceptance Criteria:**
- Company admin can see AI usage for their team
- Data comes from existing usage logs (no new tracking needed)
- Shows credit balance if in credits mode
- i18n for all labels
- Frontend build passes

### Task 7.4: AI Module Activation/Entitlement Flow

**Goal:** Ensure the AI module can be activated/deactivated as part of the company's subscription.

**Files:**
- Check existing module entitlement system in `backend/src/application/` (likely related to bundles/plans)
- Modify AI chat endpoint to check module entitlement before processing

**Changes:**
- Before any AI operation (chat, settings, proposals), verify the company has the AI module activated
- If not activated: return `ApiError.forbidden('The AI Assistant module is not activated for your company. Please activate it in your subscription settings.')`
- This check should be in middleware or at the start of `SendChatMessageUseCase.execute()`

**Acceptance Criteria:**
- Company without AI module activated gets a clear error
- Error message suggests how to activate
- Activating the module enables AI features
- `tsc --noEmit` passes

---

## Phase 8: Testing

### Task 8.1: Integration Smoke Tests with Real Providers

**Files:**
- NEW: `backend/tests/integration/ai-assistant/real-provider-smoke.test.ts`

**Changes:**
Create integration tests that are skipped by default (gated behind `RUN_AI_INTEGRATION=true` env var):

```typescript
describe('AI Provider Integration Smoke Tests', () => {
  const skipUnlessEnabled = process.env.RUN_AI_INTEGRATION !== 'true' ? it.skip : it;

  skipUnlessEnabled('OpenAI-compatible provider returns a valid response', async () => {
    // Use a cheap model (gpt-4o-mini) with a simple prompt
    // Verify: response has content, no errors, token count > 0
  });

  skipUnlessEnabled('Tool calling works with GPT-4o', async () => {
    // Send a message that should trigger tool calling
    // Verify: response contains toolCalls array
  });

  skipUnlessEnabled('Model follows anti-hallucination rule', async () => {
    // Ask a financial question with no tools
    // Verify: response does NOT contain specific dollar amounts
  });
});
```

**Acceptance Criteria:**
- Tests exist and are skipped by default
- Can be run manually with `RUN_AI_INTEGRATION=true npm test`
- At least 3 smoke tests covering: basic response, tool calling, anti-hallucination
- Tests use the cheapest available model to minimize cost

---

## Phase 9: Deployment Preparation

### Task 9.1: Pre-Deployment Checklist

This is NOT a code task. This is a verification checklist the agent must confirm before first deployment:

- [ ] All `tsc --noEmit` passes for both backend and frontend
- [ ] `npm run build` succeeds for both backend and frontend
- [ ] All existing tests pass (`npm test`)
- [ ] No `.env` files or secrets in git
- [ ] Firebase security rules are configured for AI collections
- [ ] AI tool catalog seed runs on startup
- [ ] Auto-certification seed runs on startup (Task 5.1)
- [ ] Credit ledger collection has proper Firestore indexes
- [ ] SSE streaming endpoint is properly configured in Firebase Functions
- [ ] Rate limiting works across multiple function invocations
- [ ] CORS is configured for the streaming endpoint

---

## Summary — Task Dependency Order

```
Phase 1 (Business Model) — Can start immediately
  └── 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 (sequential)

Phase 2 (Security) — Can start in parallel with Phase 1
  └── 2.1 and 2.2 are independent

Phase 3 (Architecture) — Start after Phase 1.5 (uses credit resolver)
  └── 3.1, 3.2 are independent
  └── 3.3 depends on 1.5 and 2.2 being done (so the refactored code is current)
  └── 3.4 is independent (frontend only)

Phase 4 (Prompts) — Can start anytime
  └── 4.1, 4.2, 4.3 are independent

Phase 5 (Certification) — Can start anytime
  └── 5.1 is independent
  └── 5.2 is independent

Phase 6 (UX) — Start after Phase 1 and Phase 3.4
  └── 6.1 is the largest task, start first
  └── 6.2, 6.3, 6.4, 6.5 are independent
  └── 6.6 depends on Phase 1 (credit mode must exist)

Phase 7 (Operational) — Start after Phase 1
  └── 7.1, 7.2, 7.3, 7.4 are mostly independent

Phase 8 (Testing) — Start after Phase 5.2

Phase 9 (Deployment) — Last
```

---

## Audit Protocol

After ALL phases are complete, the CTO agent will audit by:

1. Verifying `tsc --noEmit` passes for backend
2. Verifying `npm run build` passes for frontend
3. Verifying all existing tests pass
4. Checking each task's acceptance criteria
5. Reviewing git diff against this plan — flagging any changes NOT specified in this document
6. Running a manual walkthrough: Super Admin setup → Tenant setup → End user chat

**Any change not specified in this plan requires explicit approval from the product owner.**
