# AI Assistant State Document

> Last updated: 2026-05-06
> Status: Full Tool System — 17 real tools, 100+ catalog definitions, Super Admin management

---

## Architecture Overview

### AI Tool System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER MESSAGE                                   │
│                           │                                           │
│                    ┌──────▼──────┐                                    │
│                    │ AiToolCalling│  Deterministic keyword matching   │
│                    │ Orchestrator │  (EN/AR/TR) → tool-intents.config │
│                    └──────┬──────┘                                    │
│                           │                                           │
│              ┌────────────┼────────────┐                            │
│              ▼            ▼            ▼                               │
│     AiToolRegistry.executeTool()  ×N  (max 2 per message)            │
│              │            │            │                               │
│     ┌────────▼────────┐  │            │                              │
│     │ Permission Check │  │            │                              │
│     │ Company Scope    │  │            │                              │
│     │ Rate Limit Check │  │            │                              │
│     └────────┬────────┘  │            │                              │
│              │            │            │                               │
│    ┌─────────▼────────────▼────────────▼──────┐                      │
│    │           TOOL IMPLEMENTATIONS            │                      │
│    │  (17 real tools, each wrapping a use case)│                      │
│    └─────────┬────────────────────────────────┘                      │
│              │                                                       │
│     ┌────────▼────────┐                                              │
│     │  Sanitized DTO   │  (top N items, no raw entities)             │
│     └────────┬────────┘                                              │
│              │                                                       │
│     ┌────────▼────────┐                                              │
│     │ AI System Prompt │  "Use ONLY this data. Do NOT invent."      │
│     └─────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Tool Catalog Architecture

```
┌─────────────────────────────────────────────────────┐
│              AiToolCatalogSeed.ts                    │
│  (Static definitions: 100+ tools across 13 cats)    │
│                                                      │
│  Status: active | disabled | unavailable | deprecated│
│  Mode:   read-only | proposal | write               │
│  Risk:   low | medium | high | blocked              │
│                                                      │
│  WRITE TOOLS CAN NEVER BE ENABLED                    │
└──────────┬──────────────┬──────────────────────────┘
           │              │
           ▼              ▼
┌──────────────────┐  ┌───────────────────┐
│  AiToolRegistry   │  │ AiToolCatalogUse │
│  (runtime exec)   │  │ Case (management) │
└──────────────────┘  └───────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   ┌───────────────┐  ┌────────────────┐  ┌─────────────────┐
   │ Firestore:      │  │ Firestore:      │  │ Firestore:       │
   │ ai_tools/       │  │ ai_tool_policies │  │ ai_model_policies│
   └───────────────┘  └────────────────┘  └─────────────────┘
```

---

## Implemented Tools (17 Real + 85+ Definitions)

### Active Read-Only Tools (17 with Real Execution)

| # | Tool Name | Permission | Source |
|---|-----------|-----------|--------|
| 1 | `accounting.getTrialBalanceSummary` | `accounting.reports.trialBalance.view` | GetTrialBalanceUseCase |
| 2 | `accounting.getProfitAndLoss` | `accounting.reports.profitAndLoss.view` | GetProfitAndLossUseCase |
| 3 | `accounting.getBalanceSheet` | `accounting.reports.balanceSheet.view` | GetBalanceSheetUseCase |
| 4 | `accounting.getCashFlowSummary` | `accounting.reports.cashFlow.view` | GetCashFlowStatementUseCase |
| 5 | `accounting.getAgingReceivables` | `accounting.reports.generalLedger.view` | AgingReportUseCase |
| 6 | `accounting.getAgingPayables` | `accounting.reports.generalLedger.view` | AgingReportUseCase |
| 7 | `accounting.getGeneralLedgerSummary` | `accounting.reports.generalLedger.view` | GetGeneralLedgerUseCase |
| 8 | `accounting.getAccountStatementSummary` | `accounting.reports.generalLedger.view` | GetAccountStatementUseCase |
| 9 | `accounting.getChartOfAccountsSummary` | `accounting.accounts.view` | IAccountRepository |
| 10 | `accounting.getAccountBalance` | `accounting.reports.generalLedger.view` | GetTrialBalanceUseCase |
| 11 | `accounting.getAccountingPeriodStatus` | `accounting.reports.view` | IFiscalYearRepository |
| 12 | `sales.getSalesSummary` | `sales.invoices.view` | ISalesInvoiceRepository |
| 13 | `sales.getTopCustomers` | `sales.invoices.view` | ISalesInvoiceRepository + IPartyRepository |
| 14 | `purchase.getPurchaseSummary` | `purchases.invoices.view` | IPurchaseInvoiceRepository |
| 15 | `purchase.getTopSuppliers` | `purchases.invoices.view` | IPurchaseInvoiceRepository + IPartyRepository |
| 16 | `reports.getFinancialOverview` | `accounting.reports.view` | P&L + BS + Cash + Aging combined |
| 17 | `reports.getMonthlyPerformanceSummary` | `accounting.reports.profitAndLoss.view` | P&L per month |

