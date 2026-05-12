# AI Assistant Fixing Plan — Phase 2 Security Hardening

**Date:** 2026-05-12  
**Status:** Complete  
**Branch:** `feat/ai-proposal-sandbox`

## Technical Developer View

Phase 2 added backend security hardening for AI prompt safety and duplicate chat request prevention.

### What Changed

- `AiToolCallingOrchestrator` now sanitizes ERP tool-result data before inserting it into AI prompt context.
- Sanitization is recursive and applies to nested arrays/objects.
- Prompt-injection strings such as “ignore previous instructions”, “reveal API key”, role override attempts, and bracketed prompt markers are replaced before the model sees them.
- Normal business strings such as `INSTALLATION`, `INSTITUTE`, `SYSTEMIC`, and `sysadmin` are not corrupted.
- `SendChatMessageUseCase` now prevents duplicate simultaneous requests for the same company/user/conversation using an in-memory lock.
- Locks are released in `finally` on success or error.

### Verification

- `backend`: `npx tsc --noEmit` ✅
- `backend`: `npm run build` ✅
- `backend`: `npm run test -- SendChatMessageUseCase` ✅ — 32/32
- `frontend`: `npm run build` ✅

### Known Non-Blocking Issue

- Full `AiToolCalling` test command still has two pre-existing `CheckProviderHealthUseCase - Cooldown` test failures unrelated to Phase 2A. New prompt sanitization tests pass.

## End-User View

AI Assistant is safer and more stable:

- Data returned from ERP tools is cleaned before being sent to the AI model, reducing the risk that malicious names or notes can override the assistant’s instructions.
- If a user double-clicks Send or sends two messages too quickly in the same conversation, the system now blocks the duplicate request and asks them to wait.

## Follow-Ups

- Consider distributed locking if the backend runs across multiple instances.
- Investigate unrelated cooldown test failures in `AiToolCalling.test.ts`.
