# Phase 6.6B — AI Setup Wizard Integration

**Date:** 2026-05-13
**Status:** Complete
**Estimate:** 30-45m
**Actual time:** ~30m
**Branch:** `feat/ai-proposal-sandbox`

## Technical Developer View

### Task

The first-time tenant AI setup wizard already existed as `AiSetupWizard`, but it was not rendered by any route or page. The task was to make it appear in the tenant AI Settings flow when a company has the AI Assistant enabled but still has only the default/unconfigured provider setup.

### Files Changed

- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/modules/ai-assistant/components/AiSetupWizard.tsx`
- `graphify-out/graph.json`
- `graphify-out/GRAPH_REPORT.md`
- `ACTIVE.md`
- `JOURNAL.md`

### Implementation Details

- Added `AiSetupWizard` to the AI Settings Provider tab.
- Added first-time setup detection in `AiAssistantSettingsPage`:
  - Configured if runtime mode is `DISABLED`.
  - Configured if `CREDITS` mode has `selectedModelProfileId` and `selectedProfileHash`.
  - Configured if `BYOK` mode uses a non-mock provider and has an API key, or uses Ollama.
- Wizard visibility is limited to users with `ai-assistant.settings.manage`.
- The normal settings UI remains available for configured tenants, read-only users, disabled configs, loading states, and error states.
- The normal Save Settings button is hidden while loading or while the wizard is active.
- After activation, users with `ai-assistant.chat.use` are redirected to `/ai-assistant`.
- Fixed `AiSetupWizard` hook ordering by moving the `isConfigured` null render after all hooks and guarding effects when configured.

### Verification

- `frontend`: `npx tsc --noEmit` passed.
- `frontend`: `npm run build` passed.
- `npm run graph:update` passed.

### Acceptance Criteria Met

- First-time setup wizard is now reachable from the tenant AI Settings page.
- Configured tenants continue to see the normal settings form.
- Wizard does not run data-loading or diagnostic effects when already configured.
- Frontend typecheck and production build pass.

### Known Follow-Ups

- Manual browser QA should verify the exact first-time flow with default/mock settings and confirm activation redirects to chat.
- No commit was made; commit after QA/user approval.

## End-User View

When a company admin opens AI Settings for the first time, the system now shows a guided setup wizard instead of the full advanced settings form.

The wizard helps the admin:

- Choose between AI Credits or bringing their own API key.
- Select a provider and model.
- Test the connection.
- Activate the AI Assistant.

After setup succeeds, users who have chat access are taken directly to the AI Assistant chat page.