### Catalog Definitions (100+ entries, not all executable)

| Category | Active | Disabled | Unavailable | Blocked |
|----------|--------|----------|-------------|---------|
| Accounting — Accounts | 6 | 2 | — | — |
| Accounting — Vouchers | 5 | 7 | — | — |
| Accounting — Reports | 7 | — | — | — |
| Accounting — Period/Validation | 1 | 7 | — | — |
| Accounting — Proposals | — | 6 | — | — |
| Inventory | 4 | 6 | 4 | — |
| Sales | 4 | 6 | — | — |
| Purchases | 4 | 5 | — | — |
| CRM | — | — | 6 | — |
| HR | — | — | 3 | — |
| Reports/BI | 4 | 1 | — | — |
| Audit | — | 3 | — | — |
| Platform | 2 | — | — | — |
| **BLOCKED (write patterns)** | — | — | — | 7 |

---

## Super Admin Management

### Backend Endpoints (Platform-level)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/platform/ai-tools` | List all tools (with filters) |
| GET | `/platform/ai-tools/:toolName` | Get single tool |
| PATCH | `/platform/ai-tools/:toolName` | Update tool status |
| PATCH | `/platform/ai-tools/:toolName/enable` | Enable tool globally |
| PATCH | `/platform/ai-tools/:toolName/disable` | Disable tool globally |
| POST | `/platform/ai-tools/sync` | Sync static catalog seed to DB |
| GET | `/platform/ai-tool-policies` | List enablement policies |
| PATCH | `/platform/ai-tool-policies/:toolId` | Update enablement policy |
| GET | `/platform/ai-model-tool-policies` | List model policies |
| PATCH | `/platform/ai-model-tool-policies/:policyId` | Update model policy |

### Frontend Pages

| Path | Purpose |
|------|---------|
| `/super-admin/ai-tools` | Tool catalog with filters, enable/disable, status badges |
| `/super-admin/ai-tools/:toolName` | Tool detail page with schemas, policies, enablement |

### Safety Rules

1. **WRITE TOOLS CAN NEVER BE ENABLED** — enforced at AiToolCatalogUseCase level
2. **Mode, permissions, riskLevel are IMMUTABLE from seed** — DB overrides only affect `status` and `enabledByDefault`
3. **DENY takes precedence over ALLOW** at every enablement level
4. **`allowWriteTools` is ALWAYS false** — even if overridden, AiModelToolPolicy forces it
5. **`requireExplicitUserIntent` = true** and `requireDeterministicMapping = true`** — no free-form AI function calling

---

## Intent Detection (30+ Intents, EN/AR/TR)

Intents are defined in `tool-intents.config.ts` and support:

- **Accounting**: trial balance, P&L, balance sheet, cash flow, aging AR/AP, GL, account statement, COA, account balance, period status
- **Inventory**: stock balance, low stock, out of stock, inventory valuation, search items
- **Sales**: sales summary, top customers, unpaid invoices, overdue invoices
- **Purchases**: purchase summary, top suppliers, unpaid invoices
- **Reports**: financial overview, monthly comparison, cash position, receivables/payables overview, period comparison

