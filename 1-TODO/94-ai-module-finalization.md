# Task 94 — AI Module Finalization

> **Goal:** Fix all remaining gaps in the AI Assistant module so it can be considered complete for pre-alpha. After this task, AI development pauses and focus shifts to other ERP modules.
>
> **Estimated effort:** 8-12 hours total across 6 subtasks
> **Branch:** `feat/phase-1a-core-bugs` (same branch, or create `feat/ai-finalization`)
> **Priority:** Complete all subtasks before moving to non-AI work.

---

## Subtask A — MockProvider: Use DB keywords instead of hardcoded (1-2h)

### Problem
`MockProvider.ts` has a hardcoded `toolMappings` array (lines 61-77) with only 3 entries:
- `['trial balance', 'balance sheet', 'accounting summary']` → `accounting.getTrialBalanceSummary`
- `['sales', 'invoices', 'revenue']` → `sales.getSalesSummary`
- `['inventory', 'stock', 'warehouse']` → `inventory.getInventorySummary`

These are completely separate from the `TOOL_KEYWORDS` in `AiToolCatalogSeed.ts` and from the DB-stored `chatKeywords` that Super Admin can update via `PATCH /platform/ai-tools/:toolName/keywords`.

This means:
1. MockProvider only knows 3 tools (should know all 25 implemented)
2. Super Admin keyword updates have no effect on MockProvider
3. New tools (like `reports.profitAndLoss`) are invisible to MockProvider

### Fix
Refactor `MockProvider.chatStream()` to read keywords from the tool catalog instead of hardcoded mappings.

### Files to modify
- `backend/src/application/ai-assistant/providers/MockProvider.ts`

### Implementation details

1. MockProvider needs access to tool definitions with their `chatKeywords`. Two approaches:

   **Option A (simpler):** Import `getExecutableDefinitions` from `AiToolCatalogSeed.ts` and read `chatKeywords` from each definition. This uses the seed + any DB overrides that were applied at startup.

   **Option B (dynamic):** Inject `AiToolCatalogUseCase` or the catalog into MockProvider to read live keywords from DB. More correct but requires changing MockProvider's constructor and DI wiring.

   **Recommended: Option A.** The catalog definitions already have `chatKeywords` populated from seed + DB overrides at startup (see `AiToolCatalogSeed.ts:1219-1223`). This is sufficient.

2. Replace the hardcoded `toolMappings` array (lines 61-77) with:
   ```typescript
   const toolMappings = getExecutableDefinitions()
     .filter(def => def.chatKeywords && def.chatKeywords.length > 0)
     .map(def => ({
       keywords: def.chatKeywords!.map(k => k.toLowerCase()),
       toolName: def.name,
       label: def.name.split('.').pop()!.replace(/([A-Z])/g, ' $1').trim(),
     }));
   ```

3. Keep the rest of the matching logic (lines 80-134) unchanged — it already handles 0/1/multiple matches correctly.

4. Remove the old hardcoded `toolMappings` constant entirely.

### Verification
- `npx tsc --noEmit` in backend — zero errors
- Start emulators, use MockProvider, type "profit and loss" → should match `reports.profitAndLoss` or `accounting.getProfitAndLoss`
- Type "aging receivables" → should match
- Type "sales" → should still match `sales.getSalesSummary`

---

## Subtask B — Super Admin Credits UI (2-3h)

### Problem
Super Admin can grant credits via API (`POST /platform/ai-assistant/credits/grant`) and the frontend API method `superAdminApi.grantAiCredits()` exists in `frontend/src/api/superAdmin/index.ts:600-601`, but there is **no UI page** that calls it.

Super Admin cannot:
- See credit balances per company
- Grant credits from the UI
- View credit history

### Fix
Add a credit management section to an existing Super Admin page.

### Files to modify
- `frontend/src/modules/super-admin/pages/CompanyEntitlementsPage.tsx` — Add a "AI Credits" section (like we did for `aiReportMode`)

