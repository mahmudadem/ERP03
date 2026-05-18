# AI Assistant Tools & Report Modes (2026-05-18)

## Overview

The AI Assistant tool system provides two complementary report delivery modes:
- **Standard mode** — lightweight summary tools for fast queries
- **Authoritative mode** — full ERP report engine for production accuracy

Each company (tenant) selects which mode to use via `aiReportMode` config. The AI assistant only calls tools matching the selected mode.

---

## Architecture

### Report Modes

**Configuration field:** `AiProviderConfig.aiReportMode`

| Mode | Purpose | Tool Set | Speed | Data Completeness |
|------|---------|----------|-------|-------------------|
| `'standard'` | Quick summaries for insights | `accounting.*` | Fast | Top 10 accounts per section |
| `'authoritative'` | Full ERP reports for accuracy | `reports.*` | Slower | Complete with truncation options |

### Report Mode Gate (Orchestrator)

**File:** `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts` (lines 449-451)

```typescript
const reportMode = options?.providerConfig?.aiReportMode || 'standard';
if (reportMode === 'standard' && AUTHORITATIVE_REPORT_TOOL_NAMES.includes(def.name)) continue;
if (reportMode === 'authoritative' && STANDARD_REPORT_TOOL_NAMES.includes(def.name)) continue;
```

When building the allowed tool list for a chat:
1. The orchestrator reads `providerConfig.aiReportMode`
2. If `'standard'` — excludes all `reports.*` tools
3. If `'authoritative'` — excludes all `accounting.*` tools
4. Only matching tools are added to the AI's context

---

## Tool Sets

### Standard Mode Tools (accounting.*)

**8 summary tools** — lightweight, permission-gated, return top N accounts.

| Tool Name | Class File | Returns | Max Items |
|-----------|-----------|---------|-----------|
| `accounting.getTrialBalanceSummary` | `GetTrialBalanceSummaryTool.ts` | Trial balance with top 10 accounts | 10 |
| `accounting.getProfitAndLoss` | `GetProfitAndLossTool.ts` | Revenue, expenses, net profit, top accounts | 10 |
| `accounting.getBalanceSheet` | `GetBalanceSheetTool.ts` | Assets, liabilities, equity, top accounts | 10 |
| `accounting.getCashFlowSummary` | `GetCashFlowTool.ts` | Operating, investing, financing cash flows | — |
| `accounting.getAgingReceivables` | `GetAgingReceivablesTool.ts` | A/R by age bucket | 10 |
| `accounting.getAgingPayables` | `GetAgingPayablesTool.ts` | A/P by age bucket | 10 |
| `accounting.getGeneralLedgerSummary` | `GetGeneralLedgerSummaryTool.ts` | G/L by account with debit/credit totals | 10 |
| `accounting.getAccountStatementSummary` | `GetAccountStatementSummaryTool.ts` | Statement for a specific account | — |

**Implementation pattern:**
- Inherit business logic from existing use cases (no duplicated logic)
- Sanitize output (top 10 leaf accounts by absolute balance)
- Permission-gated (e.g., `accounting.reports.balanceSheet.view`)
- Return flat DTO with totals + truncation flag

**Example return shape (Balance Sheet):**
```json
{
  "asOfDate": "2026-05-18",
  "baseCurrency": "USD",
  "totalAssets": 150000,
  "totalLiabilities": 50000,
  "totalEquity": 100000,
  "totalLiabilitiesAndEquity": 150000,
  "retainedEarnings": 80000,
  "isBalanced": true,
  "difference": 0,
  "assets": { "totalCount": 35, "displayedCount": 10, "items": [...] },
  "liabilities": { ... },
  "equity": { ... },
  "truncated": true,
  "truncationNote": "Showing top 10 accounts per section. Navigate to the Balance Sheet report for the complete list."
}
```

### Authoritative Mode Tools (reports.*)

**8 report tools** — run the full ERP `ReportRunner`, include report context.

