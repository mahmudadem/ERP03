# AI Model Management Backend Trust Foundation

**Date:** 2026-05-09  
**Task:** Increment 1 — Backend trust foundation  
**Actual time:** ~2h  
**Status:** Complete

## Technical Developer View

This increment closes the unsafe model-name trust gap for backend AI tool routing.

### What Changed

- Added `AiProvider` as the backend provider registry entity.
- Added fixed `AiCertificationCategory` stored IDs.
- Added `AiModelCertificationResult` for GLOBAL/TENANT certification records.
- Extended `AiModelProfile` from provider/model metadata into a runtime profile:
  - `scope`
  - `tenantId`
  - `providerId`
  - `modelId`
  - `endpointFingerprint`
  - runtime settings
  - `profileHash`
  - `revision`
  - `enabled`
  - extended safety statuses
- Added deterministic `profileHash` generation from runtime-relevant fields.
- Extended `AiProviderConfig` tenant settings with:
  - `mode`
  - `providerId`
  - `selectedModelProfileId`
  - `selectedProfileHash`
- Existing settings without profile identity now default to `legacy_unverified`.
- Added provider and certification repository interfaces and Firestore implementations.
- Added `AiModelRoutingGuard`.
- Wired the guard into chat tool contract exposure and direct AI tool execution.
- Added a certification gate snapshot to `AiRuntimeGuard` so stale/uncertified requests are rejected before execution.

### Files Touched

- `backend/src/domain/ai-assistant/entities/AiCertificationCategory.ts`
- `backend/src/domain/ai-assistant/entities/AiProvider.ts`
- `backend/src/domain/ai-assistant/entities/AiModelCertificationResult.ts`
- `backend/src/domain/ai-assistant/entities/AiModelProfile.ts`
- `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiProviderRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelCertificationRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/index.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiProviderRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelCertificationRepository.ts`
- `backend/src/application/ai-assistant/services/AiModelRoutingGuard.ts`
- `backend/src/application/ai-assistant/services/AiRuntimeGuard.ts`
- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/tests/domain/ai-assistant/AiModelProfile.test.ts`
- `backend/src/tests/application/ai-assistant/AiModelRoutingGuard.test.ts`
- `backend/src/tests/application/ai-assistant/AiRuntimeGuard.test.ts`

### Verification

- `backend`: `npm run typecheck` passed.
- `backend`: targeted trust tests passed.
- `backend`: chat/diagnostics/tool regression slice passed.
- `backend`: `npm run build` passed.

## End-User View

Companies can no longer rely on simply typing a model name and passing diagnostics to make that model trusted for ERP tools.

For sensitive ERP workflows, the backend now requires the selected model profile to match an exact certified runtime profile. If the provider, endpoint, model profile, or runtime settings change, the old certification no longer applies.

Older AI settings are treated as legacy and unverified. They may still support safe basic chat where available, but sensitive ERP tool workflows are blocked until a certified profile is selected or company certification is added in the next increment.

## Known Follow-Ups

- Add certification execution/API workflows.
- Add Super Admin provider registry management APIs.
- Add tenant custom model certification API.
- Add migration script/report for old profiles and settings.
- Add frontend Recommended Certified Models and custom model certification UI.
