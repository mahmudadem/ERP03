# 73 - AI Assistant: Conversation Context First Rules

Date: 2026-05-09

Estimate: 30-45m
Actual: ~30m

## Technical Developer View

### Scope Completed

Updated the AI Assistant runtime rules so the model treats every message as part of an ongoing conversation instead of a fresh isolated request.

This keeps the model responsible for reasoning and explanation while giving it enough context to reuse previously fetched ERP data before deciding whether another read-only tool call is needed.

### What Changed

- `backend/src/application/ai-assistant/skills/base-orchestration.skill.ts`
  - Replaced narrow intent rules with context-first orchestration rules.
  - Added guidance to reuse existing conversation context and prior tool results.
  - Added broad clarification behavior: ask only when the user's intent or required extra information is truly missing, contradictory, or ambiguous.

- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
  - Added a compact `[RECENT ERP DATA FROM THIS CONVERSATION]` prompt block built from recent assistant message `metadata.toolResults`.
  - Injects previous tool-result data before tool planning context so the model can decide whether the current follow-up can be answered without another tool.
  - Updated the multi-round tool continuation instruction to combine current request, prior context, and new tool results.

- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
  - Updated planning rules to emphasize ongoing conversation context, prior tool results, minimal extra tool use, and ambiguity-first clarification.

- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
  - Added regression coverage proving prior tool-result metadata is injected into the model prompt for follow-up messages.

- `docs/architecture/ai-assistant-runtime-v2.md`
  - Documented the conversation context update and implementation behavior.

- `docs/user-guide/ai-assistant-runtime-v2.md`
  - Added a user-facing explanation for follow-up questions.

### Acceptance Criteria Met

- The model prompt now explicitly says chat is continuous context.
- The model is told to understand intent before answering or calling tools.
- The model is told to answer from existing fetched data when sufficient.
- The model is told to call additional read-only tools only when more ERP data is needed.
- The model is told to ask clarification before answering when intent or required extra information is ambiguous.
- Previous tool-result metadata is available to the next model turn.

### Verification

- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts src/tests/application/ai-assistant/AiToolCalling.test.ts` ✅
  - 2 suites passed
  - 32 tests passed
- `backend`: `npm run typecheck` ✅

### Known Follow-Ups

- Manual browser retest with `gpt-4o-mini`:
  - ask for Trial Balance,
  - ask Arabic follow-ups,
  - ask about an account from the prior tool result,
  - confirm it reuses prior data and calls account statement only when movement details are needed.
- If responses are still weak, improve tool output schemas and domain skill wording for accounting field meanings.

## End-User View

The AI Assistant should now behave more like a continuous conversation.

If you ask for a report and then ask a follow-up question, it should remember the report data it already fetched in that chat. It should answer from that data when possible, use another safe read-only tool only when more ERP data is needed, and ask a clarification only when your request is genuinely unclear.

This does not allow the assistant to create, change, post, approve, or delete ERP records. It only improves how it understands and explains already fetched information.
