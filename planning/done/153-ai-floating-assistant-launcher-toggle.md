# 153 — AI Floating Assistant Launcher Toggle

**Date:** 2026-06-02  
**Agent:** Codex  
**Status:** Complete  
**Actual time spent:** ~1.0 hour

## Summary

Added an AI Settings option that lets company admins show or hide the global floating AI Assistant launcher. The launcher now uses a brain/sparkles AI-style icon instead of the generic chat bubble.

## Technical Developer View

### What Changed

- Added `showFloatingAssistant` to `AiProviderConfig` with backward-compatible default `true`.
- Persisted and returned the setting through `toJSON()`, `toPersistenceJSON()`, and `fromJSON()`.
- Extended `AiSettingsUseCase`, AI settings validation, backend DTOs, and the update settings controller path.
- Added `GET /tenant/ai-assistant/settings/widget-preferences`, guarded by `ai-assistant.chat.use`, so normal chat users can respect the admin launcher preference without needing full settings access.
- Wired frontend API types and `useAiSettings` so the option participates in normal dirty-state/save behavior.
- Added a new **Show Floating AI Launcher** switch in AI Assistant settings.
- Updated `GlobalAiWidget` to render only when:
  - the user can use AI Assistant,
  - the current route is not an AI Assistant page,
  - AI Assistant is enabled,
  - `showFloatingAssistant` is not false.
- Replaced the closed launcher icon with Lucide `BrainCircuit` plus `Sparkles`.
- Added English, Arabic, and Turkish i18n keys.

### Files Changed

- `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts`
- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/api/routes/ai-assistant.routes.ts`
- `backend/src/api/validators/ai-assistant.validators.ts`
- `backend/src/api/dtos/AiAssistantDTOs.ts`
- `backend/src/tests/domain/ai-assistant/AiProviderConfig.test.ts`
- `backend/src/tests/application/ai-assistant/AiSettingsUseCase.test.ts`
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/components/GlobalAiWidget.tsx`
- `frontend/src/modules/ai-assistant/hooks/useAiSettings.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
- `docs/architecture/ai-assistant-runtime-v2.md`
- `docs/user-guide/ai-assistant-chat-sidebar.md`

### Accounting / Control Impact

No accounting, ledger, posting, tax, inventory valuation, or financial-report behavior changed.

The control boundary is preserved:

- Hiding the launcher does not disable server-side chat access.
- Disabling AI Assistant still uses `isEnabled` and remains enforced in backend chat use cases.
- The widget preference endpoint returns only shell visibility flags, not provider credentials or full settings.

## End-User View

Company admins can now open **AI Assistant -> Settings -> Provider** and use **Show Floating AI Launcher**.

- On: the floating AI shortcut appears across ERP pages for users who can use AI Assistant.
- Off: the floating shortcut disappears. Users can still open AI Assistant from the menu if they have permission.

The button icon now looks like an AI assistant button instead of a normal chat bubble.

## Verification

- `npm --prefix backend test -- --runInBand src/tests/domain/ai-assistant/AiProviderConfig.test.ts src/tests/application/ai-assistant/AiSettingsUseCase.test.ts` -> passed, 36 tests.
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed.
- `npm run graph:update` -> passed.
- Browser smoke at `http://127.0.0.1:5173/` -> app loaded to `/#/auth`; no runtime error from this change. Only existing React Router v7 future-flag warning observed.

## Known Follow-Ups

- Manual QA should verify the toggle in an authenticated tenant session and confirm the hidden launcher state for a normal chat user.