| Tool Name | Report Definition | Uses | Returns |
|-----------|-------------------|------|---------|
| `reports.profitAndLoss` | `accounting.profitAndLoss` | GetProfitAndLossUseCase | Structured revenue/COGS/operating/net, all accounts |
| `reports.trialBalance` | `accounting.trialBalance` | GetTrialBalanceUseCase | All accounts with debit/credit/closing balances |
| `reports.balanceSheet` | `accounting.balanceSheet` | GetBalanceSheetUseCase | Assets, liabilities, equity with all accounts |
| `reports.cashFlow` | `accounting.cashFlow` | GetCashFlowStatementUseCase | Operating, investing, financing with opening/closing cash |
| `reports.generalLedger` | `accounting.generalLedger` | GetGeneralLedgerUseCase | All accounts with aggregated debit/credit |
| `reports.accountStatement` | `accounting.accountStatement` | GetAccountStatementUseCase | Per-account entries with running balance |
| `reports.agingReceivables` | `accounting.agingReceivables` | AgingReportUseCase | A/R with aging buckets, all accounts |
| `reports.agingPayables` | `accounting.agingPayables` | AgingReportUseCase | A/P with aging buckets, all accounts |

**Implementation pattern:**
- Factory function: `createReportToolClass(definition, toolName, description)`
- Delegates to `ReportRunner.run(definition, companyId, userId, params)`
- Returns wrapped result: `{ reportContext, moneyContext, data }`
- Automatic parameter defaults (e.g., `asOfDate` = today)

**Example return shape (wrapped):**
```json
{
  "reportContext": {
    "reportId": "accounting.balanceSheet",
    "reportTitle": "Balance Sheet",
    "generatedAt": "2026-05-18T14:30:00Z",
    "asOfDate": "2026-05-18",
    "dateBasis": "transactional",
    "filters": { "asOfDate": "2026-05-18" },
    "defaultsApplied": ["asOfDate: today"],
    "truncated": false
  },
  "moneyContext": {
    "baseCurrency": "USD",
    "reportCurrency": "USD",
    "converted": false,
    "conversionPolicy": "notConverted"
  },
  "data": {
    "totalAssets": 150000,
    "totalLiabilities": 50000,
    "totalEquity": 100000,
    "assets": { "total": 35, "displayed": 35, "items": [...] },
    "liabilities": { ... },
    "equity": { ... }
  }
}
```

### Additional Tools (Always Available)

These tools are **not affected by report mode** — they're always included if the user has permission.

| Tool Name | Class | Purpose |
|-----------|-------|---------|
| `accounting.getAccountBalance` | GetAccountBalanceTool.ts | Balance for a specific account |
| `accounting.getFinancialOverview` | GetFinancialOverviewTool.ts | Meta-tool: summary of top metrics (P&L, assets, cash) |
| `accounting.getFiscalYearStatus` | GetFiscalYearStatusTool.ts | Current fiscal year, closing status |
| `sales.getSalesSummary` | GetSalesSummaryTool.ts | Revenue by customer/product |
| `sales.getTopCustomers` | GetTopCustomersTool.ts | Top customers by revenue |
| `purchases.getPurchaseSummary` | GetPurchaseSummaryTool.ts | Spending by supplier |
| `purchases.getTopSuppliers` | GetTopSuppliersTool.ts | Top suppliers by spend |
| `inventory.getChartOfAccountsSummary` | GetChartOfAccountsSummaryTool.ts | Account hierarchy overview |
| `analytics.getMonthlyComparison` | GetMonthlyComparisonTool.ts | Month-over-month trends |

---

## Frontend Rendering

**File:** `frontend/src/modules/ai-assistant/components/AiToolResultsPanel.tsx`

The frontend renders tool results based on tool name and data structure:

```typescript
// Standard mode tools (flat data at top level)
{tool.toolName === 'accounting.getBalanceSheet' && <BalanceSheetView data={data} />}
{tool.toolName === 'accounting.getProfitAndLoss' && <ProfitAndLossView data={data} />}

// Authoritative mode tools (data wrapped in reportContext + data)
{tool.toolName === 'reports.balanceSheet' && <BalanceSheetView data={unwrapReportData(data)} />}
{tool.toolName === 'reports.profitAndLoss' && <ProfitAndLossView data={unwrapReportData(data)} />}
```

**Data unwrapping helper:**
```typescript
const unwrapReportData = (raw: Record<string, unknown>): Record<string, unknown> =>
  raw.reportContext && raw.data && typeof raw.data === 'object'
    ? (raw.data as Record<string, unknown>)
    : raw;
```

This allows the same view component to render both standard (flat) and authoritative (wrapped) data.

---

## Tool Registry & DI

**File:** `backend/src/infrastructure/di/bindRepositories.ts`

