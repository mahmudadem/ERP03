# AI Assistant Security Hardening

Phase 2 adds two backend protections.

## Prompt Injection Sanitization

`AiToolCallingOrchestrator` sanitizes tool result data before it is placed into prompt context.

The sanitization happens only on the prompt copy. Stored ERP data is not modified.

Protected patterns include:
- “ignore previous instructions” style phrases,
- attempts to reveal API keys/secrets/tokens,
- “you are now …” role override attempts,
- “forget all rules/instructions” phrases,
- bracketed/angle prompt markers such as `[SYSTEM]`, `[INST]`, `[SYS]`.

The marker logic is delimiter-aware to avoid corrupting legitimate business words like `INSTALLATION`, `INSTITUTE`, `SYSTEMIC`, or `sysadmin`.

## Concurrent Request Deduplication

`SendChatMessageUseCase` now maintains an in-memory active lock set keyed by:

`companyId:userId:conversationId`

If another request for the same key is already running, the use case throws HTTP 409 Conflict.

The lock is released in `finally`, so normal success and provider/error failures both clean up the lock.

## Limitations

The lock is process-local. It prevents duplicate sends within a single Node.js process. A future production deployment with multiple instances should replace or supplement it with a distributed lock.
