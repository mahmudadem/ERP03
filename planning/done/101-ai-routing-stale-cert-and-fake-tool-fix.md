# Task 101 — AI Routing, Stale Cert UX, and Fake Tool-Call Defense

**Status:** ✅ COMPLETE
**Branch:** `chore/enterprise-restructure`
**Started:** 2026-05-18
**Estimate:** 2-3 hours
**Actual:** ~2.5 hours
**Owner:** Claude Code (CTO mode)

---

## Trigger / Why this was urgent

During QA the product owner caught the AI assistant printing fully-fabricated accounting data while flying a "WARNING — profile not certified for this ERP module/workflow" runtime banner. The fabricated table was indistinguishable from real ERP output and would have made it past a quick visual review.

The model was qwen/qwen3.6-flash routed via openrouter, used in CREDITS mode. The Certification Manager showed 11/12 categories CERTIFIED ✅. Despite that, tools were stripped at runtime, the model improvised tool blocks (`<tool_code>`, `<tool_output>`, `<tool_result>`) in plain text, and the user only realized it was fake by reading the numbers.

The product owner asked for a full audit and fix. The audit they were given by a third party flagged 6 bugs; on close reading only 1 was correct (the URL double-decode). The actual blast radius came from a more subtle interaction between the routing guard, the certification lookup, and small-model misbehavior.

## What was wrong, in plain text

1. **Profile-id double-decode.** `AiAssistantController.decodeProfileId` called `decodeURIComponent` on a route param Express had already decoded once, turning the stored `%2F` separators in profile ids back into `/`, which Firestore then rejected as an invalid document path. All `/custom-model-profiles/:profileId` endpoints were broken for any id containing `%2F` (i.e. most OpenRouter-style ids like `qwen%2Fqwen3.6-flash`).

2. **Hash-based routing punished CREDITS tenants.** `AiModelRoutingGuard.validateSensitiveWorkflow` enforced `config.selectedProfileHash === profile.profileHash` on every request. For GLOBAL profiles served to CREDITS-mode tenants, any superadmin edit to the profile (display name, temperature, baseUrl) silently invalidated every tenant's stored hash. The per-tool routing call in `AiToolCallingOrchestrator.buildAllowedToolContracts` then rejected, the orchestrator dropped every contract, and the model was sent into chat with zero tools — but a prompt that still mentioned tools.

3. **The Cert Manager lied.** It listed certifications by `modelProfileId` only, so old certs (tied to an old `profileHash`) still appeared green CERTIFIED. The runtime, looking up via `findValidForRouting` (which filters on `profileHash`, `toolContractVersion`, `dataFilterPolicyVersion` simultaneously), found nothing. The mismatch was invisible to the user.

4. **Runtime rejection messages were generic.** Every code (`STALE_PROFILE_HASH`, `CERTIFICATION_NOT_FOUND`, `MODEL_PROFILE_BLOCKED`, …) returned the same `"This model profile is not certified for this ERP module/workflow."` string. The user could not see what to do.

5. **No defense against tool-call cosplay.** Small / uncertified models will, despite the system prompt's "NEVER FABRICATE DATA" rule, emit `<tool_code>`/`<tool_output>`/`<tool_result>` blocks with invented JSON. There was no sanitizer to strip them and no explicit "no tools available — do not pretend to call any" instruction.

## What was changed

### Backend

