# AI Assistant Runtime v2 Architecture

Date: 2026-05-07

## Purpose

AI Assistant Runtime v2 makes model-requested tool use safe and provider-agnostic. The model is treated as untrusted. It can request structured tool calls, but ERP-owned backend services decide whether a request is allowed.

## Runtime Flow

1. User sends a chat message.
2. Backend loads company AI settings and model/provider capability profile.
3. Backend prepares safe tool contracts from registered ERP tool definitions.
4. Backend prepares keyword hints from Super Admin chat keywords. These are advisory only.
5. The model receives schema-aware tool cards and decides the plan.
6. Provider may return native structured tool-call requests, or text-only/unknown models may return an `ERP_TOOL_PLAN` JSON block.
7. `AiRuntimeGuard` validates each request:
   - registered tool only,
   - allowed mode only,
   - no model-supplied tenant/user identity,
   - permission/RBAC still required,
   - tenant context comes from server context,
   - write/proposal/draft execution blocked.
8. Approved read-only tools can execute through the existing tool registry/orchestrator.
9. Tool results are returned to the model.
10. The model may request another read-only tool or produce the final response.
11. Frontend displays runtime metadata, warnings, tool status, and proposal cards.

## Tool Planning Model

The runtime is now AI-led and keyword-assisted.

- Super Admin `chatKeywords` are used as hints to check first.
- Keyword matches do not execute tools.
- The model sees allowed tool cards with names, descriptions, input schemas, output schemas, keywords, examples, and safety notes.
- Native tool-capable models use provider function/tool calling.
- Text-only or unknown models can return a guarded `ERP_TOOL_PLAN` block:

```json
{
  "calls": [
    {
      "tool": "accounting_getTrialBalanceSummary",
      "arguments": {
        "asOfDate": "2026-05-08"
      },
      "reason": "trial balance requested"
    }
  ]
}
```

The text-plan format is not trusted. It is parsed and sent through the same Runtime Guard path as native provider tool calls.

## Key Files

### Domain / Contracts
- `backend/src/domain/ai-assistant/tools/AiToolContract.ts`
- `backend/src/domain/ai-assistant/entities/AiToolDefinition.ts`

### Providers
- `backend/src/application/ai-assistant/providers/IAiProvider.ts`
- `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts`
- `backend/src/application/ai-assistant/providers/MockProvider.ts`

### Runtime Services
- `backend/src/application/ai-assistant/services/AiRuntimeGuard.ts`
- `backend/src/application/ai-assistant/services/AiAuditService.ts`
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`

### Use Case / DI
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`

### Frontend
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiProposalListPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiProposalDetailPage.tsx`
- `frontend/src/modules/super-admin/pages/AiProposalPolicyPage.tsx`

## Safety Boundaries

- Never instantiate repositories directly from controllers or runtime services.
- Never trust model-supplied `companyId`, `userId`, permission, role, or module claims.
- Never execute write tools from model output.
- Keep Firestore-specific code in infrastructure repositories only.
- Keep Proposal Sandbox separate from execution; proposals are reviewable suggestions only.
- Keep Super Admin policy management separate from tenant chat/proposal flows.

## Provider Compatibility

- Structured tool-capable providers can receive ERP-owned tool contracts.
- Text-only/unknown providers do not receive native tool contracts, but can propose guarded `ERP_TOOL_PLAN` JSON when the prompt/context is sufficient.
- Unknown/custom models still show warnings and conservative capability assumptions.
- Deterministic keyword auto-execution is no longer part of chat. Keywords are planning hints only.

## Verification

- Frontend typecheck passed.
- Backend typecheck passed.
- Targeted AI runtime/proposal tests passed: 4 suites, 103 tests.

## 2026-05-08 Update

AI Assistant chat now supports AI-led multi-round tool planning:

- backend keyword hints are advisory context;
- native structured tool calls can chain across multiple rounds;
- unknown/text-only models can request read-only tools through guarded `ERP_TOOL_PLAN`;
- tool execution still requires Runtime Guard approval.

Verification:

- `backend`: `npm run typecheck` passed.
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` passed, 331 tests.
- `backend`: `npm run build` passed.

