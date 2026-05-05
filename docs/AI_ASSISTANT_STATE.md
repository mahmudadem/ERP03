# AI Assistant Module — Architecture State

> Last updated: 2026-05-06
> Status: Chat-Integrated Tool Calling with Deterministic Intent Detection

---

## Overview

The AI Assistant is an optional installable ERP module that provides advisory-only AI chat capabilities to company users. It cannot create, update, delete, approve, post, or modify any business records. The AI can now access **read-only business data** through registered, permission-checked tools — beginning with `accounting.getTrialBalanceSummary`. Tool selection is **deterministic** (keyword matching), not free-form AI selection.

---

## Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  API Layer (api/)                                        │
│  Controllers → Validators → DTOs → Routes               │
├─────────────────────────────────────────────────────────┤
│  Application Layer (application/ai-assistant/)           │
│  Use Cases → Provider Interface → Provider Factory       │
│  Services (Rate Limiter, Tool Registry, Encryption,      │
│            Tool Orchestrator)                             │
│  Tools (GetTrialBalanceSummaryTool)                      │
├─────────────────────────────────────────────────────────┤
│  Domain Layer (domain/ai-assistant/)                     │
│  Entities: AiProviderConfig, AiChatMessage, AiUsageLog   │
│  Tools: AiTool interface, ToolExecutionContext, AiToolResult │
├─────────────────────────────────────────────────────────┤
│  Infrastructure Layer (infrastructure/)                  │
│  Firestore Repos | Prisma Repos | Crypto Service | DI   │
│  HTTP Client (Axios) | Usage Log Repos                  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Chat Request (with Tool Calling)

```
User → POST /ai-assistant/chat
  → AiAssistantController.sendMessage()
  → SendChatMessageUseCase.execute()
    → AiRateLimiterService.checkAndIncrement() ← config-based rate check
    → settingsRepository.getConfig() ← decrypt apiKey via EncryptionService
    → AiToolCallingOrchestrator.detectAndExecute() ← NEW: intent detection
      → detectIntents(message) ← keyword matching (English, Arabic, Turkish)
      → If intent matched: AiToolRegistry.executeTool() ← permission-gated
      → Format tool result for AI context (with safety instructions)
    → buildSystemPrompt(toolContextMessage) ← injects tool descriptions + data
    → ProviderFactory.getProvider(config)
    → provider.chat(request) ← includes tool data context if available
    → chatRepository.create(message) × 2
    → usageLogRepository.create(log) ← analytics logging (success/failure)
  → Response (safe DTO, no apiKey)
```

### Data Flow: Tool Intent Detection (inside Chat)

```
User message: "Show me the trial balance"
  → AiToolCallingOrchestrator.detectAndExecute()
    → detectIntents(message) ← keyword matching (English/Arabic/Turkish)
    → Match: "trial balance" → accounting.getTrialBalanceSummary
    → AiToolRegistry.executeTool()
      → Check user has 'accounting.reports.trialBalance.view' permission
      → GetTrialBalanceSummaryTool.execute(companyId, userId, asOfDate)
      → Returns sanitized summary DTO (top 20 accounts, totals, balance status)
    → formatToolResultsForContext()
      → Wraps result with safety instructions:
         "Use ONLY the provided data. Do NOT invent balances."
    → Injected into system prompt before sending to AI provider
  → AI provider receives tool data in context → explains result to user
```

### Data Flow: Provider Health Check

```
Admin → POST /ai-assistant/settings/health
  → AiAssistantController.checkProviderHealth()
  → CheckProviderHealthUseCase.execute()
    → settingsRepository.getConfig() ← decrypt apiKey
    → ProviderFactory.getProvider(config)
    → provider.isAvailable() ← network check
    → provider.chat({ messages: "Reply with only: provider-ok" }) ← inference check (safe prompt, no ERP data)
  → Response: { ready, networkOk, inferenceOk, provider, model, reason? }
```

### Data Flow: Tool Execution

