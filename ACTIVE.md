# 🎯 Current Focus

**Task:** AI Assistant Module v2 — Guarded Tool Runtime + Proposal Sandbox Integration  
**Started:** 2026-05-07  
**Status:** ✅ COMPLETE — manual-test Firestore metadata bug fixed; awaiting follow-up commit approval  
**Agent/IDE:** OpenCode (CTO Mode)  
**Branch:** `feat/ai-proposal-sandbox`

---

## ✅ What Was Completed

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

## 📋 Remaining Work / Future

| Item | Description | Priority |
|------|-------------|----------|
| Full regression run | Run complete backend/frontend test/build suite before merge | High before merge |
| Follow-up commit | Commit Firestore metadata serialization fix after developer approval | High |
| Prisma AI repos | Add Prisma implementations for AI Proposal repositories when SQL mode is prioritized | Future |
| Human-approved execution | Future path: accept proposal → execute through proper use cases with approval | Future |
| Typed tool-result UI | Replace remaining local `as any` display casts with stronger frontend tool-result types | Low |
| Date/time locale policy | Use company-configured locale for date/time display if/when global locale policy exists | Low |

---

## 👉 Recommended Next Move

Manual test the chat prompt again, then approve the follow-up git commit. Suggested commit format:

`fix(ai-assistant): sanitize chat metadata before Firestore writes [ACTIVE-70]`
