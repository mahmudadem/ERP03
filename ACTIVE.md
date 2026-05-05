# 🎯 Current Focus

**Task:** AI Assistant — Chat-Integrated Tool Calling with Deterministic Intent Detection ✅ COMPLETE
**Started:** 2026-05-06
**Status:** ✅ Done — AI chat now detects user intents and invokes read-only tools to ground responses in real data
**Agent/IDE:** OpenCode (CTO Mode)

---

## What Was Done

### 1. AiToolCallingOrchestrator — Intent Detection + Tool Execution

Created the orchestrator that sits between the chat flow and the tool registry:
- **Intent detection**: Simple keyword matching supporting English, Arabic, and Turkish keywords
- **"trial balance", "ميزان المراجعة", "mizan", etc.** → `accounting.getTrialBalanceSummary`
- **Deterministic only**: No free-form AI function calling. The orchestrator decides, not the AI model.
- **Permission-gated**: All tool executions go through `AiToolRegistry.executeTool()` which checks user permissions
- **Company-scoped**: Tools only see data for the authenticated company

### 2. Tool Result Injection into Chat Context

When a tool is invoked:
- The orchestrator formats the result with strict safety instructions:
  - "Use ONLY the provided data. Do NOT invent balances."
  - "No financial action has been performed."
  - "If data is missing, say data is unavailable."
- The formatted result is injected into the system prompt before sending to the AI provider
- Tool descriptions are also included in the system prompt so the AI knows what tools exist

### 3. SendChatMessageUseCase Integration

Modified the use case to:
- Accept an optional `AiToolCallingOrchestrator` constructor parameter
- Call `detectAndExecute()` before building the provider request
- Inject tool context into the system prompt via `buildSystemPrompt(toolContextMessage)`
- Fall back gracefully if tool execution fails (chat continues without tool data)

### 4. Health Check Cooldown

Added a 60-second cooldown per company to `CheckProviderHealthUseCase`:
- Prevents abuse of the inference check endpoint (costs real tokens)
- Returns 429 with `HEALTH_CHECK_COOLDOWN` code if called too frequently
- `CheckProviderHealthUseCase.resetCooldown()` for testing

### 5. Tests: 15 New + 103 Existing = 118 Total

| Test Suite | Count | Status |
|------------|-------|--------|
| Intent Detection | 4 | ✅ New (keyword matching for EN/AR/TR) |
| Tool Execution Formatting | 4 | ✅ New |
| Health Check Cooldown | 3 | ✅ New |
| System Prompt with Tools | 2 | ✅ New |
| Read-Only Enforcement | 2 | ✅ New |
| All previous tests | 103 | ✅ Unchanged |

## Files Created (1 — Backend)

| File | Purpose |
|------|---------|
| `application/ai-assistant/services/AiToolCallingOrchestrator.ts` | Intent detection + tool execution orchestrator |

## Files Modified (5 — Backend)

| File | Change |
|------|--------|
| `application/ai-assistant/use-cases/SendChatMessageUseCase.ts` | Added `toolOrchestrator` param, tool detection/injection in chat flow |
| `application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts` | Added 60s cooldown per company |
| `api/controllers/ai-assistant/AiAssistantController.ts` | Pass `toolOrchestrator` from DI to `SendChatMessageUseCase` |
| `infrastructure/di/bindRepositories.ts` | Added `aiToolCallingOrchestrator` DI binding |
| `tests/application/ai-assistant/AiAssistantNewFeatures.test.ts` | Added health check cooldown resets |

## Files Created (1 — Tests)

| File | Purpose |
|------|---------|
| `tests/application/ai-assistant/AiToolCalling.test.ts` | 15 new tests for orchestrator, intent detection, formatting, cooldown |

## Intent Detection Keywords

| Tool | English | Arabic | Turkish |
|------|---------|--------|---------|
| `accounting.getTrialBalanceSummary` | trial balance, balance summary, accounting summary, debit credit summary, closing balance, account balances, financial summary | ميزان المراجعة, ملخص الميزان, ميزانية, رصيد, أرصدة | deneme bilançosu, mizan, genel Mizan, borç alacak özeti |

## Build Verification
- ✅ `npx tsc --noEmit` in `backend/` — zero errors
- ✅ `npx tsc --noEmit` in `frontend/` — zero errors
- ✅ All 118 AI assistant tests pass

---

## Recommended Next Step

- **More accounting tools** — P&L summary, balance sheet summary
- **Frontend: Tool results in chat** — Display structured tool data (tables, charts) alongside AI explanation
- **Usage analytics dashboard** — Show per-company usage logs in the frontend
- **Free-form AI function calling** — Eventually let the AI model decide which tools to invoke (requires careful safety review)