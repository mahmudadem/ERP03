# Task 99 — AI Setup Wizard & API Key Vault

**Status:** ✅ Complete (code shipped; live cert verification pending user confirmation)
**Date completed:** 2026-05-18
**Branch:** `chore/enterprise-restructure`
**Time spent:** ~1 long session
**Linked plan:** [`planning/ai-flow-rewrite.md`](../ai-flow-rewrite.md)
**Linked architecture doc:** [`docs/architecture/ai-setup-wizard-and-vault.md`](../../docs/architecture/ai-setup-wizard-and-vault.md)
**Linked user guide:** [`docs/user-guide/ai-setup-superadmin.md`](../../docs/user-guide/ai-setup-superadmin.md)

---

## Definition of Done — Checklist

- [x] Code merged (changes on `chore/enterprise-restructure`)
- [x] `docs/architecture/ai-setup-wizard-and-vault.md` created
- [x] `docs/user-guide/ai-setup-superadmin.md` updated (vault section, Step 3 rewrite, "Run all categories", reference table)
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [ ] `planning/ACTIVE.md` updated with next task (handoff to product owner — Sales contract work resumes)

---

## 1. Technical Developer View

### What Was Built

Consolidated the Super Admin AI setup flow into a **single 5-step linear wizard** and added an **API Key Vault** entity so superadmins manage provider API keys once and reuse them across models. Along the way, fixed six bugs in the underlying flow: zombie certifications resurrecting after profile deletion, "Provider connection: Passed" silently lying when auth was broken, the generic "Provider error" sanitizer message hiding real HTTP status codes, certification using the wrong base URL when `profile.baseUrl` was unset, OpenRouter Anthropic models returning 401 from missing identity headers, and the cert API timing out at 30s.

### Files Changed

**Backend — new files**
- `backend/src/domain/ai-assistant/entities/AiPlatformApiKey.ts` — vault entity
- `backend/src/repository/interfaces/ai-assistant/IAiPlatformApiKeyRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiPlatformApiKeyRepository.ts`
- `backend/src/application/ai-assistant/use-cases/AiPlatformApiKeyUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiPlatformApiKeyController.ts`

**Backend — modified**
- `backend/src/api/routes/ai-tool-catalog.routes.ts` — vault routes, platform diagnostic, reset cert
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts` — `runPlatformModelProfileDiagnostics`, `resetModelProfileCertifications`
- `backend/src/application/ai-assistant/use-cases/AiPlatformRuntimeProfileUseCase.ts` — `apiKeyId` dereferencing
- `backend/src/application/ai-assistant/use-cases/AiModelCertificationUseCase.ts` — provider `defaultBaseUrl` fallback
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts` — cascade delete + `resetCertificationsForProfile()`
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts` — status code parsing, context-aware 401, text-plan skip reason, longer text-plan budget
- `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts` — OpenRouter identity headers, `isAvailable()` propagates auth errors
- `backend/src/infrastructure/di/bindRepositories.ts` — DI wiring

**Frontend — new files**
- `frontend/src/modules/super-admin/pages/AiSetupWizardPage.tsx` — 5-step wizard
- `frontend/src/modules/super-admin/pages/AiApiKeysPage.tsx` — vault management page

**Frontend — modified**
- `frontend/src/modules/super-admin/components/CertificationManagerModal.tsx` — status hero, "Fix it" deep link, advanced collapse, reset button
- `frontend/src/modules/super-admin/pages/AiManagementOverviewPage.tsx` — "Set up new AI model" CTA card
- `frontend/src/modules/super-admin/pages/AiRuntimeProfilesPage.tsx` — vault picker, deep-link handler, wizard banner
- `frontend/src/modules/super-admin/pages/AiProvidersPage.tsx` — wizard banner
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx` — wizard banner
- `frontend/src/router/routes.config.ts` — new routes for wizard + vault
- `frontend/src/api/superAdmin/index.ts` — vault types, vault methods, longer cert timeout, platform diagnostic, reset cert endpoint

**Docs**
- `docs/architecture/ai-setup-wizard-and-vault.md` _(new)_
- `docs/user-guide/ai-setup-superadmin.md` _(extended)_
- `planning/ai-flow-rewrite.md` _(initial design doc — kept for reference)_
- `planning/JOURNAL.md`
- `planning/done/99-ai-setup-wizard-and-vault.md` _(this file)_

### Architecture / Behavior

