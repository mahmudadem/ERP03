# AI Assistant — Manual Test Guide

**Created:** 2026-05-14
**Purpose:** Walk through every testable feature with the developer, record results live
**Mode:** Step-by-step. Stop on any ❌. Discuss before moving on.

---

## Pre-Requisites

- [ ] Backend is running: `npm run dev` in `backend/`
- [ ] Frontend is running: `npm run dev` in `frontend/`
- [ ] Logged in as a user with admin-level permissions
- [ ] AI Assistant module is enabled for your company

> By default the system uses the **Mock Provider** (no API key needed). Most tests work with mock. Phase 8 needs a real OpenAI/Anthropic key.

---

## Phase 1: Global Widget — Basic Rendering

**Goal:** Confirm the floating AI widget appears and behaves correctly across the app.

**TEST 1 : 1.1 Widget toggle button visible**
1. Navigate to any ERP page (Dashboard, Accounting, Sales, etc.)
2. Look at the bottom-right corner of the screen
- ✅ Expected: A floating circular button (chat icon) is visible
- Result: passed
- Notes:

**TEST 2 : 1.2 Widget opens and closes**
1. Click the floating chat button
2. A chat panel should slide up / appear
3. Click the close/minimize button on the panel
4. The panel should close, toggle button remains
- ✅ Expected: Panel opens and closes cleanly, no leftover elements
- Result: passed
- Notes:

**TEST 3 : 1.3 Widget persists across navigation**
1. Open the chat widget and send a test message
2. Navigate to a different ERP page (e.g., Dashboard → Accounting)
3. Check if the widget is still open with the same conversation
- ✅ Expected: Widget stays open, messages preserved during navigation
- Result: passed
- Notes:

**TEST 4 : 1.4 RTL layout (Arabic)**
1. Switch the UI language to Arabic
2. Open the AI chat widget
3. Type a message in Arabic
- ✅ Expected: Widget flips to RTL, input is right-aligned, buttons don't overlap
- Result: ⬜
- Notes: the widget text are is going RTL not the widget frame it is not  going LTR 

---

## Phase 2: Quick Action Buttons

**Goal:** Confirm the predefined quick-action buttons render and work.

**TEST 5 : 2.1 Quick actions visible on empty chat**
1. Open a new conversation (no messages yet) in the widget or the AI Assistant page
2. Look for 5 quick action cards/buttons
- ✅ Expected: 5 buttons visible — Financial Overview, Trial Balance, Top Expenses, Sales Summary, Outstanding Invoices
- Result: ⬜
- Notes:

**TEST 6 : 2.2 Quick action click sends message**
1. Click any quick action button (e.g., "Financial Overview")
2. Watch the chat area
- ✅ Expected: The button's prompt text appears as a user message, and the AI responds
- Result: ⬜
- Notes:

**TEST 7 : 2.3 Quick actions disappear after first message**
1. After clicking a quick action (T2.2), check if the buttons are gone
- ✅ Expected: Quick action buttons no longer visible once conversation has messages
- Result: ⬜
- Notes:

---

## Phase 3: Chat — Basic Send/Receive (Mock Provider)

**Goal:** Confirm messages send and responses come back from the mock provider.

**TEST 8 : 3.1 Send a simple message**
1. Type "Hello, what can you help me with?" in the chat input
2. Press Enter or click Send
- ✅ Expected: User message appears. AI responds with a mock response that includes "[Mock AI Assistant]" prefix
- Result: ⬜
- Notes:

**TEST 9 : 3.2 Contextual mock response**
1. Type "Tell me about my invoices"
2. Press Enter
- ✅ Expected: Mock response mentions invoices/sales (contextual keyword matching)
- Result: ⬜
- Notes:

**TEST 10 : 3.3 Multi-turn conversation**
1. Send message #1: "What modules does the ERP have?"
2. Wait for response
3. Send message #2: "Tell me more about Accounting"
4. Wait for response
- ✅ Expected: Both messages and responses appear in correct order, scrolled to bottom
- Result: ⬜
- Notes:

