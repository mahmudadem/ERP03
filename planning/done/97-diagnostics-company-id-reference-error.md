# Task 97 — Fix Diagnostics companyId Error, Permanent Profile Deletion, and Inline Action Icons

**Status:** ✅ Complete
**Date completed:** 2026-05-17
**Branch:** `chore/enterprise-restructure`
**Time spent:** ~0.65h
**Linked plan:** *None (ad-hoc requests)*
**Linked architecture doc:** [`docs/architecture/ai-assistant-runtime-v2.md`](../../docs/architecture/ai-assistant-runtime-v2.md)
**Linked user guide:** [`docs/user-guide/ai-assistant-runtime-v2.md`](../../docs/user-guide/ai-assistant-runtime-v2.md)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [x] Code merged
- [x] `docs/architecture/ai-assistant-runtime-v2.md` updated or created — technical doc for future engineers
- [x] `docs/user-guide/ai-assistant-runtime-v2.md` created — plain-language guide for end users
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [x] `planning/ACTIVE.md` updated with next task

---

## 1. Technical Developer View

### What Was Built

We resolved four crucial runtime and UI behaviors in the Super Admin AI Assistant module:

1. **`companyId` Reference Error in Diagnostics**:
   - Fixed a fatal crash (`ReferenceError: companyId is not defined` with error code `INFRA_999`) when running diagnostics with custom API keys in Super Admin.
   - Refactored `CheckProviderHealthUseCase.executeWithConfig` to reference `config.companyId || 'admin-test'` instead of the free-floating `companyId` variable.

2. **Permanent Deletion of System Model Profiles**:
   - Resolved a design mismatch where deleting a built-in model profile (e.g., `mock`, `gpt-4o`, etc.) did not persist and was recreated on server startup/hot-reload.
   - Modified `AiModelProfileUseCase.syncBuiltInProfiles` to accept a `force: boolean = false` parameter.
   - If `force` is `false` (during backend initialization `initServer` in `backend/src/index.ts`), the system skips auto-syncing if the database already contains profiles. This ensures that deleting any profile is **permanent**.
   - If `force` is `true` (when explicitly clicking **Sync Profiles** inside the Super Admin UI, calling `/platform/ai-model-profiles/sync`), the system forces manual synchronization, restoring any deleted system profiles.

3. **Inline Icon Actions**:
   - Replaced the 3-dots actions menu (`ActionMenu`) on the AI Model Profiles table with beautiful inline icon buttons (`Bot`, `Activity`, `ShieldCheck`, `Trash2`).
   - Added custom hover tones matching our premium design aesthetics (blue, amber, green, red) and CSS transition animations to improve the response speed and layout scan time for administrators.

4. **Model ID Mismatch & Friendly Display Name Support**:
   - Fixed the issue where editing a model profile could lead to mismatched `modelName` and `modelId` in the UI (e.g. `modelName` showing `anthropic/claude-opus-4.7` but the underlying technical `modelId` remaining `gemini-1.5-pro`).
   - Made the **Technical Model Name / ID** field completely read-only when editing an existing profile (`disabled={isEditing}` in the FormInput) to prevent database primary key mismatches.
   - Exposed a new editable **Display Name (Friendly Label)** input field (`displayName`) in the profile configuration form to allow administrators to safely give models customer-facing friendly labels while keeping the underlying technical ID intact.
   - Updated the main profiles list table cell to render `profile.displayName || profile.modelName` in the blue primary link. This guarantees that whatever friendly display name the admin sets and updates will immediately be reflected in the table columns!

### Files Changed

**Backend**
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts` — Replaced free-floating `companyId` with `config.companyId || 'admin-test'`.
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts` — Added `force` parameter to `syncBuiltInProfiles` and skipped startup seeder if the database is already seeded.
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts` — Updated `syncModelProfiles` controller to call `syncBuiltInProfiles(true)` to force manual synchronization on-demand.

**Frontend**
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx` — Converted the 3-dots actions menu to inline icon buttons, made `modelName` read-only during editing, exposed the friendly `displayName` input field, and rendered `profile.displayName || profile.modelName` as the primary row title.

**Docs & Planning**
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

### Verification

- [x] `cd backend && npm run build` clean (0 compiler or type errors)
- [x] `cd frontend && npm run typecheck` clean (0 type errors)
- [x] Unit tests passed: `npx jest src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` (5/5 passed)
- [x] AI Assistant integration tests: 16/16 suites passed.

---

## 2. End-User View

### What's New

1. **Fixed Diagnostics Crash**: Running AI Model Diagnostics from the Super Admin panel with custom API keys now works perfectly and never crashes.
2. **Permanent Deletes**: Deleting any AI model profile now persists permanently. The profile will never reappear on its own unless you explicitly request a restoration.
3. **Manual Sync & Recovery**: Super Admins can restore deleted default profiles at any time by clicking **Sync Profiles** in the Super Admin AI settings page.
4. **Sleek Inline Actions**: In the AI Model Profiles list, the legacy 3-dots actions menu has been converted to inline icon buttons. You can now edit, run diagnostics, manage certifications, and delete profiles with a single click.
5. **Display Name & Locked IDs**:
   - You can now set a friendly **Display Name** for any model (e.g. `Claude 3.5 Sonnet (Direct)`).
   - The underlying **Technical Model Name / ID** is now locked and read-only when editing a profile to prevent mismatch bugs.
   - The primary column in the AI Model Profiles table now displays your custom friendly **Display Name** so your settings are instantly visible.

### How to Use It

1. **Inline Actions**: Go to **Super Admin -> AI Models**. In the Actions column of the table, you will see four direct buttons instead of a 3-dots menu:
   - 🤖 **Bot Icon**: Edit Profile
   - ⚡ **Activity Icon**: Run Diagnostics
   - 🛡️ **Shield Icon**: Manage Certifications
   - 🗑️ **Trash Icon**: Delete Profile
2. **To Delete a Profile**: Click the **Trash Icon**. The profile is removed permanently and won't reappear when the server restarts.
3. **Display Name editing**: Click **Edit** (🤖) on a profile. The **Technical Model Name** field will be locked, but you can change the **Display Name** to anything you want!
4. **To Restore Defaults**: Click the **Sync Catalog / Sync Profiles** button on the settings page to re-import all official platform model profiles.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
