# 🎯 Current Focus

**Task:** AI Model Management — Certification Workflows and APIs
**Started:** 2026-05-08
**Status:** ✅ INCREMENT 2 COMPLETE — certification backend/API foundation implemented
**Agent/IDE:** Codex (CTO Mode)
**Branch:** `feat/ai-proposal-sandbox`

---

## 2026-05-09 Result — AI Model Management Certification Workflows/APIs

**Status:** ✅ COMPLETE  
**Estimate:** 5-7h  
**Actual time:** ~2h 20m

Implemented backend/API foundation for certification workflows.

Changed:
- Added Super Admin Provider Registry APIs.
- Added `AiProviderRegistryUseCase`.
- Added `AiCertificationEngine` shell.
- Added `AiModelCertificationUseCase`.
- Added Super Admin GLOBAL model profile certification endpoints.
- Added Company Admin TENANT custom model profile, diagnostics, certification, and certified profile query endpoints.
- Added valid certified profile query for future Recommended Certified Models UI.
- Added development seed helper `backend/src/scripts/seedAiCertifiedProfileDev.ts`.

Key behavior:
- Provider registry stores metadata only; no API keys.
- Manual certification requires current `profileHash`, category, score/maxScore, status, test suite version, tool contract version, data filter policy version, and summary.
- Certification is rejected if the submitted profileHash is stale.
- Shell certification performs deterministic structural checks only and does not fake deep ERP/accounting correctness.
- TENANT certification applies only to the matching company.
- Tenant certifications are excluded from GLOBAL certified/recommended queries.
- Existing tenant free-text settings remain `legacy_unverified`.
- Diagnostics remain non-authoritative.
- Direct business execution remains disabled.

Verification:
- `backend`: `npm run typecheck` ✅
- `backend`: provider/certification/routing/auth tests ✅ — 5 suites, 32 tests
- `backend`: chat/diagnostics/tool regression slice ✅ — 3 suites, 38 tests
- `backend`: `npm run build` ✅

Completion report:
- `1-TODO/done/78-ai-model-management-certification-workflows-apis.md`

Next recommended move:
- Increment 3: build the frontend Recommended Certified Models modal, tenant custom model UX, and Super Admin provider/certification UI. Estimate: 5-7h.

---

## 2026-05-09 Result — AI Model Management Backend Trust Foundation

**Status:** ✅ COMPLETE  
**Estimate:** 6-8h for original increment; delivered minimum backend foundation in ~2h  
**Actual time:** ~2h

Implemented the minimum backend foundation to close the unsafe model-name trust gap for AI tool routing.

Changed:
- Added `AiProvider` entity/repository.
- Added fixed certification category registry.
- Added `AiModelCertificationResult` entity/repository.
- Extended `AiModelProfile` into an exact runtime profile with `scope`, `tenantId`, `providerId`, `modelId`, endpoint fingerprint, runtime settings, `profileHash`, `revision`, `enabled`, and expanded statuses.
- Added deterministic profileHash generation from runtime-relevant fields.
- Extended tenant AI settings with `mode`, `providerId`, `selectedModelProfileId`, and `selectedProfileHash`.
- Existing/free-text settings now hydrate as `legacy_unverified`.
- Added `AiModelRoutingGuard`.
- Wired routing guard into chat tool contract exposure and direct AI tool endpoint checks.
- Added certification gate checks inside `AiRuntimeGuard`.
- Kept `AiModelCapabilityCatalog` as display/diagnostics hinting only; it is not used as certification authority.

Safety outcome:
- `custom_uncertified` and `legacy_unverified` settings cannot expose or execute sensitive ERP tools.
- Diagnostics passed does not create certification.
- Stale `profileHash` is rejected.
- Same `modelId` with different provider/endpoint is not trusted.
- Tenant certification cannot be reused by another tenant.
- Proposal Sandbox remains non-executing; direct write/post operations remain blocked.

Verification:
- `backend`: `npm run typecheck` ✅
- `backend`: targeted trust tests ✅ — 4 suites, 53 tests
- `backend`: chat/diagnostics/tool regression slice ✅ — 3 suites, 38 tests
- `backend`: `npm run build` ✅

Completion report:
- `1-TODO/done/77-ai-model-management-backend-trust-foundation.md`

Next recommended move:
- Increment 2: add certification execution/API workflows, provider registry APIs, tenant custom certification API, and migration tooling. Estimate: 5-7h.

---

## 2026-05-09 Operational Detour — Tailscale Local Dev Access

