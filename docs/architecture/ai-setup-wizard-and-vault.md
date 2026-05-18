# AI Setup Wizard & API Key Vault — Architecture

> **For engineers.** Explains the entities, endpoints, and flow added in
> May 2026 to consolidate AI onboarding into a single guided wizard.

Companion to [`docs/user-guide/ai-setup-superadmin.md`](../user-guide/ai-setup-superadmin.md).

---

## Why this exists

Before this work, super-admin AI setup required hopping between four separate
CRUD pages (Providers, Models, Platform Global Providers, Cert Manager), each
exposing a distinct entity with no flow connecting them. Common failure modes:

- **Zombie cert records**: deleting a model profile did not cascade to
  `AiModelCertificationResult` rows; recreating a profile with the same hash
  surfaced the old cert rows. _Fixed in `AiModelProfileUseCase.deleteProfile()`._
- **Misleading "Provider connection: Passed"**: `OpenAICompatibleProvider.isAvailable()`
  silently caught all errors and returned `true` if config looked valid. _Fixed:
  `ProviderAuthError` / `ProviderRateLimitError` now propagate._
- **Generic "Provider error — please check your configuration"**: the
  sanitizer looked for a non-existent `statusCode` property on `ProviderError`;
  the real status code was inside the message string. _Fixed: parser extracts
  the code and maps 400/402/403/404/etc. to actionable messages._
- **Certification used the wrong base URL**: `AiModelCertificationUseCase`
  built its provider config with `profile.baseUrl`, falling through to
  `https://api.openai.com/v1` if unset. _Fixed: certification now looks up
  the provider entity's `defaultBaseUrl` as fallback (requires
  `IAiProviderRepository` in DI)._
- **OpenRouter Anthropic models returned 401**: missing `HTTP-Referer` /
  `X-Title` identity headers. _Fixed: `applyOpenRouterIdentityHeaders()` is
  applied on every chat/streaming/models call when the endpoint contains
  `openrouter.ai`._

The wizard fixes the **flow problem** on top of these bug fixes.

---

## New entity: `AiPlatformApiKey`

A first-class vault for the super-admin's personal API keys.

