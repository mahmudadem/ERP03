# AI Setup Flow Rewrite — Plan

**Status:** Awaiting approval
**Author:** Claude (Sonnet 4.6)
**Date:** 2026-05-17

---

## 1. The problem (stated bluntly)

The AI setup feature today is **6 disconnected pages** that touch **5 backend entities**, with **no flow** linking them. Even understanding "what step am I on?" is impossible — for the developer, for the superadmin, and for the tenant.

Concrete bugs that prove the chaos:
1. **Old cert records reappear after deleting a profile.** Certs are keyed by `profileHash` (SHA-256 of config). Deleting the profile doesn't delete the certs. Recreating with identical settings → same hash → old cert rows reattach. No cascade.
2. **"Provider connection: Passed" lied.** Was silently swallowing auth errors. Just fixed.
3. **Diagnostics use the key the user types; Certification uses the key stored in the runtime profile.** Different keys, same model — no warning. User has to know this implicitly.
4. **The same API key effectively lives in 2-3 places**: Runtime Profile (platform key), AiProviderConfig (tenant key), Diagnostics modal (one-shot key). Each has its own page.

The root cause is **architectural fragmentation, not UI polish**. No amount of color-tweaking fixes it.

---

## 2. Today's entities (the moving parts)

| Entity | What it is | Where the user goes |
|---|---|---|
| `AiProvider` | OpenAI, OpenRouter, Anthropic, etc. — name + base URL + auth type | Super Admin → AI Providers |
| `AiModelProfile` | A model on a provider (gpt-4o, claude-sonnet-4.6) + runtime config | Super Admin → AI Model Profiles |
| `AiPlatformRuntimeProfile` | Superadmin's API key + budget for a (provider, model) pair, used when tenants run on platform credits | Super Admin → Platform Global Providers |
| `AiModelCertificationResult` | "This model passed tests for category X" record (CERTIFIED/FAILED/PENDING) | Modal on Model Profile row |
| `AiProviderConfig` (tenant) | Tenant's own API key + chosen model + mode (BYOK or CREDITS) | Tenant → AI Assistant Settings |

That's the inventory. **None of these need to disappear.** They're correctly normalized. The problem is the UI exposes them as independent CRUD pages instead of as steps in a single flow.

---

## 3. The two flows (what we're building)

### Super Admin flow — "Add a model so tenants can use it"

```
[1] Register Provider  →  [2] Add Model  →  [3] Fund Platform Key  →  [4] Diagnose  →  [5] Certify  →  [6] Publish
```

Each step is a **screen in a wizard**, with progress visible at all times. Each step writes one entity. Each step has a **status badge** so you can leave and come back without confusion.

### Tenant flow — "Connect AI to my company"

```
[1] Pick Mode (BYOK or Credits)  →  [2] Choose Model  →  [3] Connect Key (or buy credits)  →  [4] Test  →  [5] Enable
```

Both flows live behind a single "**Set up AI**" CTA, not buried in side-nav.

---

## 4. The five concrete deliverables

### Deliverable A — Cascade delete + cert reset (the blocking bug)

