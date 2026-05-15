# Completion Report: AI Certified Models Visibility & Seeding

**Status:** ✅ COMPLETE
**Date:** 2026-05-15
**Time Spent:** ~30m

## Technical Developer View

### Problem
The "Browse Certified Models" modal in the AI Assistant settings was appearing empty. This was caused by two issues:
1. **Missing Data Initialization:** The `AiModelProfile` entities (the blueprints) were not being seeded at startup. They were only seeded via a manual administrative API call that had not been executed in the current environment.
2. **Provider ID Mismatch:** The `AiAutoSeedCertification` seeder was looking for models with provider IDs like `openai`, `anthropic`, and `google`, whereas the `AiModelCapabilityCatalog` (the source of truth for profiles) defines them as `openai_compatible`.

### Solution
1. **Expanded Catalog:** Added Claude 3.5 Sonnet/Haiku and Gemini 1.5 Pro/Flash to `KNOWN_PROFILES` in `AiModelCapabilityCatalog.ts` using the `openai_compatible` provider.
2. **Aligned Seeder:** Updated `AiAutoSeedCertification.ts` to use `openai_compatible` for all well-known models to ensure matching profiles are found in the database.
3. **Automated Startup Sync:** Modified `backend/src/index.ts` to execute `syncBuiltInProfiles()` followed by `seedAutoCertifications()` on every server start. This ensures that the global AI metadata is always up-to-date and consistent with the codebase.

### Files Changed
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/services/AiAutoSeedCertification.ts`
- `backend/src/index.ts`

### Verification Results
- Manual execution of sync logic confirmed:
  - **13 model profiles synced**
  - **8 certifications seeded**
- Database now contains valid `GLOBAL` certifications for top-tier models.
- Backend typecheck passes.

---

## End-User View

### Feature Summary
Fixed a bug where the "Certified Models" list was empty. Users can now browse and select from a pre-certified list of high-quality AI models (like GPT-4o, Claude 3.5, and Gemini 1.5) without having to manually verify them.

### How to Use
1. Go to **AI Settings**.
2. Click **Browse Certified Models** (if in Credits mode) or search for a model.
3. You will now see a list of pre-verified models ready for use.
4. Selecting a certified model automatically enables advanced features like Tool Calling (allowing the AI to access your ERP data safely).
