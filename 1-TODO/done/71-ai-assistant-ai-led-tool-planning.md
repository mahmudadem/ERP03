# 71 — AI Assistant: AI-Led Tool Planning + Keyword Hint Context

Date: 2026-05-08

## Technical Developer View

### Scope Completed

Changed AI Assistant tool orchestration from deterministic keyword auto-execution to AI-led planning with backend-guarded execution.

The Super Admin keyword catalog still matters, but keywords now become model-facing hints to check first. They no longer execute tools directly. The model receives safe tool cards with descriptions, keywords, input schemas, output schemas, examples, and safety notes, then proposes either native provider tool calls or a text fallback plan.

### What Changed

- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
  - Added `ToolKeywordHint`.
  - Added `getKeywordHints()` for advisory keyword matches.
  - Added `buildToolPlanningContext()` to send schema-aware tool cards to the model.
  - Kept `detectAndExecute()` only as deprecated compatibility behavior.
  - Updated prompt text so the model knows backend validation is final.

- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
  - Removed deterministic pre-model tool execution from chat.
  - Added native structured tool-call planning loop for known capable models.
  - Added `ERP_TOOL_PLAN` JSON fallback for unknown/text-only models.
  - Added multi-round tool chaining: after tool results, the model can request another tool or answer.
  - Aggregates tool-call metadata and usage across planning rounds.

- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
  - Added regression test proving keyword matches no longer auto-execute tools.
  - Added guarded `ERP_TOOL_PLAN` test for `openai/gpt-oss-120b:free`-style unknown models.
  - Added native multi-step tool chaining test.

- `backend/src/tests/application/ai-assistant/AiToolCalling.test.ts`
  - Updated prompt expectations for AI-led planning.

### Architecture Decision

The AI does the reasoning:

1. Interpret the user request.
2. Check keyword hints first.
3. Read tool schemas.
4. Decide whether helper/report tools are needed.
5. Request one or more tool calls.

The backend remains the safety boundary:

1. Only allowed tool contracts are exposed.
2. Runtime Guard validates every requested call.
3. Tenant/user identity always comes from backend context.
4. Write/proposal/draft execution is still blocked.
5. Tool results remain factual read-only data.

### Verification

- `backend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` ✅
  - 12 suites passed
  - 331 tests passed
- `backend`: `npm run build` ✅

### Verification Limitation

- `graphify update .` was attempted but failed because `graphify` is not available on PATH in this environment.

### Known Follow-ups

- Add dedicated lookup/helper tools such as account/customer/vendor/item search so the model has better tool-chain building blocks.
- Manual browser test with both a known native tool-capable model and the current unknown/free model.
- Full project regression before merge.

## End-User View

The AI Assistant is now smarter about how it uses ERP data tools.

When you ask a question, it first checks likely tool hints, then decides which safe read-only ERP tools it needs. If it needs one tool to find information for another tool, it can request them step by step.

Example:

1. You ask: “Show account statement for Cash.”
2. The assistant can first use a lookup/report tool to identify the account.
3. Then it can use the account statement tool with the correct code.
4. It answers using only the returned ERP data.

If your wording is unclear, missing important details, or contradictory, the assistant should ask a clarification instead of guessing.

This still does not allow the assistant to create, change, approve, post, or delete ERP records.