## 2026-05-08 Settings Diagnostics Update

The AI Settings provider health endpoint now returns model diagnostics in addition to connection readiness.

Endpoint:

- `POST /tenant/ai-assistant/settings/health`

The endpoint still uses saved company AI settings only. It never receives or returns API keys and it never includes ERP data in diagnostic prompts.

Diagnostics returned:

- provider connection check;
- basic model response check;
- native OpenAI-style `tool_calls` probe using a private `diagnostics_ping` tool contract;
- guarded `ERP_TOOL_PLAN` text-plan probe when native tool calling does not work or the catalog marks the model as text-only;
- catalog profile summary from `AiModelCapabilityCatalog`;
- recommended runtime mode: `native-tool-calling`, `text-plan`, `text-only`, or `unavailable`.

Key files:

- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
- `backend/src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts`
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/locales/*/aiAssistant.json`

Verification:

- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` passed, 3 tests.
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` passed, 338 tests.
- `backend`: `npm run typecheck` passed.
- `backend`: `npm run build` passed.
- `frontend`: `npm run typecheck` passed.
- `frontend`: `npm run build` passed.
- `graphify update .` was attempted but `graphify` is not available on PATH.

## 2026-05-09 Conversation Context Update

The AI Assistant now treats each user turn as part of one continuous conversation.

Before answering or planning tools, the model is instructed to:

- review the current message, recent chat history, and previous tool results;
- answer from already fetched data when that data is sufficient;
- call the minimum additional read-only tools only when more ERP data is needed;
- ask a short clarification before answering or calling tools when the intent or required extra information is truly ambiguous;
- avoid asking the user again for information already present in conversation context or previous tool results.

Implementation notes:

- `SendChatMessageUseCase` still sends recent chat messages as provider messages.
- It now also builds a compact `[RECENT ERP DATA FROM THIS CONVERSATION]` block from recent assistant message `metadata.toolResults`.
- The block is injected into the system prompt before schema-aware tool planning context, so the model can decide whether the current follow-up already has enough fetched data.
- The base orchestration skill and tool planning rules were updated with broad context-first behavior instead of case-specific instructions.

Verification:

- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts src/tests/application/ai-assistant/AiToolCalling.test.ts` passed, 32 tests.
- `backend`: `npm run typecheck` passed.

## 2026-05-09 Context Budget and Cost Controls

Conversation context is now settings-driven so companies using their own API keys can decide how much chat history and previous ERP tool data should be sent to the model.

Settings:

- `conversationContextMode`: `minimal`, `balanced`, or `deep`
- `includePreviousToolResults`: boolean

Default behavior:

- existing saved configs default to `balanced`;
- previous tool-result reuse is enabled by default;
- admins can turn previous tool-result context off to reduce token use.

Runtime behavior:

- `SendChatMessageUseCase` resolves a context budget from the saved provider config.
- The budget controls how many recent messages are fetched, how many are sent to the provider, per-message truncation, how many previous tool results are summarized, and the total previous-tool-result prompt size.
- If history or tool context is trimmed, the assistant response metadata includes a runtime warning explaining that context was limited to control AI token cost.
- Tool-result context remains generic. It is built from recent assistant message `metadata.toolResults`; no account name, report, or user scenario is hardcoded into production logic.

Budget profiles:

| Mode | Intent |
| --- | --- |
| `minimal` | Lowest token usage, short follow-up memory |
| `balanced` | Recommended default for normal ERP chat |
| `deep` | More continuity for longer analysis, higher token use |

Key files:

- `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts`
- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/api/validators/ai-assistant.validators.ts`
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/locales/*/aiAssistant.json`

Verification:

- `backend`: `npm run test -- --runInBand src/tests/domain/ai-assistant/AiProviderConfig.test.ts src/tests/application/ai-assistant/AiSettingsUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` passed, 52 tests.
- `backend`: `npm run typecheck` passed.
- `frontend`: `npm run typecheck` passed.
- `frontend`: `npm run build` passed.
- `backend`: `npm run build` passed.

## 2026-05-09 Editable Model Profile Catalog

Model capability and trust status are now editable platform data instead of chat relying only on a static in-code catalog.

Why this exists:

- Diagnostics prove provider connectivity and model behavior for the saved settings at that moment.
- Chat runtime still needs a persisted model profile to decide whether the model is tested, experimental, custom, text-only, or native-tool capable.
- A model can pass diagnostics but remain `untested` until Super Admin updates its platform profile.

Storage:

- Firestore collection path: `system_metadata/ai_model_profiles/catalog`
- Document ID: `${encodeURIComponent(provider)}:${encodeURIComponent(modelName)}`
- The stored `modelName` field remains the original human/provider model name, for example `google/gemma-4-31b-it:free`.
- The static `AiModelCapabilityCatalog` remains a seed/fallback source only.
- Runtime resolution is DB-first through `AiModelProfileUseCase`; DB profiles override seed/fallback profiles.

Editable fields include:

- provider and model name;
- status: `tested`, `experimental`, `custom`, `deprecated`, `blocked`;
- native tool-calling support;
- structured JSON support;
- max context tokens;
- recommended use cases;
- tags;
- warning level/message;
- text-only mode.

Diagnostics persistence:

- `CheckProviderHealthUseCase` records last diagnostic status, recommended runtime mode, timestamp, company ID, and detail message on the model profile.
- Passing diagnostics does not automatically promote the model to `tested`. Super Admin controls that trust/status decision.

API endpoints:

- `GET /platform/ai-model-profiles`
- `POST /platform/ai-model-profiles`
- `POST /platform/ai-model-profiles/sync`
- `GET /platform/ai-model-profiles/:profileId`
- `PATCH /platform/ai-model-profiles/:profileId`
- `DELETE /platform/ai-model-profiles/:profileId`
- `POST /platform/ai-model-profiles/:profileId/diagnostics`

Super Admin UI:

- Route: `/super-admin/ai-models`
- Page: `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx`
- Super Admin can run diagnostics for a selected model profile using a selected company's saved provider settings. API keys stay in company settings and are never exposed to Super Admin UI responses.

Key files:

- `backend/src/domain/ai-assistant/entities/AiModelProfile.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelProfileRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelProfileRepository.ts`
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/routes/ai-tool-catalog.routes.ts`
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx`

Verification:

- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` passed, 22 tests.
- `backend`: `npm run typecheck` passed.
- `frontend`: `npm run typecheck` passed.
- `backend`: `npm run build` passed.
- `frontend`: `npm run build` passed.