**TEST 11 : 3.4 Empty message prevention**
1. Click Send with an empty input field
- ✅ Expected: Nothing happens — no empty message is sent
- Result: ⬜
- Notes:

**TEST 12 : 3.5 Language matching (Arabic)**
1. Switch to Arabic language
2. Open a new chat
3. Type "مرحبا كيف يمكنك مساعدتي؟"
- ✅ Expected: Response comes back (mock responds in English, but UI should display correctly in RTL)
- Result: ⬜
- Notes:

---

## Phase 4: Conversation Management

**Goal:** Verify conversation creation, listing, switching, and deletion.

**TEST 13 : 4.1 Auto-generated conversation title**
1. Start a new conversation and send "What is double entry bookkeeping?"
2. Check the conversation sidebar/list
- ✅ Expected: A conversation appears in the list with a title derived from the first message
- Result: ⬜
- Notes:

**TEST 14 : 4.2 Conversation history sidebar**
1. Look for a sidebar or conversation list in the AI widget/page
2. Create 2-3 conversations by starting new chats with different messages
- ✅ Expected: All conversations appear in a list with titles and timestamps
- Result: ⬜
- Notes:

**TEST 15 : 4.3 Switch between conversations**
1. Click on a different conversation in the sidebar
2. Check the chat area
- ✅ Expected: Messages from the selected conversation load correctly
- Result: ⬜
- Notes:

**TEST 16 : 4.4 Delete conversation**
1. Find a delete/trash button on a conversation in the sidebar
2. Click it and confirm deletion
- ✅ Expected: Conversation is removed from the list
- Result: ⬜
- Notes:

---

## Phase 5: Feedback (Thumbs Up / Down)

**Goal:** Verify the per-message feedback mechanism.

**TEST 17 : 5.1 Feedback buttons visible**
1. Send a message and wait for the AI response
2. Hover over or look below the AI response bubble
- ✅ Expected: 👍 and 👎 icons/buttons are visible on the AI response
- Result: ⬜
- Notes:

**TEST 18 : 5.2 Give thumbs up**
1. Click the 👍 button
2. Check if it highlights/stays selected
- ✅ Expected: Thumbs up is visually selected. No error.
- Result: ⬜
- Notes:

**TEST 19 : 5.3 Toggle feedback**
1. Click 👎 after having clicked 👍
2. Check which is now active
- ✅ Expected: Previous selection is deselected, new selection is active
- Result: ⬜
- Notes:

---

## Phase 6: Settings Page

**Goal:** Verify the AI Assistant settings page renders and functions.

**TEST 20 : 6.1 Settings page loads**
1. Navigate to the AI Assistant settings page (Settings > AI Assistant or via module menu)
- ✅ Expected: Settings page loads with provider configuration, model selection, and context settings
- Result: ⬜
- Notes:

**TEST 21 : 6.2 Current provider displayed**
1. On the settings page, check the current provider section
- ✅ Expected: Shows "mock" as the current provider (or whichever is configured)
- Result: ⬜
- Notes:

**TEST 22 : 6.3 Runtime mode selector**
1. Look for the runtime mode selector (BYOK / Credits / Disabled)
2. Switch between modes
- ✅ Expected: Selector responds. BYOK shows API key field. Credits shows credit balance.
- Result: ⬜
- Notes:

**TEST 23 : 6.4 Context budget settings**
1. Find the conversation context mode setting (Minimal / Balanced / Deep)
2. Change it and save
- ✅ Expected: Setting saves without error. Page reflects the new value after refresh.
- Result: ⬜
- Notes:

**TEST 24 : 6.5 Credit balance card**
1. If mode is CREDITS, check for a credit balance card
- ✅ Expected: Shows current credit balance (may be 0 for new tenants)
- Result: ⬜ (or SKIPPED if BYOK mode)
- Notes:

---

## Phase 7: Error Handling

**Goal:** Verify the system handles errors gracefully.

**TEST 25 : 7.1 Rate limit burst**
1. Send messages rapidly (try to send 20+ messages within 60 seconds)
- ✅ Expected: After ~20 rapid messages, you get a "sending messages too quickly" error with a retry timer
- Result: ⬜
- Notes:

