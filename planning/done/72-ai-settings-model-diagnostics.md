# 72 - AI Settings: Model Diagnostics

Date: 2026-05-08

## Technical Developer View

### Scope Completed

Added a real model diagnostics flow to the AI Assistant Settings provider tab so admins can tell whether the saved provider/model is usable for chat and ERP tool planning.

### What Changed

- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
  - Extended the existing health check result with model capability profile data.
  - Added a native OpenAI-style `tool_calls` probe using a private `diagnostics_ping` tool contract.
  - Added a guarded `ERP_TOOL_PLAN` fallback probe when native tool calling is unavailable or fails.
  - Added per-check statuses and a recommended mode: native tool calling, text-plan, text-only, or unavailable.

- `backend/src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts`
  - Covers native tool-call success.
  - Covers text-plan fallback success for an experimental/free model.
  - Covers disabled AI settings skipping diagnostics.

- `frontend/src/api/aiAssistantApi.ts`
  - Extended `ProviderHealthResponse` with diagnostics DTO fields.

- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
  - Added a Model diagnostics panel in the Provider tab.
  - Runs diagnostics on saved settings only.
  - Shows chat readiness, ERP tool readiness, recommended mode, catalog status, and individual check results.

- `frontend/src/locales/en|ar|tr/aiAssistant.json`
  - Added full i18n labels for the diagnostics panel.

### Safety Notes

- The diagnostics endpoint uses saved backend settings only.
- API keys stay server-side and are never returned.
- Diagnostic prompts contain no ERP business data.
- The diagnostic tool is a private compatibility probe only; it is not an ERP business tool and does not execute business logic.

### Verification

- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅
  - 1 suite passed
  - 3 tests passed
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` ✅
  - 13 suites passed
  - 338 tests passed
- `backend`: `npm run build` ✅
- `frontend`: `npm run build` ✅

### Verification Limitation

- `graphify update .` was attempted but failed because `graphify` is not available on PATH.

## End-User View

Admins can now test an AI model from the AI Assistant Settings page.

Open **AI Assistant → Settings → Provider**, save the provider settings, then click **Run diagnostics**.

The page will show whether:

1. the provider connection works,
2. the model can answer,
3. native tool calling works,
4. the guarded text-plan fallback works,
5. ERP tools are ready for this model.

If the model cannot use native tool calling but the text-plan fallback passes, the assistant can still use safe read-only ERP tools through the guarded fallback path.
