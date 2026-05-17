# AI Assistant — HTTP Client + Provider Presets + Timeout Fix

**Date:** 2026-05-06
**Agent:** OpenCode (CTO Mode)
**Status:** ✅ Complete

---

## Summary

Replaced the placeholder OpenAI-compatible provider with a real HTTP client that makes actual API calls to OpenAI, OpenRouter, Groq, and Ollama. Added a provider presets dropdown in the settings UI. Fixed a frontend timeout that was killing AI chat requests at 10 seconds.

---

## Technical Developer View

### What Changed

**Backend — HTTP Client Infrastructure (4 new files, 10 modified):**

The `OpenAICompatibleProvider` was a stub that returned a message saying "HTTP client not yet implemented." It now makes real HTTP calls via a Clean Architecture `IHttpClient` interface:

- `IHttpClient` interface in `infrastructure/http/` — follows same pattern as `IEncryptionService`/`AesEncryptionService`
- `AxiosHttpClient` implementation — axios with per-request timeout, error classification (401→auth, 429→rate limit, 503→unavailable, 5xx→server error), URL sanitization, Ollama support (skips Authorization for `local-no-key`)
- `ProviderErrors.ts` in `errors/` — `ProviderError` extends `AppError` (not plain `Error`) so the Express error handler catches them and returns correct HTTP status codes
- `errorHandler.ts` updated with `getProviderErrorStatus()` function mapping error codes to 401/429/503/502
- `ErrorCodes.ts` — Added `AI_PROVIDER_ERROR`, `AI_PROVIDER_UNAVAILABLE`, `AI_PROVIDER_AUTH_ERROR`, `AI_PROVIDER_RATE_LIMIT`
- DI wiring: `IHttpClient` injected through `ProviderFactory` → `SendChatMessageUseCase` → `AiAssistantController`
- `backend/package.json` added `axios` dependency

**Frontend — Provider Presets (5 modified files):**

Replaced 3 radio buttons with a `<select>` dropdown offering 6 presets. Each preset auto-fills the endpoint URL, default model, and shows API key requirement:

| Preset | Backend Provider | Endpoint | Default Model | API Key? |
|--------|------------------|----------|---------------|----------|
| Mock (Development) | `mock` | — | `mock-assistant` | No |
| OpenAI | `openai_compatible` | `https://api.openai.com/v1` | `gpt-4o` | Yes |
| OpenRouter | `openai_compatible` | `https://openrouter.ai/api/v1` | `openai/gpt-oss-120b:free` | Yes |
| Groq | `openai_compatible` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Yes |
| Ollama (Local) | `ollama` | `http://localhost:11434/v1` | `llama3` | No |
| Custom | `openai_compatible` | *(user types)* | *(user types)* | Yes |

- Presets lock the endpoint field (switch to "Custom" to edit)
- Model field is always editable
- Loaded settings resolve back to matching preset automatically
- React best practices: hoisted static data, useMemo for derived state, useCallback for handlers, early returns, accessibility labels (htmlFor/id)

**Frontend — Timeout Fix:**
- `frontend/src/api/client.ts` — Changed axios timeout from 10000ms → 30000ms. AI providers (especially OpenRouter) take 15-30s for large model responses. The 10s timeout was killing requests before they completed, causing "timeout of 10000ms exceeded" errors.

### How the HTTP Request Flows

```
User sends message → AiAssistantController.sendMessage()
  → SendChatMessageUseCase (checks rate limit, builds system prompt)
    → ProviderFactory.getProvider(config, httpClient)
      → OpenAICompatibleProvider (if openai_compatible/ollama)
        → IHttpClient.request({
            url: 'https://openrouter.ai/api/v1/chat/completions',
            method: 'POST',
            headers: { Authorization: 'Bearer sk-...', Content-Type: 'application/json' },
            body: { model, messages, max_tokens, temperature, stream: false },
            timeoutMs: 30000
          })
        → AxiosHttpClient → external API
        ← Response: { choices: [...], usage: { total_tokens: 150 } }
      ← Maps to AiProviderResponse { content, model, provider, tokenCount, metadata }
  ← Saves user message + assistant response to DB
  ← Returns JSON to frontend
```

### How Provider Errors Reach the User