All 17+ tools are registered in the DI container's `aiToolRegistry` getter:

```typescript
// Standard accounting tools (8)
new GetTrialBalanceSummaryTool(ledgerRepo, accountRepo, permissionChecker),
new GetProfitAndLossTool(ledgerRepo, accountRepo, permissionChecker),
new GetBalanceSheetTool(ledgerRepo, accountRepo, permissionChecker),
new GetCashFlowTool(ledgerRepo, accountRepo, companyRepo, permissionChecker),
new GetGeneralLedgerSummaryTool(ledgerRepo, permissionChecker),
new GetAgingReceivablesTool(ledgerRepo, accountRepo, permissionChecker),
new GetAgingPayablesTool(ledgerRepo, accountRepo, permissionChecker),
new GetAccountStatementSummaryTool(ledgerRepo, permissionChecker, accountRepo, companyRepo),

// Authoritative report tools (8)
new (RunProfitAndLossTool)(reportRunner),
new (RunTrialBalanceTool)(reportRunner),
new (RunBalanceSheetTool)(reportRunner),
new (RunCashFlowTool)(reportRunner),
new (RunGeneralLedgerTool)(reportRunner),
new (RunAccountStatementTool)(reportRunner),
new (RunAgingReceivablesTool)(reportRunner),
new (RunAgingPayablesTool)(reportRunner),

// Meta and domain tools (9+)
new GetFinancialOverviewTool(...),
new GetMonthlyComparisonTool(...),
new GetAccountBalanceTool(...),
new GetSalesSummaryTool(...),
new GetTopCustomersTool(...),
new GetPurchaseSummaryTool(...),
new GetTopSuppliersTool(...),
new GetFiscalYearStatusTool(...),
new GetChartOfAccountsSummaryTool(...),
```

---

## Tool Catalog & Seeding

**File:** `backend/src/application/ai-assistant/catalog/AiToolCatalogSeed.ts`

All tools are defined in the catalog seed with metadata:
- **Tool name** — unique identifier
- **Module** — which domain (accounting, sales, purchases, analytics)
- **Metadata** — description, keywords, intent detection
- **Permissions** — required permission (e.g., `accounting.reports.balanceSheet.view`)
- **Groups** — logical grouping for AI intent detection

**Example (Balance Sheet):**
```typescript
{
  name: 'reports.balanceSheet',
  toolName: 'reports.balanceSheet',
  description: 'Run the authoritative Balance Sheet report...',
  moduleId: 'accounting',
  keywords: ['balance sheet', 'assets', 'liabilities', 'equity'],
  requiredPermissions: ['accounting.reports.balanceSheet.view'],
  group: 'Authoritative Reports - Accounting',
  implemented: true,
  supportsChatInvocation: true,
  isBlocked: false,
  operationType: 'READ',
}
```

---

## Permission Gating

Each tool declares its required permission. The orchestrator checks at runtime:

```typescript
const requiredPermission = def.requiredPermissions[0];
const hasPermission = !requiredPermission || permissions.some(perm => {
  if (perm === '*') return true;
  if (perm === requiredPermission) return true;
  if (requiredPermission.startsWith(perm + '.')) return true;
  return false;
});
if (!hasPermission) continue; // Tool not included in context
```

**Standard tool permissions** (example):
- `accounting.reports.trialBalance.view`
- `accounting.reports.balanceSheet.view`
- `accounting.reports.profitAndLoss.view`

Same permissions apply to both standard and authoritative versions of the same report.

---

## Configuration

### Per-Company Settings

**Entity:** `AiProviderConfig` (field: `aiReportMode`)

```typescript
public aiReportMode: AiReportMode = 'standard'; // Default: standard
```

**How to set:**
```typescript
const config = await settingsRepository.getConfig(companyId);
config.aiReportMode = 'authoritative'; // Switch to full reports
await settingsRepository.save(config);
```

### Super Admin Controls

Currently, report mode is set per company via settings API. Future: add Super Admin bulk mode assignment or default-by-tenant-tier logic.

---

## Data Flow Example

### Standard Mode (accounting.getBalanceSheet)