```
User → POST /ai-assistant/tools/execute
  → AiAssistantController.executeTool()
  → ExecuteAiToolUseCase.execute()
    → Get user permissions via PermissionChecker
    → AiToolRegistry.executeTool(toolName, context, params)
      → Check user has required permission for the tool
      → Tool.execute(context, params) ← read-only operation
    → Return AiToolResult (success/failure + data/error)
```

---

## File Map

### Backend

| Directory | File | Purpose |
|-----------|------|---------|
| `domain/ai-assistant/entities/` | `AiProviderConfig.ts` | Provider config entity (companyId, provider, model, apiKey, rate limits, enabled) |
| `domain/ai-assistant/entities/` | `AiChatMessage.ts` | Chat message entity (conversation, role, content, metadata) |
| `domain/ai-assistant/entities/` | `AiUsageLog.ts` | Usage log entity (companyId, userId, provider, tokens, status, latency) **(NEW)** |
| `domain/ai-assistant/tools/` | `AiTool.ts` | AiTool interface, ToolExecutionContext, AiToolResult **(NEW)** |
| `application/ai-assistant/providers/` | `IAiProvider.ts` | Provider interface (chat, isAvailable) |
| `application/ai-assistant/providers/` | `MockProvider.ts` | Contextual mock responses for development |
| `application/ai-assistant/providers/` | `OpenAICompatibleProvider.ts` | OpenAI/Ollama provider (real HTTP calls) |
| `application/ai-assistant/providers/` | `ProviderFactory.ts` | Creates providers from config, caches per company |
| `application/ai-assistant/use-cases/` | `SendChatMessageUseCase.ts` | Chat business logic with usage logging **(UPDATED)** |
| `application/ai-assistant/use-cases/` | `AiSettingsUseCase.ts` | Settings CRUD with encryption boundary |
| `application/ai-assistant/use-cases/` | `CheckProviderHealthUseCase.ts` | Provider health check (network + inference) **(NEW)** |
| `application/ai-assistant/use-cases/` | `ExecuteAiToolUseCase.ts` | Tool execution with permission checks **(NEW)** |
| `application/ai-assistant/services/` | `AiRateLimiterService.ts` | Per-company rate limit enforcement (config-based) |
| `application/ai-assistant/services/` | `AiToolRegistry.ts` | Central tool registry with permission gating |
| `application/ai-assistant/services/` | `AiToolCallingOrchestrator.ts` | Intent detection + tool execution in chat flow **(NEW)** |
| `application/ai-assistant/use-cases/` | `SendChatMessageUseCase.ts` | Chat business logic with tool orchestration **(UPDATED)** |
| `application/ai-assistant/tools/` | `GetTrialBalanceSummaryTool.ts` | Read-only trial balance summary tool **(NEW)** |
| `repository/interfaces/ai-assistant/` | `IAiChatRepository.ts` | Chat repo interface |
| `repository/interfaces/ai-assistant/` | `IAiSettingsRepository.ts` | Settings repo interface |
| `repository/interfaces/ai-assistant/` | `IAiUsageLogRepository.ts` | Usage log repo interface **(NEW)** |
| `infrastructure/firestore/repositories/ai-assistant/` | `FirestoreAiChatRepository.ts` | Firestore chat implementation |
| `infrastructure/firestore/repositories/ai-assistant/` | `FirestoreAiSettingsRepository.ts` | Firestore settings implementation |
| `infrastructure/firestore/repositories/ai-assistant/` | `FirestoreAiUsageLogRepository.ts` | Firestore usage log implementation **(NEW)** |
| `infrastructure/prisma/repositories/ai-assistant/` | `PrismaAiChatRepository.ts` | Prisma chat implementation |
| `infrastructure/prisma/repositories/ai-assistant/` | `PrismaAiSettingsRepository.ts` | Prisma settings implementation |
| `infrastructure/prisma/repositories/ai-assistant/` | `PrismaAiUsageLogRepository.ts` | Prisma usage log implementation **(NEW)** |
| `infrastructure/crypto/` | `AesEncryptionService.ts` | AES-256-GCM encryption for API keys |
| `infrastructure/crypto/` | `IEncryptionService.ts` | Encryption service interface |
| `infrastructure/http/` | `AxiosHttpClient.ts` | HTTP client for external providers |
| `infrastructure/http/` | `IHttpClient.ts` | HTTP client interface |
| `infrastructure/di/` | `bindRepositories.ts` | DI container (repos + services + tool registry) |
| `api/controllers/ai-assistant/` | `AiAssistantController.ts` | Thin Express handlers **(UPDATED)** |
| `api/routes/` | `ai-assistant.routes.ts` | Route definitions **(UPDATED)** |
| `api/validators/` | `ai-assistant.validators.ts` | Input validation |
| `api/dtos/` | `AiAssistantDTOs.ts` | Request/response DTOs |
| `modules/ai-assistant/` | `AiAssistantModule.ts` | Module registration **(UPDATED)** |

