# AI Assistant Fixing Plan — Phase 1 Credits Runtime

**Date:** 2026-05-12  
**Status:** Complete  
**Branch:** `feat/ai-proposal-sandbox`

## Technical Developer View

Phase 1 replaced the incorrect active `PLATFORM_MANAGED` runtime mode with `CREDITS` while keeping legacy read compatibility. The AI Assistant now supports three tenant runtime modes: `BYOK`, `CREDITS`, and `DISABLED`.

Changed areas:
- Runtime mode domain/DTO/validator cleanup.
- `AiCreditLedger` domain entity and Firestore repository.
- Chat runtime credit checks and post-success debit.
- Tenant credit balance endpoint: `GET /tenant/ai-assistant/credits`.
- Super Admin credit grant endpoint: `POST /platform/ai-assistant/credits/grant`.
- Frontend API types/client functions and runtime-mode labels.
- `assertSuperAdmin` security detour so `/platform/*` routes are actually Super Admin-protected.

Verification:
- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 28/28
- `backend`: `npm run test -- assertSuperAdmin` ✅ — 4/4
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run build` ✅

## End-User View

AI Assistant can now run in **Use AI Credits** mode. In this mode, the platform provides the AI connection and each successful chat response consumes one AI credit from the company balance. Companies can still use **Bring Your Own Key** if they prefer to use their own provider account.

If a company has no credits left, chat will not run in Credits mode until credits are granted or the company switches to BYOK.

## Known Follow-ups

- Add UI for Super Admin credit grants and tenant credit balance display if desired in Phase 6/7 UX work.
- Consider transactional credit debit for high-concurrency production usage.