### Implementation details

1. Add state: `creditBalance`, `creditInput`, `grantingCredits`

2. In `loadData()`, add a call to fetch credit balance. There is no existing Super Admin endpoint to GET credit balance per company. **Two options:**

   **Option A (quick):** Add a new backend route `GET /super-admin/companies/:companyId/ai-credits` in `SuperAdminController.ts` that reads the `AiCreditLedger` from the repository and returns `{ balance, totalPurchased, totalConsumed }`. Wire the frontend.

   **Option B (reuse existing):** Check if `AiCreditLedger` is accessible via an existing platform route. Looking at routes, `GET /platform/ai-assistant/credits/balance` exists only for the tenant themselves (in `ai-assistant.routes.ts`), not for Super Admin viewing another company's balance.

   **Recommended: Option A.** Add a simple GET endpoint.

3. Backend changes needed:
   - `backend/src/api/controllers/super-admin/SuperAdminController.ts` — Add `getCompanyAiCredits` static method that reads from `diContainer.aiCreditLedgerRepository.getByCompanyId(companyId)`
   - `backend/src/api/routes/super-admin.routes.ts` — Add `router.get('/companies/:companyId/ai-credits', SuperAdminController.getCompanyAiCredits)`
   - `frontend/src/api/superAdmin/index.ts` — Add `getCompanyAiCredits(companyId)` method

4. UI section on CompanyEntitlementsPage (before or after AI Report Mode section):
   - Display: current balance, total purchased, total consumed
   - Input field for amount + "Grant Credits" button
   - On grant: call `superAdminApi.grantAiCredits({ companyId, amount })`, refresh balance

5. Check what repository interface exists:
   - `backend/src/repository/interfaces/ai-assistant/` — look for `IAiCreditLedgerRepository` or similar
   - The `GrantAiCreditsUseCase` already exists at `backend/src/application/ai-assistant/use-cases/GrantAiCreditsUseCase.ts` — reuse it

### Verification
- `npx tsc --noEmit` on both backend and frontend
- Navigate to Super Admin > Companies > [company] > Entitlements
- See credit balance section with current balance
- Grant 100 credits → balance updates
- Switch to that company's AI settings → CreditBalanceCard shows updated balance

---

## Subtask C — Wire Behavioral Test Suite into Certification Engine (3-4h)

### Problem
`AiCertificationTestSuite.ts` defines 15 behavioral test cases (tool calling, accounting, safety, hallucination detection) with `runAllTests()` and `evaluateResponse()`. But this function is **never called** from `AiCertificationEngine.run()`. The deep probe test only checks "can this model call a tool?" — not "does it hallucinate financial data?" or "does it refuse unsafe requests?"

### Current state
- `AiCertificationEngine.ts:166-201` — `runDeepTest()` sends 1 diagnostic ping, scores 30 points
- `AiCertificationTestSuite.ts:485-535` — `runAllTests()` has 15 test cases but is orphaned
- Categories defined: `TOOL_CALLING`, `GENERAL_CHAT`, `ACCOUNTING`, `FINANCE_REPORTING`, etc.

### Fix
Integrate `runAllTests()` into the certification engine. When a provider is available and the category matches, run the relevant behavioral tests and include their scores in the certification result.

### Files to modify
- `backend/src/application/ai-assistant/services/AiCertificationEngine.ts`

### Implementation details

1. Import `runAllTests` from `AiCertificationTestSuite.ts`

2. In `AiCertificationEngine.run()`, after the deep probe test (line 140), add a behavioral test phase:
   ```
   // 4. Run Behavioral Tests (if provider available and deep probe passed)
   if (provider && deepTestScore > 0) {
     const behavioralResults = await runAllTests(provider, config, [input.category]);
     // Calculate behavioral score from results
     // Add to total score and failure reasons
   }
   ```