### Firestore ID Fix

The internal model profile document ID is URL-encoded because provider model names can contain `/` or `:`. Firestore treats `/` as a path separator, so raw IDs such as `openai_compatible:google/gemma-4-31b-it:free` are invalid document paths. The domain helper now produces IDs like `openai_compatible:google%2Fgemma-4-31b-it%3Afree`.

### Super Admin Diagnostics

Super Admin diagnostics reuse `CheckProviderHealthUseCase`.

Flow:

1. Super Admin selects a model profile.
2. Super Admin selects a company whose saved AI provider settings should be used.
3. Backend loads and decrypts that company's saved AI config internally.
4. Backend overrides only the provider/model for the diagnostic run.
5. Provider connection, inference, native tool calling, and guarded text-plan checks run with safe prompts only.
6. Diagnostic result is recorded on the selected model profile.

This keeps secrets out of platform responses while letting Super Admin test model profiles against real company BYOK/provider settings.

## Backend Trust Foundation: Provider -> Profile -> Certification -> Routing

Increment 1 adds the backend trust boundary for model routing. The old model catalog may still provide display and diagnostics hints, but it is not an authorization source for ERP tools.

### Runtime Profile Identity

`AiModelProfile` now represents the exact runtime profile. Important identity fields:

- `scope`: `GLOBAL` or `TENANT`
- `tenantId` for tenant-scoped profiles
- `providerId`
- `modelId`
- `endpointFingerprint`
- runtime settings: temperature, max output tokens, JSON mode, tool mode, timeout, retry policy, policy IDs
- `profileHash`
- `revision`
- `enabled`

