# AI Assistant Stream Tool Result Reliability

**Date:** 2026-05-15  
**Status:** Complete  
**Estimate:** 30-45m  
**Actual time:** ~40m  
**Branch:** `feat/phase-1a-core-bugs`

## Technical Developer View

### Task

Investigate why `accounting.getAccountBalance` can work when used alone but show repeated failed tool cards in the AI Assistant multi-round chat flow.

### Root Cause

The tool itself was not the main failure point. The streaming orchestration had three reliability gaps:

1. `aiChatStreamRoute.ts` dropped `error`, `durationMs`, and `round` from `tool_result` SSE events, so the frontend could only show generic `Tool execution failed`.
2. `StreamChatMessageUseCase.ts` fed accumulated prior tool results back into later model rounds instead of only the current round's results, which encouraged repeated same-tool calls.
3. The frontend treated guard approval as execution success, so approved-but-failed tool executions could render as empty successful cards.

### Files Changed

- `backend/src/api/routes/aiChatStreamRoute.ts`
- `backend/src/application/ai-assistant/use-cases/StreamChatMessageUseCase.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/modules/ai-assistant/components/GlobalAiWidget.tsx`
- `frontend/src/modules/ai-assistant/components/AiToolResultsPanel.tsx`
- `docs/architecture/ai-assistant-runtime-v2.md`
- `docs/user-guide/ai-assistant-runtime-v2.md`
- `ACTIVE.md`
- `JOURNAL.md`
- `graphify-out/graph.json`
- `graphify-out/GRAPH_REPORT.md`

### What Changed

- Stream route now forwards tool `error`, `durationMs`, and `round` metadata to the browser.
- Streaming planning loop now passes only current-round structured tool results back to the model.
- Duplicate successful tool calls with the same tool name and arguments reuse the already returned result instead of re-executing the same backend tool.
- Frontend live stream handling now treats `event.error` as an execution failure even if the runtime guard approved the call.
- Account balance results now render as a proper card with balance, debit, credit, account code, account name, and classification.

### Verification

- `backend`: `npx tsc --noEmit` passed.
- `frontend`: `npx tsc --noEmit` passed.
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiToolCatalogSmoke.test.ts` passed, 148/148 tests.
- `backend`: `npm run build` passed.
- `frontend`: `npm run build` passed.
- Root: `npm run graph:update` passed.

### Known Follow-Ups

- Manual browser QA should retest account balance prompts in both the full AI Assistant page and the global widget.
- If users need multiple account-balance cards in one answer, the current frontend dedupe by `toolName` should be upgraded to dedupe by `toolName + normalized arguments`.

## End-User View

The AI Assistant now handles account balance lookups more clearly.

When the assistant checks an account balance, users should see a clean data card with the account balance, debit, credit, account code, account name, and classification. If the tool cannot run, the card should show the real reason instead of a generic failure.

The assistant is also less likely to repeat the same account balance lookup again and again during one answer.