```ts
interface AiPlatformApiKeyProps {
  id: string;                                  // UUID
  label: string;                               // user-facing
  providerId: string;                          // ref → AiProvider.id
  providerName: string;                        // denormalized for display
  encryptedKey: string;                        // never exposed to clients
  credentialHint: string;                      // "****abcd"
  lastValidatedAt?: Date;
  lastValidationStatus: 'unknown' | 'valid' | 'invalid';
  lastValidationDetail?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Persistence:** Firestore at `system_metadata/ai_api_keys/items/{id}`.

**Validation** (`AiPlatformApiKeyUseCase.validate()`):
1. Look up the provider entity (must exist and have a `defaultBaseUrl`).
2. Decrypt the stored key.
3. `GET {baseUrl}/models` with `Authorization: Bearer <key>` and OpenRouter
   identity headers if the endpoint is `openrouter.ai`.
4. Map the result to a `lastValidationStatus` + `lastValidationDetail` and
   persist back to Firestore. Uses our `ProviderError` hierarchy to produce
   readable messages (`ProviderAuthError` → "Authentication failed — provider
   rejected the key", etc.).

### Rotation semantics

When `update()` receives a new `apiKey`, the validation status resets to
`unknown` and `lastValidationDetail`/`lastValidatedAt` are cleared. The next
**Test** click revalidates. This prevents stale "Valid" badges from
misleading the admin after a key rotation.

### Why vault keys are still "stored" in runtime profiles

A runtime profile sources its credential from the vault **at creation time**,
not at request time. Specifically, `AiPlatformRuntimeProfileUseCase.upsertProfile()`:
1. If `apiKeyId` is provided, look up the vault key, decrypt it.
2. Re-encrypt the plaintext for the runtime profile's own `encryptedCredential`.
3. Copy the vault's `credentialHint` to the runtime profile.

This avoids dereferencing the vault on every cert / diagnostic / runtime call
and keeps the existing decrypt paths in `AiModelCertificationUseCase` and
`CheckProviderHealthUseCase` unchanged. **Trade-off:** rotating a vault key
doesn't propagate to existing runtime profiles automatically — the admin has
to re-pick the vault key on each profile to push the new value down. This is
an acceptable price for keeping the read paths simple; a future improvement
would be to add a "refresh credentials from vault" action.

---

## Endpoints

All under `/api/super-admin/...`, guarded by `assertSuperAdmin`.

### Vault
| Method | Path | Notes |
|---|---|---|
| GET | `/platform/ai-api-keys` | List, sorted by label |
| POST | `/platform/ai-api-keys` | `{ label, providerId, apiKey, notes? }` |
| PATCH | `/platform/ai-api-keys/:keyId` | `{ label?, apiKey?, notes? }` — sending `apiKey` rotates and resets validation |
| DELETE | `/platform/ai-api-keys/:keyId` | Hard delete — no cascade since runtime profiles already have their own copy |
| POST | `/platform/ai-api-keys/:keyId/validate` | Hits provider `/models`, persists status |

### Diagnostics (new platform-scoped variant)
| Method | Path | Notes |
|---|---|---|
| POST | `/platform/ai-model-profiles/:profileId/diagnostics/platform` | Reads the API key from the **active runtime profile** for this model. Used by wizard Step 4. Replaces the brittle pattern of passing a fake company id to the tenant-scoped diagnostic endpoint. |

### Cascade delete & cert reset
| Method | Path | Notes |
|---|---|---|
| DELETE | `/platform/ai-model-profiles/:profileId` | Now cascades to `AiModelCertificationResult` records |
| DELETE | `/platform/ai-model-profiles/:profileId/certifications` | Wipes cert history without deleting the profile — used by "Reset certification history" button in the Cert Manager modal |

---

## Wizard architecture

`AiSetupWizardPage` is a single component at `/super-admin/ai-setup` with an
internal `currentStep` state machine over the five steps. Each step is a
sibling component (`StepProvider`, `StepModel`, `StepPlatformKey`, `StepTest`,
`StepCertify`) sharing a `WizardState`:

```ts
interface WizardState {
  providerId: string | null;
  modelProfileId: string | null;
  runtimeProfileId: string | null;
  diagnosticsPassed: boolean;
  certifiedCategories: AiCertificationCategory[];
}
```

### State persistence

The wizard **does not store its own state** in localStorage or a wizard-state
table. Each step persists to the actual backend entity it represents
(`AiProvider`, `AiModelProfile`, `AiPlatformRuntimeProfile`, `AiModelCertificationResult`).
On mount and after each step's save, the wizard refetches all four lists and
recomputes `completedSteps` from what's actually in the database:

```ts
const completedSteps = useMemo(() => {
  const set = new Set<StepId>();
  if (state.providerId) set.add('provider');
  if (state.modelProfileId) set.add('model');
  if (state.runtimeProfileId) set.add('platformKey');
  if (state.diagnosticsPassed) set.add('test');
  if (state.certifiedCategories.length > 0) set.add('certify');
  return set;
}, [state]);
```

This makes the **"save & exit" / come back later** flow free: there's no
wizard-state-loss risk because there is no wizard state.

### Step 3's vault picker

`StepPlatformKey` receives `vaultKeys` from the parent and filters to the
selected provider. Mode auto-defaults:

- ≥1 vault key for the provider → **"Pick from vault"** mode, first key selected
- 0 vault keys → **"Paste a new key"** mode, with an inline "+ Also save to
  vault" form that creates the vault entry and switches to vault mode on success

The payload sent to `POST /platform/ai-runtime-profiles` is one of:
- `{ ..., apiKeyId: "<vault-uuid>" }` — vault mode
- `{ ..., apiKey: "sk-..." }` — paste mode

The backend (`AiPlatformRuntimeProfileUseCase`) honors `apiKeyId` first, falling
back to `apiKey`. The mutually-exclusive contract is enforced at the use case
boundary, not at the schema level.

### Step 4's platform diagnostic

`StepTest` calls the **new** `runPlatformDiagnostics` API method, which hits
`POST /platform/ai-model-profiles/:id/diagnostics/platform`. The backend:

1. Looks up the model profile.
2. Finds the active runtime profile for it (`p.modelProfileId === profile.id && p.status === 'active'`).
3. Decrypts the runtime profile's credential.
4. Resolves the base URL (model profile's > provider's `defaultBaseUrl`).
5. Constructs an `AiProviderConfig` and calls `CheckProviderHealthUseCase.executeWithConfig()`.

No fake `companyId` is involved. This is the canonical path for **testing a
saved platform configuration**.

### Step 5's "Run all categories"

`StepCertify` exposes both:
- A single-category Certify button (existing behavior).
- A "Run all categories" button that sequentially calls
  `runOneCategory(cat)` for each of the 12 categories. Per-category status
  is reflected live in the result list. Confirms first since cert can take
  a few minutes per category.

The cert API client (`runGlobalCertification`) now uses a **180s timeout**
matching the diagnostics timeout. The default 30s was killing live cert
calls before the model could respond.

---

## How existing pages connect to the wizard

All three legacy CRUD pages (`AiProvidersPage`, `AiModelProfilesPage`,
`AiRuntimeProfilesPage`) now render a small indigo banner at the top of the
list view:

> **Setting up a new AI model?** Use the guided wizard — it handles
> provider, model, key, test, and certification in one linear flow.
> [Open setup wizard →]

The pages remain available as power-user editing surfaces for already-set-up
models. They are not in the main nav by default — only the wizard, overview,
and vault pages are headline destinations.

### Runtime Profiles page — same vault picker

`AiRuntimeProfilesPage` got the **same vault-vs-paste toggle** as wizard
Step 3, so editing an existing runtime profile honors the vault. The deep
link from the Cert Manager modal (`/super-admin/ai-runtime-profiles?modelProfileId=<id>`)
auto-opens the create or edit form for that model.

---

## DI wiring summary

```
aiPlatformApiKeyRepository (new)
  ↑ used by
