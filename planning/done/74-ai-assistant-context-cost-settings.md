# 74 - AI Assistant: Conversation Context Cost Settings

Date: 2026-05-09

Estimate: 45-60m
Actual: ~45m

## Technical Developer View

### Scope Completed

Added company-admin controls for how much previous chat context and previous ERP tool-result data the AI Assistant sends to the selected model.

This preserves the context-first behavior needed for follow-up questions while making token cost explicit and configurable for customers using their own API keys.

### What Changed

- `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts`
  - Added `conversationContextMode` with `minimal`, `balanced`, and `deep`.
  - Added `includePreviousToolResults`.
  - Defaulted old configs to `balanced` and previous tool-result reuse enabled.
  - Persisted both fields through JSON and Firestore persistence serialization.

- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts`
  - Accepts and saves the new context settings.

- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
  - Passes the new settings from request body to the settings use case.

- `backend/src/api/validators/ai-assistant.validators.ts`
  - Validates `conversationContextMode` and `includePreviousToolResults`.

- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
  - Resolves a context budget from saved settings.
  - Limits fetched history, sent provider history, message length, previous tool-result count, and previous tool-result total size.
  - Skips previous tool-result prompt injection when disabled.
  - Adds a runtime warning when context is trimmed to control AI token cost.

- `frontend/src/api/aiAssistantApi.ts`
  - Added DTO and update payload fields for the new settings.

- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
  - Added Conversation Context settings UI with Minimal, Balanced, Deep, and previous tool-result toggle.

- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
  - Added translated setting labels and descriptions.

- `backend/src/tests/domain/ai-assistant/AiProviderConfig.test.ts`
- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
  - Added regression coverage for persistence defaults, update behavior, and disabling previous tool-result context injection.

### Acceptance Criteria Met

- The model no longer receives unbounded conversation context.
- Admins can choose a low-cost, balanced, or deeper context mode.
- Admins can disable previous ERP tool-result context reuse.
- Existing provider configs remain backward compatible.
- The assistant warns when context was trimmed to control token cost.
- Production logic does not hardcode any specific previous chat, account, or trial-balance scenario.

### Verification

- `backend`: `npm run test -- --runInBand src/tests/domain/ai-assistant/AiProviderConfig.test.ts src/tests/application/ai-assistant/AiSettingsUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` passed.
  - 3 suites passed
  - 52 tests passed
- `backend`: `npm run typecheck` passed.
- `frontend`: `npm run typecheck` passed.
- `frontend`: `npm run build` passed.
- `backend`: `npm run build` passed.

### Known Follow-Ups

- Manual browser QA in **AI Assistant -> Settings -> Provider**:
  - verify settings load with Balanced enabled by default;
  - switch Minimal/Balanced/Deep and save;
  - disable previous tool results and save;
  - retest a Trial Balance follow-up chat to confirm behavior.
- Consider showing a small token-cost estimate later if real provider usage data is reliable enough.

## End-User View

Admins can now control how much previous chat information the AI Assistant sends to the AI model.

Use **Balanced** for normal work. Use **Minimal** if API token cost matters more than long conversation memory. Use **Deep** when you want the assistant to keep more context during longer analysis, with higher token use.

The **Include previous tool results** option helps the assistant answer follow-up questions using ERP data already fetched in the same chat. Turning it off lowers context sent to the model, but the assistant may need to call read-only tools again or ask for more detail.