### Frontend

| Directory | File | Purpose |
|-----------|------|---------|
| `modules/ai-assistant/pages/` | `AiAssistantHomePage.tsx` | Chat interface |
| `modules/ai-assistant/pages/` | `AiAssistantSettingsPage.tsx` | Provider configuration UI |
| `api/` | `aiAssistantApi.ts` | API client (6 methods) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai-assistant/chat` | Send message, get AI response |
| GET | `/ai-assistant/conversations` | List recent conversations |
| GET | `/ai-assistant/conversations/:id/messages` | Get conversation messages |
| DELETE | `/ai-assistant/conversations/:id` | Delete conversation |
| GET | `/ai-assistant/settings` | Get provider config (safe: hasApiKey only) |
| PUT | `/ai-assistant/settings` | Update provider config |
| POST | `/ai-assistant/settings/health` | Test provider connectivity **(NEW)** |
| POST | `/ai-assistant/tools/execute` | Execute read-only AI tool **(NEW)** |

---

## Permissions

| Permission | Code | Description |
|------------|------|-------------|
| Use AI Chat | `ai-assistant.chat.use` | Send messages, execute tools |
| View AI Chat History | `ai-assistant.chat.view` | View conversation history |
| View AI Settings | `ai-assistant.settings.view` | View provider config |
| Manage AI Settings | `ai-assistant.settings.manage` | Configure provider, API key, rate limits |
| Test Provider Connectivity | `ai-assistant.settings.health` | Test provider network and inference **(NEW)** |
| Accounting: Trial Balance | `ai-assistant.tools.accounting.trial-balance` | AI trial balance summary tool **(NEW)** |

---

## AI Tool Architecture

### Design Principles

1. **ALL tools are READ-ONLY** — they never create, update, delete, approve, post, or reverse anything
2. **Permission-gated** — each tool requires a specific permission (e.g., `accounting.reports.trialBalance.view`)
3. **Company-scoped** — tools only see data for the authenticated company
4. **Sanitized DTOs** — raw domain entities are never returned to the AI. Only summary data
5. **Registry-based** — tools are registered in `AiToolRegistry` and looked up by name

### Available Tools

| Tool Name | Permission | Module | Description |
|-----------|------------|--------|-------------|
| `accounting.getTrialBalanceSummary` | `accounting.reports.trialBalance.view` | accounting | Returns trial balance summary (totals, top 20 accounts, balance status) |

### Tool Result Format

```typescript
{
  success: boolean;
  data: Record<string, unknown> | null;
  error?: string;
  errorCode?: string;  // 'PERMISSION_DENIED', 'UNKNOWN_TOOL', 'TOOL_EXECUTION_ERROR'
}
```

### How to Add a New Tool

1. Create a class implementing `AiTool` in `application/ai-assistant/tools/`
2. Register it in `bindRepositories.ts` → `aiToolRegistry`
3. Add the permission to `AiAssistantModule.ts`
4. Add the permission to `seedOnboardingData.ts`
5. Add tests

---

## Usage Logging

### Design

- **Analytics ONLY**: Usage logs are NOT used for rate limiting
- **Rate limiting** remains config-based (`AiProviderConfig.dailyRequestCount`)
- Every request (success or failure) is logged after completion
- Logging failure does NOT block the chat response or mask the original error

### AiUsageLog Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID with `aiul_` prefix |
| companyId | string | Company ID |
| userId | string | User ID |
| providerType | string | 'mock', 'openai_compatible', 'ollama' |
| model | string | Model identifier |
| messageCount | number | Number of messages in context |
| promptTokens | number? | Tokens in prompt (if provider reports) |
| completionTokens | number? | Tokens in completion (if provider reports) |
| totalTokens | number? | Total tokens used |
| status | 'success' \| 'failure' | Request result |
| errorCode | string? | Normalized error code on failure |
| latencyMs | number? | Response time in milliseconds |
| createdAt | Date | Timestamp |

---

## Provider Health Check

### Design

- **Network check**: Calls `provider.isAvailable()` (GET /v1/models for OpenAI-compatible)
- **Inference check**: Sends safe prompt "Reply with only: provider-ok" with max 10 tokens
- **NO ERP data** is ever sent to the provider during health check
- **NO API key** is exposed in the response
- **On-demand only**: Costs real tokens for paid providers — use sparingly
- **Safe prompt**: The inference check message is a fixed string, never user-generated

---

## Security Model

### API Key Lifecycle

1. **Input**: User submits apiKey via PUT `/ai-assistant/settings`
2. **Encryption**: `AiSettingsUseCase` encrypts the key via `IEncryptionService.encrypt()` before passing to repository
3. **Storage**: Repository stores the encrypted key in `apiKey` field (Firestore or Prisma)
4. **Decryption**: On `getConfig()`, the use case decrypts via `IEncryptionService.decrypt()` to rehydrate the domain entity
5. **Display**: `AiProviderConfig.toJSON()` returns `hasApiKey: boolean` — the raw key is NEVER exposed to the frontend

### Rate Limiting (Config-Based)

- **Limit**: Per-company daily limit from `AiProviderConfig.maxRequestsPerDay` (default: 100)
- **Mechanism**: `AiRateLimiterService.checkAndIncrement()` uses `dailyRequestCount`/`dailyRequestDate` fields in config
- **Integrity guarantee**: Deleting chat conversations does NOT affect the daily count
- **IMPORTANT**: Rate limiting uses config-based counting, NOT usage logs. See Design Decisions §7.

---

## Known TODOs

| Priority | Item | Status |
|----------|------|--------|
| P0 | ~~Encrypt API keys at rest~~ | ✅ Done |
| P0 | ~~Rate limiting per company per day~~ | ✅ Done |
| P1 | ~~Harden OpenAICompatibleProvider~~ | ✅ Done |
| P1 | ~~Minimum tests~~ | ✅ Done (6 test files, 103 tests) |
| P1 | ~~OpenAI-compatible HTTP client~~ | ✅ Done |
| P1 | ~~Provider presets UI~~ | ✅ Done |
| P1 | ~~Usage logging~~ | ✅ Done |
| P1 | ~~Provider health check~~ | ✅ Done |
| P1 | ~~AI tool architecture~~ | ✅ Done |
| P1 | ~~Accounting trial balance tool~~ | ✅ Done |
| P1 | ~~Chat-integrated tool calling~~ | ✅ Done |
| P1 | ~~Health check cooldown~~ | ✅ Done (60s per company) |
| P1 | BYOK encryption key rotation | 🔜 Future |
| P2 | Conversation TTL / archival | 🔜 Future |
| P2 | Usage analytics dashboard | 🔜 Future |
| P2 | Streaming responses | 🔜 Future |
| P2 | More accounting tools (P&L, balance sheet) | 🔜 Future |
| P2 | Free-form AI tool selection (function calling) | 🔜 Future |
| P3 | Move ProviderFactory to DI (not static) | 🔜 Future |
| P3 | Centralized env config module | 🔜 Future |

---

## Design Decisions

1. **Encryption in use case, not repository**: Repositories store/retrieve whatever they're given. `AiSettingsUseCase` is the encryption boundary — it encrypts before save and decrypts after load. This keeps repos DB-agnostic.

2. **`toJSON()` is always safe**: `toJSON()` never includes raw apiKey. `toPersistenceJSON()` is for DB storage only.

3. **Rate limiting in application layer**: `AiRateLimiterService` is a pure application service, not Express middleware. It uses `checkAndIncrement()` to atomically read, check, increment, and save the daily request count in `AiProviderConfig`. The count is stored in the config document (not computed from message queries), so deleting conversations does NOT reset the limit.

4. **OpenAICompatibleProvider throws on invalid config**: Instead of sending a confusing placeholder message, it validates config in the constructor and returns safe error responses.

5. **Advisory-only AI**: The system prompt in `SendChatMessageUseCase` enforces that AI may only advise, not act. This is enforced at the application layer. Tools add read-only data access, not write capabilities.

6. **No init guard for AI module**: AI Assistant works immediately after install — no setup wizard needed.

7. **Rate limiting uses config-based counting, NOT usage logs**: The daily request count lives in `AiProviderConfig.dailyRequestCount`/`dailyRequestDate`. Usage logs (`AiUsageLog`) are analytics-only — they track per-request details (tokens, latency, errors) for dashboards and billing, but MUST NOT be used for rate limiting. This preserves the integrity guarantee that deleting data cannot reset the rate limit.

8. **Usage logging is non-blocking**: If `usageLogRepository.create()` fails, the error is caught and logged, but the chat response is still returned to the user. The original error (if the provider call itself failed) is re-thrown after logging usage.

9. **Health check uses safe prompt only**: The provider health check sends "Reply with only: provider-ok" with max 10 tokens and temperature 0. No ERP data, no user data, no API key is exposed in the response.

10. **Tool architecture is permission-gated**: Each tool requires a specific permission (e.g., `accounting.reports.trialBalance.view`). The `AiToolRegistry` checks permissions before execution. The `ExecuteAiToolUseCase` adds an additional layer with user context.

11. **Tool results are sanitized DTOs**: `GetTrialBalanceSummaryTool` returns only a summarized view (top 20 accounts by balance, totals, and balance status). Raw domain entities and full chart of account details are never exposed to the AI.

12. **Tool calling is deterministic, not free-form**: `AiToolCallingOrchestrator` uses keyword matching (English, Arabic, Turkish) to detect user intents. The AI does NOT decide which tool to call — it receives tool data as context. This prevents arbitrary code execution and ensures only registered, permission-checked tools are invoked.

13. **Health check has a 60-second cooldown per company**: `CheckProviderHealthUseCase` enforces a 60-second cooldown between health checks per company. This prevents abuse of the inference check endpoint (which costs real tokens). The cooldown is stored in-memory (not persisted across restarts).

14. **Tool data in AI context has strict safety instructions**: When tool results are injected into the system prompt, they include: "Use ONLY the provided data. Do NOT invent balances." and "No financial action has been performed." This prevents the AI from fabricating numbers or suggesting actions.

---

## Bug Fixes (Post-Stabilization Testing)

1. **Firestore `countToday()` date comparison**: Fixed ISO string vs Date comparison.
2. **Rate limit double-counting**: Fixed to count only `role='user'` messages.
3. **Rate limit integrity**: Moved counter to `AiProviderConfig.dailyRequestCount` — now independent of message storage.
4. **Frontend timeout**: Changed from 10s to 30s to accommodate slow AI providers.
5. **API double-unwrapping**: Fixed `response.data.data` to `response as unknown as T` since the interceptor already unwraps.