`profileHash` is deterministic and changes when any runtime-relevant field changes. Certification must match both `modelProfileId` and `profileHash`.

### Certification Results

`AiModelCertificationResult` stores GLOBAL or TENANT certification for a specific profile hash and category/module/skill. A tenant certification only applies to the matching tenant.

The initial fixed category registry lives in `AiCertificationCategory.ts` and uses stable stored IDs such as `ACCOUNTING`, `FINANCE_REPORTING`, `SALES`, `TOOL_CALLING`, and `DATA_FILTERING`.

### Tenant Settings

`AiProviderConfig` now stores:

- `mode`: `certified_profile`, `custom_uncertified`, or `legacy_unverified`
- `providerId`
- `selectedModelProfileId`
- `selectedProfileHash`

Existing settings that only contain free-text provider/model/endpoint hydrate as `legacy_unverified`. They are not silently certified.

### Routing Enforcement

`AiModelRoutingGuard` validates sensitive tool workflows before tool contracts are exposed to the model. It verifies:

- AI is enabled.
- tenant mode is `certified_profile`.
- selected profile ID/hash exists.
- profile exists, is enabled, and is not blocked/deprecated.
- tenant-scoped profiles belong to the current tenant.
- provider/model identity matches selected tenant settings.
- selected hash equals current profile hash.
- a valid certification exists for the category/module and current tool/data-filter versions.

`AiRuntimeGuard` also stores the certification decision on the run context, so model-requested tool calls are rejected if the certification gate is closed.

### Increment 2 TODO

- Add deeper automated ERP module test suites.
- Add production migration tooling/report for old settings/profiles.
- Add frontend selection and certification UI.

## Certification Workflow APIs

Increment 2 adds backend/API support for certification workflows.

### Provider Registry

Provider registry records metadata only. API keys remain tenant-owned BYOK or future Super Admin test configuration outside tenant responses.

Super Admin routes:

- `GET /platform/ai-providers`
- `POST /platform/ai-providers`
- `GET /platform/ai-providers/:providerId`
- `PATCH /platform/ai-providers/:providerId`
- `PATCH /platform/ai-providers/:providerId/enable`
- `PATCH /platform/ai-providers/:providerId/disable`

### GLOBAL Certification

Super Admin routes:

- `GET /platform/ai-model-profiles/:profileId/certifications`
- `POST /platform/ai-model-profiles/:profileId/certifications/manual`
- `POST /platform/ai-model-profiles/:profileId/certifications/run`
- `PATCH /platform/ai-certifications/:certificationId/expire`
- `GET /platform/ai-certifications/valid`

Manual certification requires:

- current `profileHash`
- `category`
- optional `moduleId` / `skillId`
- `score`
- `maxScore`
- `status`
- `testSuiteVersion`
- `toolContractVersion`
- `dataFilterPolicyVersion`
- `summary`

The backend rejects certification if `profileHash` does not match the current model profile hash.

### TENANT Certification

Tenant routes:

- `POST /ai-assistant/settings/custom-model-profiles`
- `POST /ai-assistant/settings/custom-model-profiles/:profileId/diagnostics`
- `POST /ai-assistant/settings/custom-model-profiles/:profileId/certifications/run`
- `GET /ai-assistant/certified-profiles`

