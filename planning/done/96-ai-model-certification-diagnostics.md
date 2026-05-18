# Task 96 — Proactive AI Certification Diagnostics

**Status:** ✅ Complete
**Date completed:** 2026-05-17
**Branch:** `chore/enterprise-restructure`
**Time spent:** ~0.5h
**Linked plan:** *None (ad-hoc request)*
**Linked architecture doc:** [`docs/architecture/ai-assistant-runtime-v2.md`](../../docs/architecture/ai-assistant-runtime-v2.md)
**Linked user guide:** [`docs/user-guide/ai-assistant-runtime-v2.md`](../../docs/user-guide/ai-assistant-runtime-v2.md)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [x] Code merged
- [x] `docs/architecture/ai-assistant-runtime-v2.md` updated or created — technical doc for future engineers
- [x] `docs/user-guide/ai-assistant-runtime-v2.md` created — plain-language guide for end users
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [x] `planning/ACTIVE.md` updated with next task

---

## 1. Technical Developer View

### What Was Built

We implemented a proactive diagnostic pre-flight connectivity check inside the AI model certification use case. Previously, when a provider was not configured or unavailable during model certification, the system would run a full certification suite with no provider and fail at the "Deep Probe" behavioral test stage, producing a generic score reduction (40/100) and certification failure. Now, certification runs a lightweight pre-flight connectivity (`isAvailable()`) and basic inference chat check. If either check fails, certification halts early and fails gracefully with the specific diagnostic error (e.g., missing API key, invalid credentials, or network timeout) recorded in the result metadata and summary.

### Files Changed

**Backend**
- `backend/src/application/ai-assistant/use-cases/AiModelCertificationUseCase.ts` — Added pre-flight health diagnostic logic before calling certification engine.
- `backend/src/tests/application/ai-assistant/AiModelCertificationUseCase.test.ts` — Added unit test suite covering pre-flight checks under different network/inference statuses, and refined `mockEngine.run` to act as real `AiCertificationEngine`.

**Docs**
- `docs/architecture/ai-assistant-runtime-v2.md` — Appended architectural design notes on pre-flight flow.
- `docs/user-guide/ai-assistant-runtime-v2.md` — Appended user instructions for Certification Pre-Flight Diagnostics.

### Architecture / Behavior

- **Pre-flight Diagnostic**: Before executing full certification tests, we test connection health:
  1. `provider.isAvailable()`: verifies endpoint network connectivity.
  2. `provider.chat()` with simple prompt: verifies authentication, API keys, and basic model response.
- **Early-Fail Grace**: If any check fails, the provider instance is cleared (`provider = undefined`) to bypass the expensive Deep Probe tests.
- **Enriched Results**: Result is generated via `AiModelCertificationResult.fromJSON` with the specific diagnostic details mapped to `result.metadata.preflightDiagnostic` and an overridden descriptive `result.summary`.

### Verification

- [x] `cd backend && npx tsc --noEmit` clean (0 errors)
- [x] Unit tests passed: `npx jest --runTestsByPath src/tests/application/ai-assistant/AiModelCertificationUseCase.test.ts` (8/8 passed)

---

## 2. End-User View

### What's New

When running AI Model Certification (from Super Admin or Company Settings), the system now automatically validates your provider's health and connection quality before running the full certification tests. If your AI provider settings are correct, certification will proceed normally and test full capabilities.
If settings are wrong, connectivity is down, or your API key is invalid, the certification results will show instantly with status `FAILED` and a clear, descriptive summary of the exact connection issue.

### How to Use It

1. Trigger AI Model Certification (e.g., from Super Admin -> AI Models -> Run Certification, or Company Settings).
2. If your AI provider settings are correct, certification will proceed normally and test full capabilities.
3. If settings are wrong, connectivity is down, or your API key is invalid, the certification results will show instantly with status `FAILED` and a clear, descriptive summary of the exact connection issue.

### Where to Find It

- Menu: Super Admin → AI Models (for global certifications) or AI Assistant → Settings → Provider (for tenant-level certifications).
- Required permission: Super Admin or Company Admin permissions.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