**Status:** ✅ COMPLETE  
**Estimate:** 30-45m  
**Actual time:** ~35m

Configured local development access over Tailscale IP `100.72.126.75`.

Changed:
- `firebase.json`
- `package.json`
- `frontend/package.json`
- `frontend/.env.development.local`
- `frontend/src/config/firebase.ts`
- `JOURNAL.md`
- `1-TODO/done/76-tailscale-dev-environment.md`

Verification:
- `firebase.json` JSON parse ✅
- `frontend`: `npm run build` ✅
- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run typecheck` ✅

Non-blocking issue logged:
- `backend/functions`: `npm run build` fails due to unrelated package/version TypeScript issues. Root `firebase.json` uses `backend/` as the Functions source, so this does not block the active emulator setup.

Next:
- Start the emulators with `npm run emulators:remote`.
- Start the frontend with `npm run dev:remote` in `frontend/`.
- Test from another Tailscale device at `http://100.72.126.75:5173`.
- If unreachable, allow Windows Firewall inbound access for ports `5173`, `4000`, `5001`, `9099`, `8080`, `9001`, and `9199`.

---

## Current Focus

Turn Super Admin chat keywords into AI planning hints instead of deterministic auto-execution, then make tool use work through AI-led planning:

1. **Keyword hints, not automatic execution** — matched keywords suggest tools to the model, but do not run tools by themselves.
2. **Schema-aware tool context** — the model receives allowed tool names, descriptions, keywords, input schemas, output schemas, and examples.
3. **Native structured tool calls** — known tool-capable models can request provider tool calls; Runtime Guard validates before execution.
4. **Text-plan fallback for other models** — text-only/unknown models can return a guarded `ERP_TOOL_PLAN` JSON block; backend parses, validates, and executes like normal tool calls.
5. **Multi-step planning loop** — after tool results, the model can request another tool or produce the final answer.

**Estimate:** 3-4h implementation + targeted verification.
**Rollback point:** branch `feat/ai-proposal-sandbox`; working tree already had unrelated dirty files before this task, so do not reset the worktree.

---

## ✅ 2026-05-08 Result

Implemented AI-led tool planning:

- Super Admin chat keywords are now advisory hints, not deterministic execution triggers.
- The model receives schema-aware allowed tool cards and keyword hints.
- Known tool-capable models can request native structured tool calls.
- Unknown/text-only models can request guarded read-only tools through `ERP_TOOL_PLAN` JSON.
- Runtime Guard validates native and text-plan calls before execution.
- Multi-step tool chaining is supported across planning rounds.

### Verification

- `backend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` ✅ — 12 suites, 331 tests
- `backend`: `npm run build` ✅
- `graphify update .` attempted ❌ — command unavailable on PATH

### Follow-up Fix: Provider-Prefixed Model Names

Fixed model capability lookup so provider-prefixed model IDs such as `openai/gpt-4o-mini` resolve to the known `gpt-4o-mini` profile instead of being treated as unknown/text-only.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiRuntimeGuard.test.ts` ✅ — 13 tests
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅

### Follow-up: Free Model Test Profiles

Registered these OpenAI-compatible free models as known experimental profiles:

- `google/gemma-4-31b-it:free`
- `openai/gpt-oss-20b:free`
- `z-ai/glm-4.5-air:free`
- `tencent/hy3-preview:free` — marked for finance/accounting/reporting test use

Native provider tool calling remains off for these models until verified. They use guarded `ERP_TOOL_PLAN` text-plan mode for read-only ERP tools.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiRuntimeGuard.test.ts` ✅ — 15 tests
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅

### Follow-up: AI Settings Model Diagnostics

Added a diagnostics panel to **AI Assistant → Settings → Provider** so admins can test the saved provider/model before relying on it in chat.

The diagnostics now show:

- provider connection status,
- basic model response status,
- native OpenAI-style `tool_calls` support,
- guarded `ERP_TOOL_PLAN` fallback support,
- catalog model profile and recommended mode.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅ — 3 tests
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant` ✅ — 13 suites, 338 tests
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅
- `graphify update .` attempted ❌ — command unavailable on PATH

### Follow-up: Conversation Context First Rules

Manual chat evaluation showed the assistant treated follow-up messages too independently. Example: after Trial Balance data exposed `cash syp1`, a later Arabic follow-up asking what happened to that account did not reuse the prior fetched data/context strongly enough.

Fix:
- Updated the base orchestration skill so every user message is treated as part of one ongoing conversation.
- Added broad rules: understand intent first, clarify ambiguous intent before answering/tooling, answer from existing context when sufficient, use minimum additional read-only tools when more ERP data is needed, and ask for extra info only when it is truly missing/contradictory/ambiguous.
- Added a compact `[RECENT ERP DATA FROM THIS CONVERSATION]` block built from recent assistant message `metadata.toolResults`.
- Updated tool planning rules to use current message, chat history, previous tool results, and schemas together.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts src/tests/application/ai-assistant/AiToolCalling.test.ts` ✅ — 2 suites, 32 tests
- `backend`: `npm run typecheck` ✅

