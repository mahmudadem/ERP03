# Task 95 — Platform Global Providers

## Technical Developer View

### What Was Built

Implemented a dedicated Super Admin runtime registry for AI Credits mode. This separates provider/model catalog metadata from the operational platform credential and usage-cap layer required to execute tenant AI chats in `CREDITS` mode.

### Files Changed

**Backend**
- `backend/src/domain/ai-assistant/entities/AiPlatformRuntimeProfile.ts`
- `backend/src/domain/ai-assistant/entities/index.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiPlatformRuntimeProfileRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/index.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiPlatformRuntimeProfileRepository.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/application/ai-assistant/use-cases/AiPlatformRuntimeProfileUseCase.ts`
- `backend/src/application/ai-assistant/services/AiCredentialResolver.ts`
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/StreamChatMessageUseCase.ts`
- `backend/src/application/ai-assistant/services/AiResponsePersister.ts`
- `backend/src/api/controllers/ai-assistant/AiRuntimeProfileController.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/routes/ai-tool-catalog.routes.ts`

**Frontend**
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/modules/super-admin/pages/AiRuntimeProfilesPage.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/tr/common.json`
- `frontend/src/locales/ar/common.json`

**Docs**
- `docs/architecture/ai-assistant-credits-runtime.md`
- `docs/user-guide/ai-assistant-credits.md`
- `ACTIVE.md`
- `JOURNAL.md`

### Architecture / Behavior

- Added `AiPlatformRuntimeProfile` as the platform-funded runtime source of truth for AI Credits mode.
- Runtime profiles are keyed by `providerId + modelProfileId` and store:
  - encrypted platform API key,
  - masked credential hint,
  - runtime status,
  - request cap,
  - interval,
  - runtime usage counters,
  - last-used / last-failure metadata.
- `AiCredentialResolver` now resolves runtime profiles first for `CREDITS` mode and only falls back to legacy provider-level credentials for backward compatibility.
- `AiResponsePersister` increments runtime profile usage counters only after a successful credits-mode response, matching the existing “successful responses consume credits” rule.
- Added Super Admin UI route `/super-admin/platform-global-providers` for runtime management.

### Verification

- `backend`: `npm run build` ✅
- `frontend`: `npm run typecheck` ✅

### Known Follow-Ups

- Request caps are based on persisted successful-response counts, so concurrent requests can still slightly overshoot a cap under heavy race conditions.
- No per-company allowlist, monetary budget ceiling, or fallback-profile chain exists yet.
- Runtime-profile credential rotation is supported by overwrite, but there is no dedicated “clear stored key” UI action yet.

## End-User View

### What This Feature Does

Super Admin now has a real place to configure the platform AI connection used by tenant `AI Credits` mode.

### How to Use It

1. Open `Super Admin -> Platform Global Providers`.
2. Create a new runtime entry.
3. Choose the provider.
4. Choose the global model that tenants should use.
5. Enter the platform API key.
6. Set the status to `Active`.
7. Optionally set a request cap and interval.
8. Save the runtime.
9. Grant credits to a company.
10. In the tenant AI settings, choose `Use AI Credits` and select that provider/model.

### What Users Will Notice

- Tenants no longer need their own API key when using `AI Credits`.
- If Super Admin has not configured a runtime entry for the chosen provider/model, tenant AI chat in credits mode will not run.