---

## File Map

### Domain Entities (3 new)
- `backend/src/domain/ai-assistant/entities/AiToolDefinition.ts`
- `backend/src/domain/ai-assistant/entities/AiToolEnablementPolicy.ts`
- `backend/src/domain/ai-assistant/entities/AiModelToolPolicy.ts`
- `backend/src/domain/ai-assistant/entities/index.ts`

### Repository Interfaces (3 new)
- `backend/src/repository/interfaces/ai-assistant/IAiToolCatalogRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiToolEnablementRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiModelToolPolicyRepository.ts`

### Firestore Implementations (3 new)
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiToolCatalogRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiToolEnablementRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiModelToolPolicyRepository.ts`

### Use Cases (1 new)
- `backend/src/application/ai-assistant/use-cases/AiToolCatalogUseCase.ts`

### Catalog & Config (2 new)
- `backend/src/application/ai-assistant/catalog/AiToolCatalogSeed.ts`
- `backend/src/application/ai-assistant/config/tool-intents.config.ts`

### Tool Implementations (14 new)
- `backend/src/application/ai-assistant/tools/GetCashFlowTool.ts`
- `backend/src/application/ai-assistant/tools/GetAgingReceivablesTool.ts`
- `backend/src/application/i-assistant/tools/GetAgingPayablesTool.ts`
- `backend/src/application/ai-assistant/tools/GetGeneralLedgerSummaryTool.ts`
- `backend/src/application/ai-assistant/tools/GetAccountStatementSummaryTool.ts`
- `backend/src/application/ai-assistant/tools/GetChartOfAccountsSummaryTool.ts`
- `backend/src/application/ai-assistant/tools/GetAccountBalanceTool.ts`
- `backend/src/application/ai-assistant/tools/GetFiscalYearStatusTool.ts`
- `backend/src/application/ai-assistant/tools/GetSalesSummaryTool.ts`
- `backend/src/application/ai-assistant/tools/GetTopCustomersTool.ts`
- `backend/src/application/ai-assistant/tools/GetPurchaseSummaryTool.ts`
- `backend/src/application/ai-assistant/tools/GetTopSuppliersTool.ts`
- `backend/src/application/ai-assistant/tools/GetFinancialOverviewTool.ts`
- `backend/src/application/ai-assistant/tools/GetMonthlyComparisonTool.ts`

### Controller (1 new)
- `backend/src/api/controllers/ai-assistant/AiToolCatalogController.ts`

### Routes (1 new)
- `backend/src/api/routes/ai-tool-catalog.routes.ts`

### Frontend (2 new pages)
- `frontend/src/modules/super-admin/pages/AiToolCatalogPage.tsx`
- `frontend/src/modules/super-admin/pages/AiToolDetailPage.tsx`

### Tests (3 new)
- `backend/src/tests/domain/ai-assistant/AiToolCatalog.test.ts` (24 tests)
- `backend/src/tests/application/ai-assistant/AiToolCatalogUseCase.test.ts` (21 tests)
- `backend/src/tests/application/ai-assistant/AiToolCatalogSmoke.test.ts` (148 tests)

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| AiToolCalling | 15 | ✅ |
| AiAssistantAccountingToolsAndAnalytics | 8 | ✅ |
| AiAssistantNewFeatures | 20 | ✅ |
| AiSettingsUseCase | 16 | ✅ |
| AiRateLimiterService | 6 | ✅ |
| OpenAICompatibleProvider | 29 | ✅ |
| SendChatMessageUseCase | 4+ | ✅ |
| **AiToolCatalog (domain)** | **24** | ✅ |
| **AiToolCatalogUseCase** | **21** | ✅ |
| **AiToolCatalogSmoke** | **148** | ✅ |
| **Total** | **327** | ✅ |