3. Adjust scoring to incorporate behavioral tests:
   - Structural: 40 points (was implicit 70)
   - Deep probe: 20 points (was 30)
   - Behavioral tests: 40 points (new)
   - Total: 100

4. The behavioral test results should be included in `metadata` of the certification result so the UI can display individual test pass/fail.

5. **Important:** `runAllTests` needs a provider and config. Check the function signature in `AiCertificationTestSuite.ts:485` and ensure the engine passes the correct arguments.

6. **Timeout safety:** Behavioral tests make multiple real AI calls. Add a timeout per test case (e.g., 30s) and overall timeout (e.g., 3min). If a test times out, mark it as failed, don't block the entire certification.

7. Update `testSuiteVersion` from `'hybrid-v2'` to `'hybrid-v3-behavioral'` to reflect the new scoring.

### Verification
- `npx tsc --noEmit` in backend
- Run certification for a known model (e.g., GPT-4o via BYOK) from the UI
- Verify the certification result includes behavioral test scores in metadata
- Verify a text-only model gets lower scores on TOOL_CALLING category
- Existing smoke tests still pass: `npm run test -- AiToolCatalogSmoke`

---

## Subtask D — Fix 9 Pre-existing Test Failures (1-2h)

### Problem
9 test suites fail due to constructor signature mismatches and stale assertions. These are pre-existing (not from Task 93) but must be fixed to prevent masking future regressions.

### Failures and fixes

#### D1. `CheckProviderHealthUseCase.test.ts` — Constructor needs 4 args (3 files)
The constructor now requires `modelProfileUseCase` as 4th argument:
```typescript
constructor(
  settingsRepository, encryptionService, httpClient,
  modelProfileUseCase,       // ← ADDED, required
  providerRepository?,       // ← optional
)
```

**Files to fix:**
- `backend/src/tests/application/ai-assistant/CheckProviderHealthUseCase.test.ts` (lines 177, 206, 236)
- `backend/src/tests/application/ai-assistant/AiToolCalling.test.ts` (lines 232, 261)
- `backend/src/tests/application/ai-assistant/AiAssistantNewFeatures.test.ts` (lines 178, 195, 209)

**Fix:** Add a mock `AiModelProfileUseCase` as 4th argument in each `new CheckProviderHealthUseCase(...)` call. Create a minimal mock:
```typescript
const mockModelProfileUseCase = {
  resolveProfile: jest.fn().mockResolvedValue({ /* minimal profile */ }),
  upsertProfile: jest.fn(),
  syncBuiltInProfiles: jest.fn(),
  recordDiagnostics: jest.fn(),
} as any;
```

#### D2. `AiModelCertificationUseCase.test.ts` — Constructor needs 6 args
```typescript
constructor(
  profileRepository, certificationRepository,
  settingsRepository, encryptionService,  // ← ADDED
  httpClient,                              // ← ADDED
  engine,
)
```

**File:** `backend/src/tests/application/ai-assistant/AiModelCertificationUseCase.test.ts` (line 93)

**Fix:** Add mock `settingsRepository`, `encryptionService`, `httpClient` in the test setup.

#### D3. `AiRuntimeGuard.test.ts` — Model profile status assertion
**File:** `backend/src/tests/application/ai-assistant/AiRuntimeGuard.test.ts` (line 301)
**Error:** `Expected: "tested"`, `Received: "recommended"`
**Fix:** Update the assertion to match the current profile status for `anthropic/claude-3-5-sonnet`. Check `AiModelCapabilityCatalog.ts` for the current value and update the test.

#### D4. `SendChatMessageUseCase.test.ts` — 2 failures
**File:** `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts`

1. Line 275: `expect((result.assistantMessage.metadata as any)?.isMock).toBe(true)` — Mock provider metadata changed. Check what MockProvider actually returns and update assertion.

2. Line 560: `expect(systemPrompt).toContain('Ask the user a short clarification question only when')` — System prompt wording changed. Read `AiContextBuilder.ts` for the current wording and update the expected substring.

