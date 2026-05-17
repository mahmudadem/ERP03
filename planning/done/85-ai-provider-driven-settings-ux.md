# AI Provider-driven Settings UX

**Date:** 2026-05-12  
**Branch:** `feat/ai-proposal-sandbox`  
**Status:** ✅ Complete, ready for manual QA  
**Actual time:** ~2h 30m

---

## Technical Developer View

### What changed

This task moved AI Settings toward the approved provider-driven model:

```txt
Super Admin defines provider metadata
→ Super Admin defines model profiles under providers
→ Tenant selects provider
→ Tenant selects model under that provider
→ Tenant enters a key only when provider BYOK is true
```

### Backend changes

- Added `byok` to `AiProvider` metadata.
- Kept provider runtime credentials hidden/deprecated for backward compatibility only.
- Added tenant-safe provider endpoint:

```txt
GET /tenant/ai-assistant/providers
```

- Added tenant-safe models-by-provider endpoint:

```txt
GET /tenant/ai-assistant/providers/:providerId/models
```

- Endpoint responses expose metadata only and never expose provider credentials.
- Provider model endpoint returns enabled GLOBAL model profiles and joins valid certification rows when available.

### Frontend changes

- Super Admin AI Providers page is now metadata-only:
  - removed provider credential field;
  - added BYOK checkbox;
  - added BYOK / ERP03-managed badges.
- Tenant AI Settings now loads providers from backend.
- Tenant AI Settings loads model options for the selected provider.
- API key field visibility is driven by provider `byok` + `authType`.
- Existing fallback presets remain as graceful fallback if the provider endpoint returns empty/fails.
- Certified Models modal now shows certification score badges and a disclaimer about shell/structural certification limits.

### Files changed

Backend:
- `backend/src/domain/ai-assistant/entities/AiProvider.ts`
- `backend/src/application/ai-assistant/use-cases/AiProviderRegistryUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/dtos/AiAssistantDTOs.ts`
- `backend/src/api/routes/ai-assistant.routes.ts`

Frontend:
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/modules/super-admin/pages/AiProvidersPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/modules/ai-assistant/components/CertifiedModelsModal.tsx`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`

### Verification

- `erp-reviewer` ✅ approved after fixes.
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

### Known notes

- Full AI subscription/credit/entitlement engine is not implemented yet.
- ERP03-managed providers are represented by `byok=false`, but real usage limits/credits must be enforced by a future entitlement engine before public paid launch.
- Certification scores currently reflect existing certification records; full ERP correctness test suites are future work.

---

## End-User View

Company admins now get a cleaner AI Settings setup flow.

1. Open **AI Assistant → Settings → Provider**.
2. Choose an available AI provider from the provider list.
3. Choose a model available under that provider.
4. If the provider requires your own key, enter your API key.
5. If the provider is ERP03-managed, no key field appears.
6. Click **Browse Certified Models** to compare models by certification score.
7. Use **Custom Model** only if none of the listed providers/models fit your needs.

The Certified Models screen now shows score badges, but users should remember: current scores may represent structural/connectivity certification until deeper ERP scenario test suites are added.
