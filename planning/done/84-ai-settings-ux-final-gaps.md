# AI Settings UX — Final Gaps Closure (Subtasks 6 & 8)

**Date:** 2026-05-11
**Branch:** `feat/ai-proposal-sandbox`
**Actual time:** ~1h 15m

---

## What Was Changed

### Subtask 8: Restore Profile Reference on Settings Page Reload

**Problem:** After saving a certified model or registering a custom profile, reloading the settings page lost all visual state. The `selectedModelProfileId` and `selectedProfileHash` were fetched from the backend but never matched against the loaded certified profiles to restore the UI.

**Fix:** Added a bridging `useEffect` that runs after both `settings` and `erp03AvailableModels` are loaded. It:
1. Matches `settings.selectedModelProfileId` + `settings.selectedProfileHash` against certified profiles → restores `selectedErp03Profile`
2. If mode is `custom_uncertified` and profile exists in the ALL query → restores `registeredProfileId` + `registeredProfileData`

**File:** `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`

### Subtask 6: Profile Deprecation Endpoint (Soft-Delete)

**Problem:** Tenants had no way to remove/deprecate a custom model profile they had registered. The only option was "Cancel Registration" which only cleared local UI state without persisting the change.

**Solution:** Implemented a soft-delete flow that:
1. Marks the TENANT-scoped profile as `deprecated` (status change, not actual deletion — preserves audit trail)
2. Disables the profile (`enabled = false`)
3. Clears the tenant's `selectedModelProfileId`/`selectedProfileHash` from settings if this was the active profile
4. Resets mode to `legacy_unverified`

**Backend files:**
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts` — Added `deprecateTenantProfile(profileId, tenantId)` method
- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts` — Added `clearSelectedProfile(companyId)` method
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts` — Added `deprecateTenantCustomModelProfile` controller
- `backend/src/api/routes/ai-assistant.routes.ts` — Added `DELETE /settings/custom-model-profiles/:profileId` route

**Frontend files:**
- `frontend/src/api/aiAssistantApi.ts` — Added `deleteTenantCustomModelProfile` API function
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx` — Added "Deprecate Profile" button with confirmation dialog to the registered profile card
- `frontend/src/locales/en/aiAssistant.json` — Added deprecate i18n keys
- `frontend/src/locales/ar/aiAssistant.json` — Added deprecate i18n keys (Arabic)
- `frontend/src/locales/tr/aiAssistant.json` — Added deprecate i18n keys (Turkish)

---

## Verification

| Check | Result |
|-------|--------|
| `backend`: `npx tsc --noEmit` | ✅ |
| `backend`: `npm run build` | ✅ |
| `backend`: `npm run test -- SendChatMessageUseCase` | ✅ 25/25 |
| `frontend`: `npx tsc --noEmit` | ✅ |
| `frontend`: `npm run build` | ✅ |

---

## Acceptance Criteria Met

- [x] Settings page reload restores selected certified profile indicator
- [x] Settings page reload restores registered custom profile card
- [x] DELETE endpoint marks TENANT profile as deprecated
- [x] DELETE endpoint clears selected profile reference from tenant settings
- [x] DELETE endpoint is tenant-scoped (cannot deprecate other tenant's profiles)
- [x] Frontend shows confirmation dialog before deprecating
- [x] Frontend resets all registration state after successful deprecation
- [x] Frontend reloads settings to reflect cleared profile reference
- [x] i18n complete (EN/AR/TR)

---

## Technical Developer Notes

### Architecture Decisions

1. **Soft-delete vs hard-delete:** Chose status change to `deprecated` rather than actual deletion. This preserves the audit trail and prevents orphaned references. The profile remains in Firestore but is excluded from certified profile queries (the certification engine already filters out `deprecated` status).

2. **Settings clearing in controller, not use case:** The `deprecateTenantCustomModelProfile` controller checks if the deprecated profile was the active one and calls `clearSelectedProfile` conditionally. This keeps the `deprecateTenantProfile` use case focused on profile state only, not settings side effects.

3. **`clearSelectedProfile` resets mode to `legacy_unverified`:** This is intentional — after deprecation, the tenant should fall back to the default unverified state rather than being stuck in an invalid `custom_uncertified` mode with no profile.

4. **Frontend reloads settings after deprecation:** Rather than manually resetting every field, the handler calls `getSettings()` again to get the server's authoritative state. This ensures consistency and handles any future fields automatically.

### API Contract

```
DELETE /tenant/ai-assistant/settings/custom-model-profiles/:profileId
Auth: Required
Permission: ai-assistant.settings.manage
Company context: Required

Response 200:
{ "success": true, "message": "Profile deprecated successfully" }

Response 404: Profile not found
Response 403: Profile does not belong to this company
Response 400: Profile already deprecated
```

---

## End-User Guide

### Deprecating a Custom AI Model

If you've registered a custom AI model and want to stop using it:

1. Go to **AI Assistant → Settings → Provider**
2. Find the registered model card (shows Profile ID, Model ID, and status)
3. Click **"Deprecate Profile"** at the bottom of the card
4. Confirm the action in the dialog
5. The model will be removed from your settings and can no longer be used

**Note:** This action cannot be undone. The model profile is marked as deprecated in the system for audit purposes, but it will no longer appear as an available option.

### Automatic Profile Restoration

When you select a certified model or register a custom profile and save your settings, the system now remembers your selection. If you refresh the page or return to settings later, your chosen model will still be displayed.
