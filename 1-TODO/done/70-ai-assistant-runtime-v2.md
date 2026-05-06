# 70 — AI Assistant Runtime v2: Guarded Tool Calls + Proposal Sandbox Integration

Date: 2026-05-07

## Technical Developer View

### Scope Completed

Implemented AI Assistant v2 as a safe, provider-agnostic runtime layer on top of the existing AI Assistant, Tool System v1, and AI Proposal Sandbox.

The AI model remains untrusted. It can request structured tool calls, but the backend Runtime Guard decides whether the request is valid, tenant-safe, permission-safe, and executable. Direct write execution is not allowed.

### Backend Highlights

- Added provider-agnostic tool contract/types:
  - `backend/src/domain/ai-assistant/tools/AiToolContract.ts`
- Extended provider interfaces and OpenAI-compatible mapping:
  - `backend/src/application/ai-assistant/providers/IAiProvider.ts`
  - `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts`
  - `backend/src/application/ai-assistant/providers/MockProvider.ts`
- Added runtime safety services:
  - `backend/src/application/ai-assistant/services/AiRuntimeGuard.ts`
  - `backend/src/application/ai-assistant/services/AiAuditService.ts`
  - `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- Extended existing orchestration/use-case flow:
  - `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
  - `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- Added safe skill prompt templates:
  - `backend/src/application/ai-assistant/skills/`
- Registered new services through DI:
  - `backend/src/infrastructure/di/bindRepositories.ts`

### Frontend Highlights

- Extended chat API types for runtime metadata:
  - `frontend/src/api/aiAssistantApi.ts`
- Added chat UI runtime indicators/warnings:
  - `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- Fixed proposal list/detail i18n namespace and enum labels:
  - `frontend/src/modules/ai-assistant/pages/AiProposalListPage.tsx`
  - `frontend/src/modules/ai-assistant/pages/AiProposalDetailPage.tsx`
- Added full Super Admin policy page i18n:
  - `frontend/src/modules/super-admin/pages/AiProposalPolicyPage.tsx`
- Updated locale files:
  - `frontend/src/locales/en/aiAssistant.json`
  - `frontend/src/locales/ar/aiAssistant.json`
  - `frontend/src/locales/tr/aiAssistant.json`
  - `frontend/src/locales/en/common.json`
  - `frontend/src/locales/ar/common.json`
  - `frontend/src/locales/tr/common.json`

### Safety Rules Preserved

1. Model-supplied tenant/user identifiers are rejected.
2. Tool execution requires server-owned tenant context.
3. Tool execution requires the registered ERP permission.
4. Runtime Guard blocks direct write/proposal/draft execution.
5. Unknown/custom/text-only model profiles surface safe warnings.
6. AI Proposal Sandbox remains non-executing.
7. The disabled Execute button remains a placeholder only.

### Verification

- `frontend`: `npm run typecheck` ✅
- `backend`: `npm run typecheck` ✅
- `backend`: targeted AI tests ✅
  - `AiRuntimeGuard.test.ts`
  - `OpenAICompatibleProvider.test.ts`
  - `SendChatMessageUseCase.test.ts`
  - `AiProposalSandbox.test.ts`
  - Result: 4 suites passed, 103 tests passed

### Review Notes

- Reviewer i18n findings were fixed.
- Final meaningful review was PASS.
- One final reviewer retry returned empty due to a subagent/tool hiccup; direct verification passed afterward.

### Known Follow-ups

- Run full regression/build suite before merge.
- Add Prisma AI proposal repository implementations when SQL mode becomes active.
- Strengthen frontend structured tool-result display typing later.
- Future human-approved execution must go through proper use cases and approval rules; do not enable direct AI writes.

### Manual-Test Detour: Firestore Metadata Serialization

During manual browser testing, “Show me the trial balance summary” failed because Firestore rejected `undefined` inside `metadata.toolCallResults`.

Fix:
- `SendChatMessageUseCase.ts` now omits empty `toolCallResults` and `proposal` metadata keys instead of writing `undefined`.
- `FirestoreAiChatRepository.ts` now strips nested `undefined` values before Firestore `set()`, matching the project’s Firestore mapper convention.
- Added targeted regression tests for both the use-case metadata shape and Firestore repository sanitization.

Verification:
- `backend`: `npm run typecheck` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/FirestoreAiChatRepository.test.ts src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` ✅ — 2 suites, 16 tests.
- `backend`: `npm run build` ✅ — local runtime output regenerated for Firebase emulator/browser retest; generated `backend/lib` artifacts are not intended for commit.

## End-User View

### What Changed

The AI Assistant is safer and clearer when answering ERP questions.

It can now show when it is:
- using a model/provider,
- running safe tools,
- working in text-only mode,
- asking for more information,
- creating a reviewable AI proposal.

### What Users Can Expect

- The assistant may answer normally.
- If it needs safe ERP data, it can request a registered read-only tool.
- If information is missing, it asks for clarification.
- If a draft/proposal is appropriate, it creates a sandbox proposal for review.

### What It Still Cannot Do

- It cannot post vouchers.
- It cannot create real ERP records directly.
- It cannot modify or delete business data.
- Accepting an AI proposal only marks the proposal as reviewed; it does not execute it.

### Access

- Tenant users need AI Assistant permissions to use chat/proposals.
- Super Admins can manage AI proposal policies from the platform area.