- **Vault dereferencing happens at upsert time, not request time.** `AiPlatformRuntimeProfileUseCase` looks up the vault key by `apiKeyId`, decrypts it, and stores its own re-encrypted copy on the runtime profile. Cert / diagnostics / runtime read the runtime profile's credential directly — no vault round-trips on hot paths. Trade-off: vault key rotation does not auto-propagate; admin must re-pick the vault key on each runtime profile to push the new value down.
- **Wizard has no internal state store.** `completedSteps` is computed from what's actually persisted in the four entities (`AiProvider`, `AiModelProfile`, `AiPlatformRuntimeProfile`, `AiModelCertificationResult`). Save-and-exit is a free feature because there's no state to lose.
- **`apiKeyId` and `apiKey` are mutually exclusive** on runtime profile upsert. Use case honors `apiKeyId` first; falls back to `apiKey`. Enforced at the use case boundary, not the schema level.
- **Cascade delete** for model profiles now wipes associated certifications. Required `IAiModelCertificationRepository` to be added as an optional constructor dep on `AiModelProfileUseCase`.
- **Three pages share the same vault picker UI**: the vault page, wizard Step 3, and the runtime profiles page. Same backend round-trip (`apiKeyId`), same selector card style.

### Verification

- [x] `cd backend && npx tsc --noEmit` clean (only pre-existing jest types / firebase-functions errors unrelated to this change)
- [x] `cd frontend && npx tsc --noEmit` clean
- [ ] `cd frontend && npm run build` — not run this session; user confirmed pages render live
- [x] Manual test of golden path: user landed on wizard, completed Steps 1–3, "Fix it" deep link worked from cert modal
- [ ] Manual test of "Run all categories" — user still to run live with corrected vault key
- [x] Manual test of "Reset certification history" — button visible per screenshot

### Known Issues / Follow-ups

- **Tenant-side wizard** (Deliverable D from the design doc) is not yet built. The tenant AI Assistant settings page (`AiAssistantSettingsPage`) still uses the legacy single-form layout. A mirror 5-step wizard for tenants is the next logical piece.
- **Integration test** (Deliverable B) for the cert flow against a mocked OpenRouter is not written. The live key fix should be locked in by an automated test so it can't regress.
- **Vault → runtime profile credential refresh** is manual. A future enhancement would be an explicit "refresh credentials from vault" action that walks every runtime profile referencing a given vault key.
- **Vault key origin tracking on runtime profiles**: once a runtime profile is created from a vault key, there's no stored reference back to the vault key id. Re-picking is a fresh `apiKeyId` lookup. Acceptable for now; revisit if rotation flows need to be smarter.

---

## 2. End-User View

### What's New

Setting up an AI model on the Super Admin side is now **one guided flow** instead of bouncing between four pages. There's a new **API Key Vault** where you save your provider keys once (OpenRouter, OpenAI, Anthropic, etc.), label them, and test them with one click — and then pick them from a list anywhere a key is needed. Common failure cases (wrong key, missing platform setup) now show a clear "**Fix it →**" button instead of a generic error.

### How to Use It

**For a brand-new AI model:**

1. Go to **Super Admin → AI API Keys** and add the provider key(s) you'll use. Click **Test** on each to confirm it's valid (green badge).
2. Go to **Super Admin → AI Management Overview** and click the big "**Set up a new AI model**" card.
3. Walk through the 5 steps: Provider → Model → Platform Key (pick from vault) → Test → Certify. Save & exit at any step is fine — your progress is persisted.
4. In Step 5, click "**Run all categories**" to certify the model for every ERP area at once.

**To clean up bad certifications:**

1. Go to **Super Admin → AI Models** and open the cert manager (shield icon).
2. Click "**Reset certification history**" (top right). Confirm.
3. Re-run cert from Step 5 of the wizard for the categories you want.

### Where to Find It

- **AI Setup Wizard:** `/super-admin/ai-setup`
- **API Key Vault:** `/super-admin/ai-api-keys`
- **AI Management Overview:** `/super-admin/ai-management`
- All require `SUPER_ADMIN` global role.

### Tips

- Save each provider key to the vault once with a meaningful label ("OpenRouter Personal", "OpenAI Production"). Reuse across every model that needs it — no more copy-pasting the same key into ten places.
- When the cert manager shows the amber "Setup incomplete — no platform API key" hero, click the **Fix it** button instead of navigating manually. It deep-links straight to the right place with the model pre-selected.
- The cert API now waits up to 180 seconds for the model to respond. If you saw "timeout of 30000ms exceeded" before, that's gone — rerun any cert that previously timed out.

### Limitations

- Rotating a vault key doesn't automatically update runtime profiles that were created from it. After rotation, open each affected runtime profile and re-pick the vault key to push the new value down.
- The tenant-side AI setup is unchanged for now — only the Super Admin side has the new wizard. A tenant wizard is on the backlog.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