**Files to change:**
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts` — in `deleteProfile()`, call `certificationRepository.listByModelProfile(id)` and delete each one before deleting the profile
- `backend/src/repository/interfaces/ai-assistant/IAiModelCertificationRepository.ts` — add `deleteByModelProfileId(id): Promise<number>` if not already there
- `frontend/src/modules/super-admin/components/CertificationManagerModal.tsx` — add a "Reset certification history" button that calls a new endpoint to wipe all certs for the current profile hash. Confirms with the user first.

**New endpoint:**
- `DELETE /api/super-admin/ai-model-profiles/:id/certifications` — wipes all cert records for a profile (without deleting the profile itself)

**Why first:** Until this is fixed, the user can't even start fresh to test the rest of the work.

### Deliverable B — Integration test for the full cert flow

**File:** `backend/src/tests/application/ai-assistant/CertificationFlow.integration.test.ts` (new)

What it does:
1. Spins up the full cert use case with mocked `IHttpClient` that returns OpenRouter-shaped responses
2. Walks the entire chain: create provider → create model profile → create runtime profile with fake key → run shell certification → assert result is CERTIFIED with score > 0
3. Covers the failure modes too: wrong key (401), no credits (402), no model access (403), model not found (404)

**Why this and not a live test with your key:** This test runs on every commit. A live test runs once and rots.

### Deliverable C — Superadmin "Add a Model" wizard

**Files:**
- `frontend/src/modules/super-admin/pages/AiSetupWizardPage.tsx` (new) — route `/super-admin/ai-setup`
- `frontend/src/modules/super-admin/components/wizard/StepProvider.tsx`
- `frontend/src/modules/super-admin/components/wizard/StepModel.tsx`
- `frontend/src/modules/super-admin/components/wizard/StepRuntimeKey.tsx`
- `frontend/src/modules/super-admin/components/wizard/StepDiagnose.tsx`
- `frontend/src/modules/super-admin/components/wizard/StepCertify.tsx`
- `frontend/src/modules/super-admin/components/wizard/StepPublish.tsx`

UI behavior:
- Stepper at the top, 6 dots, current step highlighted, completed steps green
- "Back / Next" buttons, "Save & exit" at every step (state persists in the entities — no in-memory wizard state)
- Each step pre-populates from existing entities if you're editing an existing model
- The existing CRUD pages remain available for power users (don't remove them — they're useful for editing one entity)
- The Overview page gains a big primary button: "**+ Set up a new AI model**" that opens this wizard

### Deliverable D — Tenant "Connect AI" wizard

**Files:**
- `frontend/src/modules/ai-assistant/pages/AiConnectWizardPage.tsx` (new) — route `/ai-assistant/connect`
- 5 step components (similar structure to above)

The existing `AiAssistantSettingsPage.tsx` becomes the "advanced settings" page for tenants who already finished onboarding.

### Deliverable E — In-app docs + "How it works"

**Files:**
- `docs/user-guide/ai-assistant/superadmin-setup.md` (new) — the superadmin journey, written for a non-technical owner
- `docs/user-guide/ai-assistant/tenant-setup.md` (new) — the tenant journey
- `frontend/src/modules/super-admin/components/HowItWorksPanel.tsx` (new) — slide-out panel that renders a doc inline
- A "**How it works**" button in the page header of every AI page (both sides) that opens the relevant panel

The docs answer the questions you've been asking me in this session — written down so you (or anyone) can re-read them at 2 AM without rediscovering them.

---

## 5. What I'm NOT doing

To keep scope honest:
- Not renaming the existing entities. They're fine.
- Not building a credit-purchase UI. Out of scope; assumes credits are added separately.
- Not adding multi-region or BYOK-Anthropic-via-OpenRouter detection. Use the simple "type your key, test it" flow; future-us can specialize.
- Not redesigning the chat UI itself. Only the setup/governance path.
- Not adding a Slack-style onboarding tour. The wizard IS the onboarding.

---

## 6. Order of execution (recommended)

| # | Deliverable | Why this order | Approx effort |
|---|---|---|---|
| 1 | **A** — Cascade delete + reset button | Unblocks fresh-state testing. Small. | 1 hour |
| 2 | **B** — Integration test | Proves cert works for real, forever. Catches regressions in everything that comes after. | 2 hours |
| 3 | **E** — Docs + "How it works" panel | Cheap, immediate clarity. Becomes the spec for the wizards. | 2 hours |
| 4 | **C** — Superadmin wizard | The big one. Once the docs exist, building this is filling in the screens. | 4-6 hours |
| 5 | **D** — Tenant wizard | Mirror of C, smaller surface. | 3 hours |

**Total**: ~12-15 hours of focused work. Doable in 3-4 sessions.

---

## 7. What I need from you before I start

1. **Approve this plan as-is, or push back on specific items.** I'll redo the plan if anything doesn't match what you want.
2. **Confirm**: should the existing CRUD pages (AI Providers, AI Model Profiles, Platform Global Providers, etc.) stay, or be deleted once the wizards exist? My recommendation: **keep them** as power-user editing surfaces, but make them un-findable from main nav — only accessible from the wizard's "edit step" links.
3. **Confirm the failing cert** — once I land Deliverable A (cascade delete), can you delete the broken profile, recreate it with the **correct** OpenRouter key in the runtime profile, and confirm certification passes? That gives me a known-good state to build the wizards against.

---

## 8. Open questions I noticed during exploration

- Should **TENANT-scoped** model profiles (BYOK custom models) go through the wizard too, or only GLOBAL profiles? My instinct: same wizard, just with scope=TENANT and a different starting page (tenant's wizard).
- The current "Auto-certification" service (`AiAutoSeedCertification`) auto-marks 7 well-known models as certified the moment they appear with a matching profile hash. Should the wizard run auto-cert silently in Step 5, or always show the user the test results explicitly? My instinct: **always show**. Magic is the enemy of trust.

---

If anything in this plan smells off, push back hard. I'd rather rewrite the plan than rewrite the implementation.