| File | Change |
|------|--------|
| `backend/src/api/controllers/ai-assistant/AiAssistantController.ts` | `decodeProfileId` is now a documented no-op. Kept the helper so all 10+ call sites continue to compile; rewrote the comment so future engineers do not re-add the second decode. |
| `backend/src/application/ai-assistant/services/AiModelRoutingGuard.ts` | Full rewrite of `validateSensitiveWorkflow`. CREDITS + GLOBAL profiles bypass the hash check and look up certs against the live profile hash. Added `REASON_BY_CODE` map so every rejection code has its own actionable sentence. Added `hasAnyCertificationForProfileCategory` to distinguish never-tested from tested-but-stale. New rejection codes: `PLATFORM_PROFILE_NEEDS_RECERT` (CREDITS path), `CERTIFICATION_STALE` (BYOK or TENANT path). `allowUnverifiedModels` is now ignored for platform-managed profiles. |
| `backend/src/application/ai-assistant/services/AiContextBuilder.ts` | New `noToolsAvailable` flag on `BuildSystemPromptParams`. When `true`, appends a 🚫 block to the system prompt that explicitly forbids `<tool_code>`, `<tool_output>`, `<tool_result>`, `<tool_call>`, `<function_call>`, `<function_response>`, and pseudo-`print(<ns>.<method>(...))` lines. |
| `backend/src/application/ai-assistant/services/AiResponseSanitizer.ts` | New module. Detects and strips hallucinated tool-call blocks; replaces them with a visible "[⚠️ The model attempted to fake a tool call here]" banner; returns a user-facing warning and the matched patterns. Pure / stateless. |
| `backend/src/application/ai-assistant/services/AiResponsePersister.ts` | Calls the sanitizer on every assistant message before save. If modified, pushes the warning into `runtimeWarnings` and records `metadata.responseSanitized.matchedPatterns` for telemetry. |
| `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts` | Passes `noToolsAvailable: allowedContracts.length === 0` to the prompt builder. |
| `backend/src/application/ai-assistant/use-cases/StreamChatMessageUseCase.ts` | Same. |
| `backend/src/tests/application/ai-assistant/AiModelRoutingGuard.test.ts` | Updated existing "different endpoint/profile hash" test from `CERTIFICATION_NOT_FOUND` to `CERTIFICATION_STALE`. Added: CREDITS-mode allows stale tenant hash when live cert exists; CREDITS-mode rejects as `PLATFORM_PROFILE_NEEDS_RECERT` when re-cert missing; CREDITS-mode never honours `allowUnverifiedModels`; BYOK still enforces hash; every rejection carries a non-generic reason. |
| `backend/src/tests/application/ai-assistant/AiResponseSanitizer.test.ts` | New. Covers clean-text passthrough, multi-line block stripping for each tag type, orphan tags, null / empty guard, banner collapsing. |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/modules/super-admin/components/CertificationManagerModal.tsx` | New `isCertStale` predicate compares `cert.profileHash` against `profile.profileHash`. Stale certs render an amber STALE chip next to the status, tint the row amber, and surface a banner above the table. New `stale` readiness state with its own hero card. `highestStatus` and `readiness` demote stale rows so a fully-stale profile never reports "ready". |
| `frontend/src/locales/en/common.json` | Six new keys: `stale`, `staleTooltip`, `staleBannerTitle`, `staleBannerBody`, `staleHeroTitle`, `staleHeroBody`. |
| `frontend/src/locales/ar/common.json` | Same six keys in Arabic. |
| `frontend/src/locales/tr/common.json` | Same six keys in Turkish. |

### Docs

| File | Change |
|------|--------|
| `docs/architecture/ai-assistant-runtime-v2.md` | Appended a "2026-05-18 Certification, Routing, and Response Hardening" section. Documents the three problems, the routing-guard rewrite, the prompt change, the sanitizer, the frontend change, the new tests, and a future-update checklist for engineers touching profile hashing, contract version bumps, new fake-tool patterns, and new rejection codes. |
| `docs/user-guide/ai-certification-stale-and-tool-faking.md` | New user-facing guide. Two stories: stale certifications (what you used to see vs what you'll see now, CREDITS vs BYOK responsibility split) and fake tool calls (what they looked like, the two defenses that now run, what each warning means, what to do). |
| `planning/done/101-ai-routing-stale-cert-and-fake-tool-fix.md` | This file. |
| `planning/JOURNAL.md` | Appended session entry. |
| `planning/ACTIVE.md` | Marked Task 101 ✅ and added recommendation for next step. |

## Acceptance criteria

- [x] CREDITS-mode tenant whose stored `selectedProfileHash` no longer matches the live GLOBAL profile **can still chat with tools**, provided the platform team has re-run certification against the live hash. Verified by `AiModelRoutingGuard.test.ts`.
- [x] CREDITS-mode tenant whose model has not been re-certified after a platform edit gets a **specific, actionable error** (`PLATFORM_PROFILE_NEEDS_RECERT`) — not a generic banner. Verified by `AiModelRoutingGuard.test.ts`.
- [x] BYOK / TENANT-scoped profiles **still enforce** the hash check (tenant owns the profile, hash is their tamper seal). Verified by `AiModelRoutingGuard.test.ts`.
- [x] When tools are stripped, the system prompt **explicitly forbids** tool-call cosplay (six tag families + pseudo-print lines). Verified by manual prompt inspection (`AiContextBuilder.buildSystemPrompt`).
- [x] Any `<tool_code>`/`<tool_output>`/`<tool_result>` blocks the model emits anyway are **stripped before save** and a warning is shown to the user. Verified by `AiResponseSanitizer.test.ts`.
- [x] Cert Manager **shows STALE chips** for certs whose `profileHash` does not match the live profile, plus a banner and a hero card. Verified by code inspection + i18n strings present in en / ar / tr.
- [x] Profile-id GET/PATCH/DELETE/diagnostics/certifications endpoints work for ids containing `%2F`. Verified by code inspection — `decodeProfileId` returns `req.params.profileId` unchanged so Express's single decode lands the id in the correct form.
- [x] `backend npm run typecheck` ✅, `frontend npm run typecheck` ✅.
- [x] Touched-area test suites pass: `AiModelRoutingGuard.test.ts`, `AiResponseSanitizer.test.ts`, `AiRuntimeGuard.test.ts` — 36/36 pass.

## Known follow-ups (NOT done in this task)

1. **Auto-invalidate certs on profile edit.** Currently the platform team must remember to re-run certification after editing a global profile. We could call `expireByProfileAndCategory` from `AiModelProfileUseCase.updateGlobalProfile` to make this automatic, but that would force the platform team to re-cert all 12 categories after a tiny edit (e.g. display name change), which has its own cost. Discuss with product before doing this.
2. **Tenant-side BYOK staleness.** `ByokCertificationSection.tsx` shows the registered cert status without comparing hashes. Lift `isCertStale` to a shared utility and use it there too.
3. **Streaming-time fake-tool detection.** The sanitizer runs at persist time. The user briefly sees the raw streamed tokens before the saved version overwrites them. A mid-stream detector could emit a `warning` SSE event the moment `<tool_code>` is seen and have the UI redact the live stream. Lower priority — the persisted version is already clean.
4. **Telemetry dashboard.** `metadata.responseSanitized.matchedPatterns` is now stored on every sanitized message. A super-admin dashboard could surface which provider/model combinations are most prone to cosplay, so the platform team can block or downgrade them.

## Audience-specific summary

### Technical (for incoming SWEs at handoff)

The routing-guard tax for being on CREDITS was wrong by design: a tenant who picks a platform-curated model should not be invalidated by platform-side edits. We split the guard into two paths keyed on `(runtimeMode, profile.scope)`. CREDITS + GLOBAL is now "platform-managed" — hash check off, cert lookup against live hash, `allowUnverifiedModels` opt-out disabled. Every other path retains the original BYOK-style hash check. Rejection codes are now specific and each carries a per-code reason string so the chat use cases can surface useful messages without per-case branching.

Independently, small LLMs ignore the "do not fabricate" system rule when their prompt mentions tools but no tools are bound. We hardened the prompt (a 🚫 block fires when `allowedContracts.length === 0`) and added `AiResponseSanitizer`, a stateless module that runs inside `AiResponsePersister.saveMessages` and strips `<tool_*>` / `<function_*>` blocks plus pseudo-`print(ns.method(...))` lines. Matches are recorded in message metadata for telemetry.

The Cert Manager modal now compares `cert.profileHash` to the live profile's hash. Stale rows are visually demoted; `highestStatus` and `readiness` use the live-only filter, so the hero card can no longer say "ready" when nothing valid actually applies.

### End user (for the launch user guide compilation)

You will no longer see the AI "fetch" data that was never fetched. Two things changed:

1. **Stale certifications are now visible** in the Certification Manager — old tests appear with an amber STALE label and a banner explains them. If your model is on the platform's CREDITS plan, the platform team handles re-running. If you use your own key (BYOK), you re-run yourself.

2. **Models that try to fake tool calls are caught.** The fabricated block is removed and replaced with a visible warning; a banner under the message tells you the model misbehaved and suggests switching to a certified model.

The error messages under each AI reply now tell you exactly which problem caused tools to be stripped (stale hash, missing cert, blocked profile, etc.) instead of a single generic line.