Actual time: ~30m.

### Follow-up: Conversation Context Cost Settings

Added admin-controlled context budgets so customers using their own API key can decide how much conversation history and previous ERP tool-result data is sent to the model.

Fix:
- Added `conversationContextMode`: `minimal`, `balanced`, `deep`.
- Added `includePreviousToolResults`.
- Existing configs default to `balanced` with previous tool-result reuse enabled.
- `SendChatMessageUseCase` now limits fetched history, provider history, long message text, previous tool-result count, and previous tool-result total prompt size according to the saved setting.
- The assistant adds a runtime warning when context was trimmed to control AI token cost.
- AI Settings now exposes the controls with EN/AR/TR labels.
- Added completion report `1-TODO/done/74-ai-assistant-context-cost-settings.md`.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/domain/ai-assistant/AiProviderConfig.test.ts src/tests/application/ai-assistant/AiSettingsUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅ — 3 suites, 52 tests
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅
- `frontend`: `npm run build` ✅
- `backend`: `npm run build` ✅

Actual time: ~45m.

### Follow-up: Editable AI Model Profiles

Fixed the diagnostics/chat mismatch for new models.

Root cause:
- Model diagnostics used live provider probes and could prove that a model responds and supports native tool calls.
- Chat runtime still used model capability/trust metadata separately.
- New models without a persisted profile could therefore pass diagnostics but still appear as untested/text-only in chat.

Fix:
- Added editable Super Admin AI model profiles backed by Firestore.
- Added DB-first model profile resolution for chat and diagnostics.
- Added Super Admin UI at `/super-admin/ai-models` to add, update, delete, sync, tag, and status model profiles.
- Diagnostics now stores the last diagnostic result on the model profile.
- Passing diagnostics does not automatically promote trust status; Super Admin explicitly controls whether a model is tested, experimental, custom, blocked, deprecated, or text-only.
- Chat badges now distinguish tested/experimental/custom/untested instead of showing tested models as untested.
- Detour fix: encoded internal Firestore document IDs so model names with `/` or `:` can be saved safely while still displaying the original model name in the UI.
- Added Super Admin model-profile diagnostics so platform admins can test a selected model profile using a selected company's saved AI provider settings without exposing API keys.
- Added completion report `1-TODO/done/75-ai-model-profile-management.md`.
- Updated architecture and user-guide docs.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅ — 2 suites, 22 tests
- `backend`: `npm run test -- --runInBand src/tests/domain/ai-assistant/AiModelProfile.test.ts src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅ — 2 suites, 5 tests
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts src/tests/domain/ai-assistant/AiModelProfile.test.ts` ✅ — 2 suites, 6 tests
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run build` ✅
- `frontend`: `npm run build` ✅

Actual time: ~1h 20m.

### Detour: AI Chat 30s Timeout

Manual chat testing with slower/free models hit `timeout of 30000ms exceeded`.

Fix:
- Kept the normal frontend API timeout at 30 seconds for ERP screens.
- Set AI chat requests to 120 seconds.
- Set AI diagnostics requests to 180 seconds.
- Set backend OpenAI-compatible provider chat timeout to 120 seconds.

Verification:
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/OpenAICompatibleProvider.test.ts src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` ✅ — 33 tests
- `backend`: `npm run typecheck` ✅
- `frontend`: `npm run typecheck` ✅

### Detour: Frontend Ngrok Host Allowlist

Manual browser QA through ngrok was blocked by Vite's allowed-hosts guard for `caucus-garbage-unusable.ngrok-free.dev`.

Fix:
- Added the ngrok hostname to `frontend/vite.config.ts` under `server.allowedHosts`.

Verification:
- `frontend`: `npm run typecheck` ✅

Next:
- Restart the frontend Vite dev server, then reload the ngrok URL.

### Files Changed By This Task

- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/AiSettingsUseCase.ts`
- `backend/src/domain/ai-assistant/entities/AiProviderConfig.ts`
- `backend/src/api/validators/ai-assistant.validators.ts`
- `backend/src/tests/application/ai-assistant/AiRuntimeGuard.test.ts`
- `backend/src/tests/application/ai-assistant/AiToolCalling.test.ts`
- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`
- `backend/src/tests/domain/ai-assistant/AiProviderConfig.test.ts`
- `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.ts`
- `backend/src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts`
- `backend/src/domain/ai-assistant/entities/AiModelProfile.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelProfileRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/index.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelProfileRepository.ts`
- `backend/src/application/ai-assistant/use-cases/AiModelProfileUseCase.ts`
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`
- `backend/src/api/routes/ai-tool-catalog.routes.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/modules/super-admin/pages/AiModelProfilesPage.tsx`
- `frontend/src/layout/SuperAdminShell.tsx`
- `frontend/src/router/routes.config.ts`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`
- `docs/architecture/ai-assistant-runtime-v2.md`
- `docs/user-guide/ai-assistant-runtime-v2.md`
- `1-TODO/done/71-ai-assistant-ai-led-tool-planning.md`
- `1-TODO/done/72-ai-settings-model-diagnostics.md`
- `1-TODO/done/73-ai-assistant-conversation-context.md`
- `1-TODO/done/74-ai-assistant-context-cost-settings.md`
- `1-TODO/done/75-ai-model-profile-management.md`
- `JOURNAL.md`
- `ACTIVE.md`

### Recommended Next Move

Manual browser QA in AI Assistant and Settings:

1. In AI Settings, run Model diagnostics for `tencent/hy3-preview:free`, `openai/gpt-oss-20b:free`, and one known native model such as `gpt-4o-mini`.
2. In Super Admin -> AI Models, sync defaults, then create or edit the tested model profile and confirm status/tags/tool-mode settings save and reload.
3. In AI Settings, save each Conversation Context mode once (`Minimal`, `Balanced`, `Deep`) and confirm settings reload correctly. Then leave it on `Balanced` with previous tool results enabled for normal QA.
4. In chat, test `openai/gpt-oss-120b:free` or the selected free model with prompts like “show account statement for account code 1010101”.
5. In `gpt-4o-mini`, retest a continuous Trial Balance conversation:
   - ask for Trial Balance,
   - ask Arabic follow-ups,
   - ask about an account from the prior tool result such as `cash syp1`,
   - confirm it reuses prior fetched data and calls another read-only tool only when movement details are needed.
6. Confirm tool cards/results display clearly and no hallucinated figures appear.

Estimate: 30-45m.

---

## ✅ What Was Completed

### 1. Implemented Flag on AI Tool Catalog
- Added `implemented: boolean` field to `AiToolDefinition` entity (default `false`)
- Marked 17 real tools as `implemented: true` in `AiToolCatalogSeed`
- Super Admin catalog page: new Implementation column (green "Implemented" / gray "Planned" badge), filter dropdown, stats bar
- Super Admin detail page: Implementation badge in Properties panel
- Full i18n (EN/AR/TR) for implemented/planned labels
- `implemented` is immutable from DB — always comes from seed (like mode/riskLevel)

### 2. Tool Detail Page Enhancement
- Added "About This Tool" panel with description, whenToUse, example prompts, safety notes
- Added "Read-only" badges on Properties, Input Schema, Output Schema panels
- All data sourced from `toJSON()` computed fields (whenToUse, safetyNotes, examples)
- Fixed `accounting.getAccountingPeriodStatus` seed: replaced `noInput/noOutput` with proper schemas
- Frontend `AiTool` type extended with v2 fields

### 3. Critical: Anti-Hallucination Safety Fix
- **Problem:** Unimplemented tool keywords matched queries like "unpaid invoices" but produced no data → AI hallucinated realistic financial figures ($29,040 fake AR aging)
- Removed 11 unimplemented intent entries from `tool-intents.config.ts` (inventory 5, sales 2, purchases 1, reports 3)
- Kept only 17 entries for tools with real implementations
- Added NO_DATA_AVAILABLE context injection when no tool data is retrieved
- Added rules 7-10 to system prompt: "NEVER fabricate financial figures"
- Strengthened base skill safety rules
- Added test: intent entries must only reference implemented tools

### 4. Firestore Undefined Fix
- `FirestoreAiToolCatalogRepository.save()` now strips `undefined` values before Firestore write
- Prevents `unavailabilityReason: undefined` error on `POST /platform/ai-tools/sync`