```
Provider returns 401 → AxiosHttpClient classifies → ProviderAuthError (extends AppError)
  → Error handler catches instanceof AppError
  → getProviderErrorStatus(AI_PROVIDER_AUTH_ERROR) → 401
  → Frontend sees: "Authentication failed. Please check your API key in AI Assistant settings."

Provider returns 429 → ProviderRateLimitError → 429 → "AI provider rate limit exceeded."
Provider unreachable → ProviderUnavailableError → 503 → "Could not reach AI provider."
Other errors → ProviderError → 502 → "AI provider error (...)"
```

---

## End-User View

### What Changed

**AI Assistant Chat — Now Works with Real AI Providers:**
- The AI Assistant can now connect to real AI services like OpenAI, OpenRouter, and Groq — not just the mock developer mode.
- To configure: Go to **AI Assistant → Settings**, select a provider from the dropdown (OpenAI, OpenRouter, Groq, Ollama, or Custom), enter your API key, and save.
- Each provider preset auto-fills the correct endpoint URL and default model.
- If you were seeing "timeout of 10000ms exceeded" errors, that's now fixed — the system waits up to 30 seconds for AI responses.

**Settings Page — Provider Presets:**
- Replaced the old 3-option radio selection with a clean dropdown offering 6 providers.
- **Mock (Development):** Returns simulated responses. No API key needed. Good for testing.
- **OpenAI:** Uses OpenAI's API (GPT-4o). Get an API key from platform.openai.com.
- **OpenRouter:** Access 200+ models from multiple providers. Get an API key from openrouter.ai.
- **Groq:** Ultra-fast inference with Llama and Mixtral models. Get an API key from console.groq.com.
- **Ollama (Local):** Run AI models locally on your machine. No cloud API key needed, but Ollama must be running.
- **Custom:** Enter any OpenAI-compatible endpoint URL, model name, and API key manually.

**Error Messages (Improved):**
- Bad API key → "Authentication failed. Please check your API key."
- Rate limited → "AI provider rate limit exceeded. Please wait a moment."
- Provider unreachable → "Could not reach AI provider. Please verify the endpoint URL."
- Server error → "AI provider server error. Please try again later."

---

## Files Changed

### Created (4)
- `backend/src/infrastructure/http/IHttpClient.ts`
- `backend/src/infrastructure/http/AxiosHttpClient.ts`
- `backend/src/infrastructure/http/index.ts`
- `backend/src/errors/ProviderErrors.ts`

### Rewritten (2)
- `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts`
- `backend/src/tests/application/ai-assistant/OpenAICompatibleProvider.test.ts`

### Modified (12)
- `backend/src/application/ai-assistant/providers/ProviderFactory.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/errors/errorHandler.ts`
- `backend/src/errors/ErrorCodes.ts`
- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
- `frontend/src/api/client.ts`

### Re-export Shim (1)
- `backend/src/infrastructure/http/ProviderErrors.ts`

### Dependencies Added (1)
- `axios` (^1.16.0) in `backend/package.json`

---

## Verification

- ✅ 82 AI assistant backend tests pass (was 67)
- ✅ `npx tsc --noEmit` backend — zero errors
- ✅ `npx tsc --noEmit` frontend — zero errors
- ✅ Code review: 2 medium issues found and fixed (error handler integration + architecture layer)
- ✅ Frontend timeout: 10s → 30s resolves "timeout exceeded" errors

---

## Known Issues & Rabbit Holes

1. **Rate limit consumed on failed requests** — The daily rate limit counter increments before the HTTP call. If the external provider fails (timeout, auth error), the quota slot is still consumed. This is by design to prevent retry abuse but could be improved in a future iteration by decrementing on failure.

2. **Streaming not supported** — The entire stack (IAiProvider interface, controller, frontend chat UI) is designed for single-request/single-response. Adding SSE streaming would require: a new `/chat/stream` route with text/event-stream, changes to IAiProvider, a streaming-capable frontend component using EventSource, and updates to the controller. This is a v2 enhancement.

3. **OpenRouter free tier limitations** — The `openai/gpt-oss-120b:free` model on OpenRouter is rate-limited and may be slower than paid models. Users can change the model in settings after selecting a preset.