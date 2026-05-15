# AI Assistant Real Report Tooling Plan

**Status:** Ready for implementation planning  
**Created:** 2026-05-15  
**Estimate:** Phase 1: 4-6h, Full rollout: 2-4 days depending on report coverage  
**Owner:** Orchestrator / CTO agent  

---

## Vision & Final Goal

**Vision:**  
Transform the AI Assistant from a convenient "data summarizer" into a mathematically precise, authoritative financial analyst. The AI must never be a second, parallel reporting system that guesses or estimates numbers. It must become a direct consumer of the exact same reports that power the ERP's UI. Furthermore, this transition will establish a **Dual-Tier Business Model**, allowing the platform owner to monetize absolute reporting accuracy as a premium feature, while preserving the existing summarization tools for standard tenants.

**Final Goal:**
1. **Absolute Parity (Zero Drift):** The AI must produce the exact same numbers, totals, and currency conversions as the manual UI reports, using the same backend use cases.
2. **Clarification over Assumption:** The AI must intelligently ask for missing context (like dates or report currencies in multi-currency tenants) instead of silently defaulting.
3. **Monetizable Dual-Tier Architecture:** 
   - **Standard Tier:** Free-tier tenants retain the current AI summary tools.
   - **Premium Tier:** Upgraded tenants unlock the authoritative Real Report Registry, giving them exact, UI-parity data.
4. **Impenetrable Security:** The tiering logic must be managed completely server-side via `AiProviderConfig`. Hackers or normal tenant admins cannot bypass the tier gate; only Super Admins (or billing webhooks) can upgrade a tenant to the Premium reporting tier.

---

## Problem

The AI Assistant currently has hand-built summary tools such as `accounting.getProfitAndLoss`, `sales.getSalesSummary`, and `reports.getFinancialOverview`. These tools are useful, but they are not guaranteed to represent the exact same report a normal ERP user sees in the UI.

This creates correctness risk:

- Tool outputs can omit key report context such as currency, date basis, posting basis, tax basis, cost center filter, fiscal period, or status inclusion.
- Some summaries aggregate data in ways that are not clearly tied to a real report.
- When a real report changes, the AI summary tool can drift unless it is updated separately.
- In multi-currency tenants, the model may infer the wrong currency or fail to ask for required report parameters.
- Missing data can be confused with real zero values if tools do not expose partial failure/warning metadata.

The AI must not become a second reporting system. It should be another consumer of the same authoritative reports users can run manually.

---

## Target Architecture

Create a real report tool layer where AI calls registered report contracts instead of bespoke summaries.

Recommended shape:

```ts
reports.list()
reports.describe(reportId)
reports.run(reportId, params)
```

Alternative provider-friendly shape:

```ts
reports.runProfitAndLoss(params)
reports.runTrialBalance(params)
reports.runAccountStatement(params)
```

Either shape is acceptable if both are generated from the same `ReportDefinition` registry.

The registry is the important part.

---

## ReportDefinition Contract

Each user-visible report must have one definition:

```ts
interface ReportDefinition {
  id: string;
  title: string;
  moduleId: string;
  permission: string;
  sourceUseCase: string;
  uiRoute?: string;
  paramsSchema: Record<string, unknown>;
  requiredParams: string[];
  optionalParams: string[];
  defaults: Record<string, unknown>;
  aiClarificationRules: AiClarificationRule[];
  outputSchema: Record<string, unknown>;
  outputContext: ReportOutputContextSpec;
  version: string;
}
```

Required report metadata:

```ts
interface ReportOutputContext {
  reportId: string;
  reportTitle: string;
  reportVersion: string;
  generatedAt: string;
  companyTimezone: string;
  period?: { fromDate: string; toDate: string };
  asOfDate?: string;
  dateBasis: 'postingDate' | 'documentDate' | 'invoiceDate' | 'asOfDate';
  filters: Record<string, unknown>;
  defaultsApplied: string[];
  includedStatuses?: string[];
  excludedStatuses?: string[];
  warnings: ReportWarning[];
}
```

Money reports must also return:

```ts
interface ReportMoneyContext {
  baseCurrency: string;
  reportCurrency: string;
  amountBasis: 'base' | 'document' | 'presentation';
  converted: boolean;
  conversionPolicy?: 'transactionRate' | 'periodAverage' | 'closingRate' | 'manualRate' | 'notConverted';
  exchangeRateDate?: string;
  exchangeRateSource?: string;
}
```

No AI-facing report result should return monetary values without `ReportMoneyContext`.

---

## Clarification Rules

The model should not guess report parameters that materially change the result.

General rules:

