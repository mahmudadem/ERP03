# 75 — AI Model Profile Management

**Date:** 2026-05-09  
**Actual time:** ~2h  
**Status:** Complete

## Technical Developer View

### What changed

AI model trust and runtime capability metadata is no longer limited to the static `AiModelCapabilityCatalog`. The static catalog now acts as seed/default data only. Super Admin can manage model profiles in the database, and chat/diagnostics resolve DB profiles first.

### Files touched

- `backend/src/domain/ai-assistant/entities/AiModelProfile.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelProfileRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelProfileRepository.ts`
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts`
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/routes/ai-tool-catalog.routes.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts`
- `backend/src/tests/domain/ai-assistant/AiModelProfile.test.ts`
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/layout/SuperAdminShell.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`

### How it works

- Model profiles are stored under platform metadata through `IAiModelProfileRepository`.
- Runtime profile resolution checks the DB first, then falls back to built-in defaults if no DB row exists.
- Diagnostics now records the latest provider/model diagnostic result on the model profile: status, recommended mode, company id, timestamp, and detail.
- Super Admin diagnostics reuse the same provider health use case. The platform admin selects a company, and the backend uses that company's saved AI provider settings internally while overriding the provider/model for the selected profile.
- Diagnostics passing does not automatically promote a model to `recommended` or enable native tools. Super Admin must explicitly update status and runtime flags.
- Super Admin now has `/super-admin/ai-models` to add, update, delete, sync, and run diagnostics for model profiles.
- Internal model profile document IDs are URL-encoded so provider model names containing `/` or `:` can be saved safely in Firestore.

### Acceptance criteria met

- Super Admin can create model profiles.
- Super Admin can update model status, tags, use cases, warning level, tool flags, JSON support, and text-only mode.
- Super Admin can delete model profiles.
- Super Admin can run model diagnostics using a selected company's saved provider credentials without exposing API keys.
- Diagnostics result is persisted separately from trust status.
- Chat no longer displays every non-recommended model as “Untested”; it distinguishes tested, experimental, and custom.

### Verification

- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` — passed, 22 tests
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/domain/ai-assistant/AiModelProfile.test.ts` — passed, 6 tests
- `backend`: `npm run typecheck` — passed
- `frontend`: `npm run typecheck` — passed
- `backend`: `npm run build` — passed
- `frontend`: `npm run build` — passed

## End-User View

Platform admins now have an **AI Models** page in Super Admin. From there they can manage which AI models are trusted, tested, experimental, or custom.

Admins can add a new model profile after testing a provider/model, tag it for use cases like accounting or reporting, and decide whether it should use native tools, guarded text-plan tools, or text-only mode.

Super Admins can also run diagnostics from the AI Models page. They choose a company whose AI settings should be used for the test. The system uses that company's saved provider setup internally, but does not show the API key.

When a model is used in chat, the AI Assistant now shows a clearer model label such as **Tested model**, **Experimental model**, or **Custom model** instead of incorrectly calling every non-recommended model “Untested”.

Diagnostics still checks live provider compatibility, but final trust remains controlled by Super Admin.