aiPlatformApiKeyUseCase (new)
  needs: apiKeyRepository, providerRepository, encryptionService, httpClient
  ↑ used by
AiPlatformApiKeyController (new)

aiPlatformRuntimeProfileUseCase (extended)
  now accepts: apiKeyRepository (optional)
  reads apiKeyId from input, dereferences vault server-side

aiModelCertificationUseCase (extended)
  now accepts: providerRepository (optional)
  resolves baseUrl via provider.defaultBaseUrl as fallback

aiModelProfileUseCase (extended)
  now accepts: certificationRepository (optional)
  deleteProfile() cascades to certification records
  new resetCertificationsForProfile() method
```

All wired in `infrastructure/di/bindRepositories.ts`.

---

## Migration / rollout notes

- **No database migrations required.** The vault collection is new and
  starts empty. Existing runtime profiles keep their inline credentials.
- **Backward compatible**: `apiKey` (inline) still works on runtime profile
  upsert. Old clients that don't know about the vault continue to function.
- **Tenant impact**: zero. Tenant-side AI settings (`AiProviderConfig`) and
  the BYOK/Credits resolution path are unchanged.
- **Auto-cert behavior** (`AiAutoSeedCertification`) still runs after model
  profile save for the same well-known model list — but the **cascade delete**
  ensures recreating a deleted profile gets a fresh cert, not a zombie one.

---

## Files touched

### Backend
- `backend/src/domain/ai-assistant/entities/AiPlatformApiKey.ts` _(new)_
- `backend/src/repository/interfaces/ai-assistant/IAiPlatformApiKeyRepository.ts` _(new)_
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiPlatformApiKeyRepository.ts` _(new)_
- `backend/src/application/ai-assistant/use-cases/AiPlatformApiKeyUseCase.ts` _(new)_
- `backend/src/api/controllers/ai-assistant/AiPlatformApiKeyController.ts` _(new)_
- `backend/src/api/routes/ai-tool-catalog.routes.ts` _(routes added)_
- `backend/src/infrastructure/di/bindRepositories.ts` _(DI wiring)_
- `backend/src/application/ai-assistant/use-cases/AiPlatformRuntimeProfileUseCase.ts` _(vault dereferencing)_
- `backend/src/application/ai-assistant/use-cases/AiModelCertificationUseCase.ts` _(provider baseUrl fallback)_
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts` _(cascade delete, reset method)_
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts` _(sanitizer parses real status codes; context-aware 401 messaging; text-plan skip reason)_
- `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts` _(OpenRouter identity headers; isAvailable no longer swallows auth errors)_
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts` _(new `runPlatformModelProfileDiagnostics` and `resetModelProfileCertifications` endpoints)_

### Frontend
- `frontend/src/modules/super-admin/pages/AiSetupWizardPage.tsx` _(new — 5-step wizard)_
- `frontend/src/modules/super-admin/pages/AiApiKeysPage.tsx` _(new — vault management)_
- `frontend/src/modules/super-admin/components/CertificationManagerModal.tsx` _(redesigned — status hero, "Fix it" deep link, advanced collapse, reset button)_
- `frontend/src/modules/super-admin/pages/AiManagementOverviewPage.tsx` _(big "Set up new AI model" CTA card)_
- `frontend/src/modules/super-admin/pages/AiRuntimeProfilesPage.tsx` _(vault picker toggle, deep-link handler)_
- `frontend/src/modules/super-admin/pages/AiProvidersPage.tsx` _("Open setup wizard" banner)_
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx` _("Open setup wizard" banner)_
- `frontend/src/router/routes.config.ts` _(new routes)_
- `frontend/src/api/superAdmin/index.ts` _(vault types + methods, longer cert timeout, platform diagnostic, reset cert endpoint)_