Tenant certification stores `scope = TENANT` and the current `companyId`. It is not returned by GLOBAL certified profile queries and cannot be used by another tenant.

### Certification Engine Shell

`AiCertificationEngine` currently performs deterministic structural checks only:

- profile exists;
- submitted hash matches current profile hash;
- category is valid;
- profile is enabled and not blocked/deprecated;
- tool mode is compatible for tool/accounting/finance categories;
- data filter policy identity is present for sensitive categories.

It does not fake deep accounting correctness. Manual certification entries are explicitly marked through metadata and summary.

### Dev Seed Helper

For local routing tests, run:

```bash
npx ts-node src/scripts/seedAiCertifiedProfileDev.ts
```

The helper creates provider/profile/certification metadata without storing API keys.

## Streaming Tool Result Reliability

Updated on 2026-05-15.

The streaming chat path now treats tool execution as a separate result from runtime-guard approval:

- `tool_result` SSE events include `error`, `durationMs`, and `round`.
- The frontend treats a tool event with an `error` as unavailable data even when the runtime guard approved the call.
- `StreamChatMessageUseCase` passes only the current planning round's tool results back to the provider, instead of re-sending every accumulated result on every round.
- Repeated successful calls with the same resolved tool name and normalized arguments reuse the already returned result within the same run.

This keeps multi-round planning from repeatedly calling tools such as `accounting.getAccountBalance` after the needed data has already been returned, and it preserves the actual backend failure reason when a model supplies missing or invalid arguments.

## 2026-05-17 Proactive Certification Diagnostics

To prevent certification processes from failing silently or producing generic test failures when a provider is unavailable, we implemented a proactive pre-flight diagnostic check within `AiModelCertificationUseCase.runShellCertification`.

### Pre-flight Diagnostic Flow

Before executing the expensive behavioral and deep probe test suites via the certification engine, a lightweight pre-flight connectivity and capabilities check is performed:

1. **Provider Resolution**: The use case resolves the provider based on scope (`TENANT` BYOK settings or `GLOBAL` platform runtime profiles).
2. **Provider Availability Check**:
   - The use case verifies network connectivity using `provider.isAvailable()`.
   - If connectivity fails, it halts early with `networkOk: false`.
3. **Provider Inference Check**:
   - The use case runs a lightweight inference check using a secure, low-latency, and cost-efficient test prompt (`Reply with only: provider-ok`).
   - If the model throws an error (e.g. invalid API key, model not found, rate limits exceeded), it halts early with `networkOk: true` and `inferenceOk: false`.
4. **Early Failure Grace**:
   - If either check fails, the provider instance is cleared (`provider = undefined`).
   - The certification engine still executes structural checks to produce a formal certification record.
   - The result is enriched with specific pre-flight details (`preflightDiagnostic` in `metadata`), and the certification summary is updated with the detailed diagnostic error (e.g., `"Certification incomplete. Pre-flight diagnostic: Provider is reachable but inference failed: API key invalid."`).

This early-failure mechanism prevents wasted server-side resources and provides immediate, actionable feedback to users.

## 2026-05-18 Certification, Routing, and Response Hardening

Incident report: `planning/done/101-ai-routing-stale-cert-and-fake-tool-fix.md`.

Three production-grade problems were observed in the AI Assistant chat flow and addressed together because they share the same blast radius (the tenant sees fabricated ERP data instead of a clear error):