#### D5. `ConfigureInventoryFinancialIntegrationUseCase.test.ts` — Missing mock method
**File:** `backend/src/tests/application/inventory/ConfigureInventoryFinancialIntegrationUseCase.test.ts`
**Error:** `this.stockMovementRepo.hasAnyMovements is not a function`
**Fix:** Add `hasAnyMovements: jest.fn().mockResolvedValue(false)` to the mock `stockMovementRepo`.

#### D6. `AccountingBoundary.test.ts` — Architecture boundary drift
**File:** `backend/src/tests/architecture/AccountingBoundary.test.ts`
**Error:** New imports violate expected boundary. Review the boundary rule and either update the test to allow the new legitimate imports, or fix the boundary violation if it's accidental.

#### D7. `real-provider-smoke.test.ts` — Integration test (skip if no provider)
**File:** `backend/tests/integration/ai-assistant/real-provider-smoke.test.ts`
**Fix:** Ensure the test skips gracefully when no real provider is configured (should already have a skip condition — check if it's broken).

### Verification
- `npm run test` — all 10 previously-failing suites should now pass (or skip gracefully)
- Total: 102 suites, 0 failures

---

## Subtask E — Streaming Credit Pre-check (30min)

### Problem
`StreamChatMessageUseCase` doesn't check credit balance before starting the stream. Credits are debited after completion. A user with 0 credits could start a stream and receive a full response before the debit fails.

### Files to modify
- `backend/src/application/ai-assistant/use-cases/StreamChatMessageUseCase.ts`

### Implementation details

1. Find where config is loaded and credentials resolved (similar to `SendChatMessageUseCase.ts:157-168`)

2. After credential resolution, add the same credit pre-check that exists in `AiCredentialResolver.ts:104-107`:
   ```typescript
   if (runtimeMode === 'CREDITS') {
     const ledger = await creditLedgerRepo.getByCompanyId(companyId);
     if (!ledger || !ledger.hasCredits()) {
       throw ApiError.forbidden('Insufficient AI credits');
     }
   }
   ```

3. If `StreamChatMessageUseCase` doesn't have access to the credit ledger repo, add it to the constructor and DI wiring in `bindRepositories.ts`.

### Verification
- `npx tsc --noEmit` in backend
- Set a company to CREDITS mode with 0 balance
- Try to stream a message → should get immediate 403, not a streamed response

---

## Subtask F — Commit Remaining Uncommitted Files (15min)

### Problem
~45 files from previous work sessions are uncommitted on `feat/phase-1a-core-bugs`. Risk of losing work.

### Action
After all subtasks above are complete, stage and commit ALL remaining changes in a single commit:

```bash
git add -A
git commit -m "chore: commit accumulated Phase 1A work (AI stabilization, voice, sales/purchase fixes)"
```

**Exclude** `backend/src/application/ai-assistant/use-cases/CheckProviderHealthUseCase.patch.py` — this is a stray script, delete it.

---

## Verification Plan (After All Subtasks)

1. `npx tsc --noEmit` in backend — zero errors
2. `npx tsc --noEmit` in frontend — zero errors
3. `npm run test` in backend — zero failures (all 102 suites pass)
4. Manual: MockProvider responds to "profit and loss", "aging receivables", "sales summary"
5. Manual: Super Admin can grant credits and see balance on CompanyEntitlementsPage
6. Manual: Run certification for a model → behavioral test scores in result metadata
7. Manual: Company with 0 credits in CREDITS mode → streaming returns 403 immediately

---

## After This Task

The AI module is complete for pre-alpha. Remaining deferred items (tracked, not blocking):
- Currency conversion for authoritative reports (Task 93 Phase 3)
- Cost Center Summary / Budget vs Actual tools (need lookup repos)
- Inventory / HR tools (separate tasks when those modules mature)
- API key encryption algorithm audit (pre-production)
- Conversation cleanup scheduled job (pre-production)
