# AI Model Management Certification Workflows and APIs

**Date:** 2026-05-09  
**Task:** Increment 2 — Certification workflows and APIs  
**Actual time:** ~2h 20m  
**Status:** Complete

## Technical Developer View

This increment makes the certification foundation usable through backend use cases and APIs. It does not include the full frontend Recommended Certified Models modal.

### What Changed

- Added `AiProviderRegistryUseCase`.
- Added `AiCertificationEngine` shell.
- Added `AiModelCertificationUseCase`.
- Added Super Admin provider registry endpoints.
- Added Super Admin GLOBAL model profile certification endpoints.
- Added Company Admin tenant custom model profile/certification endpoints.
- Added valid certified profile queries for future frontend use.
- Added dev seed helper for one local certified profile.

### API Surface Added

Super Admin platform routes:

- `GET /platform/ai-providers`
- `POST /platform/ai-providers`
- `GET /platform/ai-providers/:providerId`
- `PATCH /platform/ai-providers/:providerId`
- `PATCH /platform/ai-providers/:providerId/enable`
- `PATCH /platform/ai-providers/:providerId/disable`
- `GET /platform/ai-certifications/valid`
- `PATCH /platform/ai-certifications/:certificationId/expire`
- `GET /platform/ai-model-profiles/:profileId/certifications`
- `POST /platform/ai-model-profiles/:profileId/certifications/manual`
- `POST /platform/ai-model-profiles/:profileId/certifications/run`

Tenant AI Assistant routes:

- `POST /ai-assistant/settings/custom-model-profiles`
- `POST /ai-assistant/settings/custom-model-profiles/:profileId/diagnostics`
- `POST /ai-assistant/settings/custom-model-profiles/:profileId/certifications/run`
- `GET /ai-assistant/certified-profiles`

### Super Admin GLOBAL Certification

Super Admin can record manual certification for a GLOBAL model profile. The request must include the current `profileHash`; stale hashes are rejected. Required fields include category, score, maxScore, status, test suite version, tool contract version, data filter policy version, and summary.

The shell-run certification endpoint performs deterministic structural checks only. It does not claim accounting correctness or module-level behavioral certification beyond those checks.

### Company Admin TENANT Certification

Company Admin can create TENANT-scoped custom model profiles, run diagnostics with tenant BYOK, and run shell certification. Tenant certification is stored with `scope = TENANT` and the current company ID. It is valid only for that tenant.

Tenant certifications do not appear in GLOBAL certified profile queries.

### Dev Seed Helper

Local helper:

```bash
npx ts-node src/scripts/seedAiCertifiedProfileDev.ts
```

The helper creates provider/profile/certification metadata only. It stores no Super Admin or tenant API keys.

### Files Touched

- `backend/src/application/ai-assistant/use-cases/AiProviderRegistryUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/AiModelCertificationUseCase.ts`
- `backend/src/application/ai-assistant/services/AiCertificationEngine.ts`
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/api/routes/ai-tool-catalog.routes.ts`
- `backend/src/api/routes/ai-assistant.routes.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelCertificationRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelCertificationRepository.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/scripts/seedAiCertifiedProfileDev.ts`
- `backend/src/tests/application/ai-assistant/AiProviderRegistryUseCase.test.ts`
- `backend/src/tests/application/ai-assistant/AiModelCertificationUseCase.test.ts`
- `backend/src/tests/api/assertSuperAdmin.test.ts`

### Verification

- Backend typecheck passed.
- Provider/certification/routing/auth tests passed.
- Chat/diagnostics/tool regression slice passed.
- Backend build passed.

## End-User View

The platform now has backend support for certified AI model profiles.

Super Admins can define AI providers and certify global model profiles. Company Admins can create custom company-only model profiles and run company certification for them.

A model is still not trusted just because its name is typed correctly or diagnostics pass. Sensitive ERP tools require a selected certified profile with a matching current profile hash.

## Known Follow-Ups

- Build the Super Admin provider/certification UI.
- Build the tenant Recommended Certified Models modal.
- Build tenant custom model certification UI.
- Add deeper automated ERP test suites.
- Add production migration command/report for existing data.