**TEST 26 : 7.2 Concurrent request lock**
1. Send a message
2. Immediately send another before the first response arrives
- ✅ Expected: Second message either queues or shows a "still processing" indicator — no duplicate requests
- Result: ⬜
- Notes:

**TEST 27 : 7.3 Error display component**
1. (If possible) temporarily misconfigure the provider endpoint to an invalid URL
2. Send a message
- ✅ Expected: A user-friendly error message appears (not a raw stack trace)
- Result: ⬜ (or SKIPPED)
- Notes:

---

## Phase 8: Real Provider (Optional — Needs API Key)

**Goal:** Test with a real AI provider (OpenAI, Anthropic, etc.). Skip if no API key.

**TEST 28 : 8.1 Configure real provider**
1. Go to AI Assistant Settings
2. Set provider to "openai_compatible"
3. Enter your API endpoint and API key
4. Select a model (e.g., gpt-4o-mini)
5. Save settings
- ✅ Expected: Settings save. Health check returns positive status.
- Result: ⬜ (or SKIPPED)
- Notes:

**TEST 29 : 8.2 Real AI response**
1. With real provider configured, send "What is a trial balance?"
- ✅ Expected: Real AI response (no "[Mock AI Assistant]" prefix). Proper markdown formatting.
- Result: ⬜ (or SKIPPED)
- Notes:

**TEST 30 : 8.3 Tool calling (real provider only)**
1. With real provider, send "Show me the trial balance"
2. Watch for tool execution indicators
- ✅ Expected: AI calls GetTrialBalanceSummary tool, retrieves data, presents it in response
- Result: ⬜ (or SKIPPED)
- Notes:

**TEST 31 : 8.4 SSE streaming (real provider only)**
1. Send a message to the real provider
2. Watch how the response appears
- ✅ Expected: Response streams in token-by-token (not all at once), like ChatGPT
- Result: ⬜ (or SKIPPED)
- Notes:

**TEST 32 : 8.5 Language matching (real provider)**
1. Send "ما هو ميزان المراجعة؟" (Arabic: What is a trial balance?)
- ✅ Expected: AI responds in Arabic (matching user's language per Rule 17 in system prompt)
- Result: ⬜ (or SKIPPED)
- Notes:

---

## Phase 9: Usage Dashboard

**Goal:** Verify the admin usage dashboard works.

**TEST 33 : 9.1 Dashboard page loads**
1. Navigate to the AI Usage Dashboard page
- ✅ Expected: Page loads with usage summary (requests today, total conversations, etc.)
- Result: ⬜
- Notes:

**TEST 34 : 9.2 Usage reflects activity**
1. Note the current request count
2. Send a few messages in the chat
3. Refresh the dashboard
- ✅ Expected: Request count has increased
- Result: ⬜
- Notes:

---

## Phase 10: Proposal Sandbox

**Goal:** Verify the proposal sandbox endpoints and UI work.

**TEST 35 : 10.1 Proposal list page loads**
1. Navigate to the AI Proposals page
- ✅ Expected: Page loads (may be empty if no proposals exist yet)
- Result: ⬜
- Notes:

**TEST 36 : 10.2 No proposals created by mock**
1. With mock provider, send "Create a journal entry for rent $5000"
- ✅ Expected: Mock responds with advisory text. No actual proposal is created.
- Result: ⬜
- Notes:

---

## Results Summary

- Phase 1 — Widget Rendering: _ / 4
- Phase 2 — Quick Actions: _ / 3
- Phase 3 — Chat Basic: _ / 5
- Phase 4 — Conversation Mgmt: _ / 4
- Phase 5 — Feedback: _ / 3
- Phase 6 — Settings: _ / 5
- Phase 7 — Error Handling: _ / 3
- Phase 8 — Real Provider: _ / 5
- Phase 9 — Usage Dashboard: _ / 2
- Phase 10 — Proposals: _ / 2
- **TOTAL: _ / 36**

---

## Blockers Found

_(Add blockers during the testing session here)_

---

## Session Notes

_(Add notes during the testing session here)_