1. **Profile-id double-decode** in `AiAssistantController.decodeProfileId`. Profile ids are pre-encoded by `AiModelProfile.makeRuntimeId` (each component is `encodeURIComponent`'d before joining with `:`). The frontend then re-encodes once before sending. Express decodes once. The controller used to decode AGAIN, turning `%2F` back into `/`, which Firestore interprets as a sub-collection path and rejects with *"Value for argument 'documentPath' must point to a document"*. The fix is to return `req.params.profileId` untouched; the helper is kept (with a long comment) so future engineers do not re-introduce the decode.

2. **Routing-guard hash check punished CREDITS-mode tenants** for edits made by the platform team. The guard required `config.selectedProfileHash === profile.profileHash` for every request, including for GLOBAL profiles served to CREDITS-mode tenants. Any superadmin edit (display name, temperature, baseUrl, anything that changes the hash) silently invalidated every CREDITS tenant's stored hash, so the per-tool `validateSensitiveWorkflow` call in `AiToolCallingOrchestrator.buildAllowedToolContracts` rejected with `STALE_PROFILE_HASH`, the orchestrator dropped every tool contract, and the model was left with no tools — but a chatty prompt that still mentioned tools. Small models (qwen, gemma, gpt-oss) then emitted `<tool_code>`/`<tool_output>` blocks with fabricated values.

3. **No defense against models that cosplay tool calls.** Even with the prompt asking for honesty, small models will fake tool blocks. There was no scrub on the response and no explicit "no tools available" instruction in the prompt.

### Routing guard changes — `AiModelRoutingGuard`

- For `runtimeMode === 'CREDITS' && profile.scope === 'GLOBAL'` (called "platform-managed" in code), the hash check is skipped. Certifications are looked up against the profile's CURRENT hash. If the platform team has not re-certified after editing the profile, the rejection is `PLATFORM_PROFILE_NEEDS_RECERT`, signaling that the failure is the platform's problem and not the tenant's. The `allowUnverifiedModels` opt-out is also no longer honored on this path — a tenant cannot disable the platform's safety bar on a profile they do not own.
- For BYOK and TENANT-scoped profiles, the hash check is retained. The tenant owns these profiles and the hash is their tamper seal.
- All rejection branches now return a specific, human-readable `reason` per code, via the `REASON_BY_CODE` map. Generic "not certified for this ERP module/workflow" is only used as a fallback. The chat use cases pass `toolRoutingDecision.reason` straight into `runtimeWarnings`, so the user sees the actual cause (stale, missing, blocked, etc.).
- A new private helper `hasAnyCertificationForProfileCategory` distinguishes `CERTIFICATION_NOT_FOUND` (never tested) from `CERTIFICATION_STALE` (tested at an older hash / tool-contract version).

### System prompt change — `AiContextBuilder.buildSystemPrompt`

`BuildSystemPromptParams` now accepts `noToolsAvailable: boolean`. When `true`, the prompt appends a 🚫 block that explicitly forbids `<tool_code>`, `<tool_output>`, `<tool_result>`, `<tool_call>`, `<function_call>`, `<function_response>`, and pseudo-`print(<ns>.<method>(...))` lines. Both chat use cases (`SendChatMessageUseCase`, `StreamChatMessageUseCase`) pass `allowedContracts.length === 0` for this flag, so the prompt automatically hardens itself whenever the runtime stripped tools.

### Response sanitizer — `AiResponseSanitizer`

A new pure module strips hallucinated tool-call blocks from assistant content. It runs inside `AiResponsePersister.saveMessages` after every chat turn (streaming and non-streaming). When it modifies content:
- The blocks are replaced with a visible "[⚠️ The model attempted to fake a tool call here…]" banner so the user can see what happened.
- A user-facing warning is pushed into `runtimeWarnings` ("The selected model tried to fabricate a tool call in this reply…").
- The assistant message's `metadata.responseSanitized.matchedPatterns` records which patterns matched, for telemetry / model-quality dashboards.

The sanitizer never throws and is a no-op when no patterns match — clean responses round-trip byte-for-byte.

### Frontend — `CertificationManagerModal`

The cert manager modal compares each cert's `profileHash` to the live `profile.profileHash` and now:
- Renders a `STALE` chip next to the status badge when the hashes diverge.
- Tints the row amber.
- Shows a banner above the table when at least one cert is stale.
- Adds a `stale` readiness state with its own hero card, so the top of the modal explains the situation rather than displaying a green "ready" hero over a stale table.

`isCertStale` and the new copy live in the modal; the same logic should be lifted to a shared helper if the tenant-side BYOK cert view (`ByokCertificationSection.tsx`) is also updated to surface staleness.

### Tests added

- `AiModelRoutingGuard.test.ts` — three new CREDITS-mode tests (allow with stale hash + live cert; reject as `PLATFORM_PROFILE_NEEDS_RECERT` when re-cert is missing; never honour `allowUnverifiedModels` for GLOBAL profile in CREDITS); one new test that exercises BYOK hash enforcement remains; one regression test verifying every rejection carries a human-readable reason. An existing test was updated from `CERTIFICATION_NOT_FOUND` to `CERTIFICATION_STALE` to match the new behavior.
- `AiResponseSanitizer.test.ts` — covers tool_code/tool_output/tool_result/orphan-tag/fake-print stripping, no-op for clean text, null/empty guards, and banner-collapsing.

### Files touched

Backend:
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts` — `decodeProfileId` is now a documented no-op.
- `backend/src/application/ai-assistant/services/AiModelRoutingGuard.ts` — full rewrite of `validateSensitiveWorkflow`, new `REASON_BY_CODE` map, new `hasAnyCertificationForProfileCategory` helper.
- `backend/src/application/ai-assistant/services/AiContextBuilder.ts` — added `noToolsAvailable` flag and 🚫 block.
- `backend/src/application/ai-assistant/services/AiResponseSanitizer.ts` (new).
- `backend/src/application/ai-assistant/services/AiResponsePersister.ts` — invokes the sanitizer and stores match metadata.
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts` — passes `noToolsAvailable`.
- `backend/src/application/ai-assistant/use-cases/StreamChatMessageUseCase.ts` — passes `noToolsAvailable`.
- `backend/src/tests/application/ai-assistant/AiModelRoutingGuard.test.ts` — updated + extended.
- `backend/src/tests/application/ai-assistant/AiResponseSanitizer.test.ts` (new).

Frontend:
- `frontend/src/modules/super-admin/components/CertificationManagerModal.tsx` — stale detection, badges, banner, hero.
- `frontend/src/locales/{en,ar,tr}/common.json` — six new i18n keys under `superAdmin.aiModels.certifications.*`.

### Future-update checklist for engineers touching this surface

When adding a new field to `AiModelProfileProps` that ends up in `generateProfileHash`:
- A change in that field changes `profileHash`.
- All existing certs become stale.
- For CREDITS users this is invisible at chat time and the new routing guard will now correctly surface `PLATFORM_PROFILE_NEEDS_RECERT` — but **superadmin must re-run certifications** before tools work again.

When bumping `AI_TOOL_CONTRACT_VERSION` or `AI_DATA_FILTER_POLICY_VERSION`:
- Every cert at the old version stops matching `findValidForRouting`.
- The rejection is `CERTIFICATION_STALE` (BYOK) or `PLATFORM_PROFILE_NEEDS_RECERT` (CREDITS + GLOBAL).
- Plan a re-cert sweep across all production profiles immediately after the bump.

When adding a new way for the model to "cosplay" tools (e.g. a new provider emits `<tool_request>`):
- Add the pattern to `FAKE_BLOCK_PATTERNS` in `AiResponseSanitizer.ts`.
- Add a test in `AiResponseSanitizer.test.ts`.
- Order matters: paired-tag patterns must come before the orphan-tag pattern.

When the routing guard is changed to add a new rejection code:
- Add the code to `REASON_BY_CODE` with a sentence the end user can act on (e.g. "Open AI Settings and …", "Ask your platform admin to …").
- Do not reuse the generic `ROUTING_ERROR` fallback for new codes — the whole point of this hardening is to never leave the user staring at a generic message again.