---

## 📋 Remaining Work / Future

| Item | Description | Priority |
|------|-------------|----------|
| Full regression run | Run complete backend/frontend test/build suite before merge | High before merge |
| Option B Phase 4 | Admin UI for editing keywords per tool (no code deploy needed) | ✅ DONE |
| Commit | Commit after developer approval | ✅ DONE |

AI Assistant v2 is now implemented as a guarded, provider-agnostic runtime that extends the existing AI Assistant, Tool System v1, and AI Proposal Sandbox.

### Backend Runtime ✅
- Added provider-agnostic AI tool contract/domain types.
- Extended provider interfaces to support structured tool calls and model capability metadata.
- Added Runtime Guard validation before any model-requested tool can execute.
- Added model capability catalog for known/custom/text-only models.
- Added AI audit service wrapper for non-blocking runtime audit events.
- Extended existing `AiToolCallingOrchestrator` rather than introducing a second orchestrator.
- Preserved deterministic fallback for providers/models without structured tool support.
- Kept write/proposal/draft requests out of direct execution; they clarify or create sandbox proposals only.

### Skill Templates ✅
- Added always-applied Base Skill instructions.
- Added safe domain skill templates.
- Skills are prompt/playbook guidance only; they do not execute tools or bypass permissions.

### Frontend Runtime UI ✅
- Chat now displays runtime model/provider status, warnings, text-only mode, clarification cards, tool-use status, and proposal-created state.
- Proposal list/detail pages now use the correct `aiAssistant` i18n namespace.
- Chat proposal cards translate proposal status and risk labels.
- Super Admin AI Proposal Policy page now has full EN/AR/TR i18n coverage.
- Sidebar `aiProposals` labels exist in all three common locale files.

### Review Fixes ✅
- Fixed reviewer i18n blockers in tenant proposal pages.
- Fixed reviewer i18n gaps in chat proposal cards and Super Admin proposal policy UI.
- Added missing chat quick-action and empty-message locale keys.
- Removed dead quick-action helper code without changing quick-action UX.
- i18n tooltip strings for delete/history controls are now translated.

---

## 🔐 Safety Guarantees

1. **Model output is untrusted.** Structured tool calls are requests only; backend guard decides.
2. **No direct AI writes.** Runtime Guard blocks write/proposal/draft tool execution.
3. **Tenant isolation enforced.** Model-supplied `companyId`/`userId` is rejected; tenant context is server-owned.
4. **RBAC enforced.** Tool execution still requires registered permissions.
5. **Provider-agnostic.** OpenAI-style tool contracts are generated from ERP-owned tool definitions.
6. **Fallback-safe.** Unknown/custom/text-only models use deterministic/text-only behavior with warnings.
7. **Proposal Sandbox remains non-executing.** Accepting a proposal does not create ERP records, post vouchers, or execute business actions.

---

## ✅ Verification

Commands run on 2026-05-07:

- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiRuntimeGuard.test.ts src/tests/application/ai-assistant/OpenAICompatibleProvider.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts src/tests/application/ai-assistant/AiProposalSandbox.test.ts` ✅
  - 4 suites passed
  - 103 tests passed
- Manual-test detour fix after trying “Show me the trial balance summary”:
  - Root cause: Firestore rejected `metadata.toolCallResults: undefined` on chat message persistence.
  - Fix: omit empty `toolCallResults`/`proposal` metadata keys in `SendChatMessageUseCase` and strip nested `undefined` values at the Firestore chat repository boundary.
  - `backend`: `npm run typecheck` ✅
  - `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/FirestoreAiChatRepository.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅
    - 2 suites passed
    - 16 tests passed
  - `backend`: `npm run build` ✅ — updates local `backend/lib` runtime output for Firebase emulator manual testing; do not commit generated `backend/lib` artifacts.

Reviewer status:
- `erp-reviewer` final meaningful review: ✅ PASS
- Last reviewer retry returned empty due to subagent/tool hiccup; direct verification passed afterward.

---

## 📚 Documentation Created / Updated

- `JOURNAL.md`
- `ACTIVE.md`
- `1-TODO/done/70-ai-assistant-runtime-v2.md`
- `docs/architecture/ai-assistant-runtime-v2.md`
- `docs/user-guide/ai-assistant-runtime-v2.md`

---

## 👉 Recommended Next Move

Run a full project regression before merge (`backend` + `frontend` full suites), then push branch and open PR.