1. If a required parameter is missing and cannot be safely inferred from the user message, ask a short clarification question.
2. If a default is applied, return it in `defaultsApplied` and state it in the answer.
3. If the tenant is multi-currency and the report supports presentation currency, `reportCurrency` is required for AI unless the user explicitly asks for base currency or company policy says AI may default to base currency.
4. If the user asks for "another currency", "USD", "EUR", etc., validate that currency is enabled and that required exchange-rate policy is available.
5. If the report supports cost centers, only require `costCenterId` when the user asks for cost-center-specific output or the report itself is a cost-center report.
6. If a date range is required, ask for it unless the user gives an inferable period such as "this month", "Q1 2026", or "this year".
7. If an as-of date is required, ask for it unless the user says "today" or another inferable date.

Recommended product decision (CONFIRMED):

- In multi-currency tenants, the AI MUST ALWAYS ASK for the report currency. It will not silently default to base currency.
- The AI must fully support changing currencies using the existing exchange rate mechanism to match the real report's capabilities.

---

## P&L Example

Report definition:

```ts
{
  id: 'accounting.profitAndLoss',
  requiredParams: ['fromDate', 'toDate', 'reportCurrency'],
  optionalParams: ['costCenterId', 'comparisonPeriod'],
  aiClarificationRules: [
    'Ask for date range when missing.',
    'Ask for report currency when tenant is multi-currency.',
    'Ask for cost center only when the user mentions cost center/department/project.'
  ]
}
```

User: "show P&L in USD for Jan 2026"  
Action: Run report with:

```ts
{
  fromDate: '2026-01-01',
  toDate: '2026-01-31',
  reportCurrency: 'USD'
}
```

User: "show P&L"  
Action: Ask for missing date range and currency.

User: "show P&L for this year in base currency"  
Action: Infer date range, use base currency, run report.

---

## Initial Real Reports To Register

Phase 1 should cover accounting reports first because they have the highest correctness risk:

1. `accounting.profitAndLoss`
2. `accounting.trialBalance`
3. `accounting.balanceSheet`
4. `accounting.cashFlow`
5. `accounting.generalLedger`
6. `accounting.accountStatement`
7. `accounting.agingReceivables`
8. `accounting.agingPayables`
9. `accounting.costCenterSummary`
10. `accounting.budgetVsActual`

Phase 2:

1. Sales invoice report
2. Sales order report
3. Customer balance/aging report
4. Purchase invoice report
5. Purchase order report
6. Supplier balance/aging report
7. Inventory stock report
8. Stock movement report

---

## Tool Transition Strategy: The Dual-Tier Model

The existing bespoke AI summary tools (e.g., `accounting.getProfitAndLoss`, `accounting.getTrialBalanceSummary`) are fully functional and will **NOT** be deleted or broken.

Instead, we will adopt a **Dual-Tier Strategy**, allowing companies to be assigned a specific reporting tier:

1. **Standard AI Reporting (Current Approach):**
   - Uses the existing hand-built summary tools.
   - Provides quick, top-level data (e.g., "Top 10 expenses").
   - Implicit defaults (e.g., current month).
   - This remains the default experience.

2. **Premium / Authoritative AI Reporting (New Approach):**
   - Uses the new `ReportDefinition` registry.
   - Provides exact UI-parity data, strict currency enforcement, and full context.
   - Can process massive reports via built-in aggregation/pagination modes (`aiSummaryMode`).
   - Monetizable as a high-tier feature.

**Implementation detail:** The `AiToolCatalogSeed` or `AiToolCallingOrchestrator` will check the tenant's `aiReportingTier` setting. If standard, it injects the old tools. If premium, it injects the new registry tools. This ensures absolute safety for the currently working system while we build the new one alongside it.

---

## Implementation Phases

### Phase 1 - Report Registry Foundation

**Estimate:** 4-6h

Files likely touched:

- `backend/src/domain/reports/ReportDefinition.ts` or similar
- `backend/src/application/reports/ReportRegistry.ts`
- `backend/src/application/reports/RunReportUseCase.ts`
- `backend/src/application/ai-assistant/tools/RunReportTool.ts`
- `backend/src/application/ai-assistant/catalog/AiToolCatalogSeed.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`

Tasks:

1. Create `ReportDefinition` domain/application contract.
2. Register accounting report definitions.
3. Add `reports.describe` and `reports.run` AI tools, or generated provider-safe report tools.
4. Ensure the tool only calls permission-checked report use cases.
5. Return full `ReportOutputContext` and `ReportMoneyContext`.
6. Add tests proving the AI report output matches the normal report use case output for the same params.

### Phase 2 - Parameter Clarification

**Estimate:** 4-6h

Files likely touched:

- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
- `backend/src/application/ai-assistant/services/AiContextBuilder.ts`
- `backend/src/domain/ai-assistant/tools/AiToolContract.ts`

Tasks:

1. Expose report parameter schemas and clarification rules to the model.
2. Add prompt rule: missing required report params must trigger clarification, not execution.
3. Add multi-currency rule: ask for report currency in multi-currency tenants when needed.
4. Add tests for missing date range, missing currency, ambiguous cost center, and inferable periods.

### Phase 3 - Currency & Conversion Policy

**Estimate:** 4-8h, depends on current conversion support

Files likely touched:

- `backend/src/repository/interfaces/core/ICompanyCurrencyRepository.ts`
- `backend/src/repository/interfaces/core/IExchangeRateRepository.ts`
- `backend/src/application/core/services/ExchangeRateService.ts`
- report use cases that need presentation currency support

Tasks:

1. Add/read company currency context.
2. Validate requested report currency is enabled.
3. Decide conversion policy per report.
4. Return exchange-rate source/date/policy in every converted report.
5. Fail with a clear warning/error when requested report currency cannot be produced accurately.

Business decision required before implementation (CONFIRMED):

- P&L conversion policy: AI must use the existing exchange rate mechanism natively supported by the real reports.
- Balance Sheet conversion policy: Same as above.
- Multi-currency: AI must always ask, never silently default.

### Phase 4 - Frontend/AI Result Rendering

**Estimate:** 2-4h

Files likely touched:

- `frontend/src/modules/ai-assistant/components/AiToolResultsPanel.tsx`
- `frontend/src/api/aiAssistantApi.ts`
- i18n files under `frontend/src/locales/`

Tasks:

1. Render report id, period/as-of date, currency, filters, and warnings on AI report result cards.
2. Never show bare numbers for money fields.
3. Show "partial data" and "defaults applied" warnings clearly.

### Phase 5 - Implement Tenant Tiering & Rollout

**Estimate:** 1 day

Tasks:

1. Add `aiReportingTier: 'standard' | 'premium'` to Company/Tenant settings.
2. Update tool orchestrator to conditionally inject the correct toolset based on the tenant's tier.
3. Ensure no naming collisions occur if a tenant switches back and forth between tiers.
4. Add tests verifying that standard tenants cannot access premium registry tools and vice versa.

---

## Recommended Multi-Agent Execution

The orchestrator should not start implementation until product decisions are confirmed.

Suggested agent flow:

1. `erp-repo-explorer`
   - Map all existing user-visible reports, routes, pages, API functions, use cases, and parameters.
   - Output a report inventory table.

2. `erp-backend-architect`
   - Review the `ReportDefinition` and `RunReportUseCase` design.
   - Check SQL-migration readiness and repository-boundary compliance.

3. `erp-api-contract`
   - Verify that AI report contracts match existing frontend/manual report contracts.
   - Identify parameter drift and missing output metadata.

4. `erp-backend-builder`
   - Implement the report registry, report runner, AI tool, and backend tests.

5. `erp-frontend-builder`
   - Update AI result rendering and i18n after backend contract is stable.

6. `erp-reviewer`
   - Review for correctness, permissions, tenant isolation, Firestore leakage, and report parity.

7. `erp-test-runner`
   - Run backend typecheck/tests, frontend typecheck/build, and focused AI report parity tests.

Only one builder should edit backend report/tool files at a time.

---

## Acceptance Criteria

1. AI can list/describe available real reports with required parameters.
2. AI asks clarification when required report params are missing.
3. AI uses the same report use case/data as the manual UI report.
4. AI result includes report context, money context, filters, defaults, and warnings.
5. Multi-currency tenants cannot receive unlabeled or guessed-currency amounts.
6. Requested report currency is validated before execution.
7. Missing exchange-rate policy/data returns a clear error or warning, not fabricated conversion.
8. Failed subreports are not converted to zero.
9. The dual-tier system works: standard tenants use existing summary tools, premium tenants use the registry.
10. Tests prove UI/manual report and AI report output match for the same params.

---

## Risks

- Some existing UI reports currently rely on frontend fallbacks such as company base currency. Those must move into backend report output metadata.
- Some reports do not yet support presentation-currency conversion. The AI must not pretend they do.
- A single generic `reports.run` tool may be harder for some providers than generated per-report functions. If tool-calling reliability suffers, generate provider-safe per-report tools from the registry.
- Changing report output contracts may require frontend adjustments.

---

## Next Step

Before coding, confirm the business decisions under Phase 3, especially AI currency behavior in multi-currency tenants and report conversion policy. After that, begin Phase 1 with accounting reports only.