1. **User request:** "What's our balance sheet?"
2. **AI intent detection** → matches keywords → includes `accounting.getBalanceSheet` in context
3. **Tool call:** AI calls `accounting.getBalanceSheet` with optional `asOfDate`
4. **Backend execution:**
   - `GetBalanceSheetTool.execute(context, params)`
   - Calls `GetBalanceSheetUseCase.execute(companyId, userId, asOfDate)`
   - Sanitizes to top 10 accounts per section
   - Returns flat DTO with `totalAssets`, `totalLiabilities`, etc.
5. **Frontend rendering:**
   - Tool name matches `'accounting.getBalanceSheet'` condition
   - `BalanceSheetView` receives flat data, renders stats + truncation note
6. **User sees:** 4 KPI cards (Total Assets, Liabilities, Equity, Difference) + "Showing top 10 accounts"

### Authoritative Mode (reports.balanceSheet)

1. **User request:** "What's our balance sheet?"
2. **AI intent detection** → same keywords → but context only includes `reports.balanceSheet` (standard tools filtered out)
3. **Tool call:** AI calls `reports.balanceSheet` with optional `asOfDate`
4. **Backend execution:**
   - Factory-created tool class calls `ReportRunner.run(definition, companyId, userId, params)`
   - ReportRunner delegates to `GetBalanceSheetUseCase.execute()` (same logic as standard mode)
   - Wraps result in `{ reportContext, moneyContext, data }`
   - Returns complete data with all accounts (no truncation to 10)
5. **Frontend rendering:**
   - Tool name matches `'reports.balanceSheet'` condition
   - Data is unwrapped via `unwrapReportData()`
   - `BalanceSheetView` receives unwrapped data, renders stats + account breakdowns
6. **User sees:** Same 4 KPI cards + breakdown tables of all assets, liabilities, equity

---

## Testing

**Comprehensive smoke test:** `backend/src/tests/application/ai-assistant/AiToolCatalogSmoke.test.ts`
- Verifies all 17+ tools instantiate correctly
- Tests metadata, permissions, execution
- Confirms both standard and authoritative tools are registered

**Integration test:** `backend/src/tests/application/ai-assistant/AiAssistantAccountingToolsAndAnalytics.test.ts`
- Tests standard tool execution with real data scenarios
- Verifies sanitization (top 10 accounts)

---

## Design Rationale

### Why Two Sets of Tools?

**Standard mode:**
- Faster (smaller dataset)
- Cheaper to run (fewer records to process)
- Good for exploratory questions ("What's our top revenue source?")
- Privacy-friendly (doesn't expose all accounts)

**Authoritative mode:**
- Complete accuracy (all accounts included)
- Matches ERP UI reports exactly
- Required for audit/compliance queries
- Slower but more comprehensive

### Why Dual-Render in Frontend?

The same business logic (Balance Sheet use case) is called by both tools. Rather than duplicate code, the frontend:
- Recognizes both tool names
- Unwraps the data if needed
- Uses the same view component

This keeps the codebase DRY — changes to the view automatically work for both modes.

### Why Report Mode as Config, Not User Choice?

Tenant admins select the mode once in settings, not per-query. This:
- Simplifies intent detection (no ambiguity)
- Ensures consistent UX across all queries
- Prevents AI from accidentally picking the wrong tool
- Makes permission enforcement clearer

---

## Checklist for Adding a New Report Tool

1. **Create the standard tool class** (e.g., `GetNewReportTool.ts`)
   - Implement `AiTool` interface
   - Call existing use case
   - Sanitize to top N items
   - Return flat DTO

2. **Create the authoritative tool** via factory
   - Add definition to `ACCOUNTING_REPORT_DEFINITIONS`
   - Export wrapper from `reports/index.ts`
   - Add to `AUTHORITATIVE_REPORT_TOOL_NAMES`

3. **Register both tools**
   - Add to `aiToolRegistry` in `bindRepositories.ts`

4. **Add catalog entries**
   - Add to `AiToolCatalogSeed.ts` (both tool names)
   - Set `implemented: true`, `supportsChatInvocation: true`

5. **Add frontend renderer**
   - Add condition in `AiToolResultsPanel.tsx`
   - Create view component if needed

6. **Test**
   - Add to smoke test fixtures
   - Verify permission gating

---

## Future Improvements

- [ ] UI to switch report modes per company (currently API-only)
- [ ] Per-user report mode override (allow power users to request authoritative mode)
- [ ] Caching layer for authoritative reports (they're slow)
- [ ] Cost tracking (standard vs. authoritative)
- [ ] Audit log of which mode was used for each query
