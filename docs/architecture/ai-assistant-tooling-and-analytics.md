# AI Assistant Tooling + Analytics (2026-05-06)

## Summary
This update extends the AI Assistant with:

1. Two new read-only accounting tools:
   - `accounting.getProfitAndLoss`
   - `accounting.getBalanceSheet`
2. Structured tool-result rendering support in chat (via message metadata)
3. Usage analytics endpoint and frontend dashboard tab

## Backend Changes

### Tools
- `backend/src/application/ai-assistant/tools/GetProfitAndLossTool.ts`
- `backend/src/application/ai-assistant/tools/GetBalanceSheetTool.ts`

Both tools:
- Implement `AiTool`
- Are permission-gated (`accounting.reports.profitAndLoss.view`, `accounting.reports.balanceSheet.view`)
- Use existing use cases (no duplicated report logic)
- Return sanitized summary DTOs only

### Intent Detection
- Updated `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
- Added EN/AR/TR keyword mappings for P&L and Balance Sheet

### DI Registration
- Updated `backend/src/infrastructure/di/bindRepositories.ts`
- Registered both new tools in `aiToolRegistry`

### Chat Metadata Pipeline
- Updated `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- Assistant messages now include `metadata.toolResults` so frontend can render structured data
- Updated DTO mapper: `backend/src/api/dtos/AiAssistantDTOs.ts`

### Usage Analytics API
- Added use case: `backend/src/application/ai-assistant/use-cases/GetUsageAnalyticsUseCase.ts`
- Added controller route:
  - `GET /tenant/ai-assistant/settings/usage`
  - files: `AiAssistantController.ts`, `ai-assistant.routes.ts`

## Frontend Changes

### Structured Tool Data in Chat
- Added `frontend/src/modules/ai-assistant/components/AiToolResultsPanel.tsx`
- Integrated into `AiAssistantHomePage.tsx`
- Renders specialized summary cards/tables for:
  - Trial Balance
  - Profit & Loss
  - Balance Sheet

### Usage Analytics Dashboard
- Extended API client: `frontend/src/api/aiAssistantApi.ts`
  - `getUsageAnalytics(limit)`
- Added analytics tab in `AiAssistantSettingsPage.tsx`
  - KPI cards (requests, success/failure, latency, tokens)
  - recent requests table

### i18n
- Updated locale files:
  - `frontend/src/locales/en/aiAssistant.json`
  - `frontend/src/locales/ar/aiAssistant.json`
  - `frontend/src/locales/tr/aiAssistant.json`

## Verification
- Backend compile: `npx tsc --noEmit` ✅
- Frontend compile: `npx tsc --noEmit` ✅
- Test: `npm run test -- --runInBand src/tests/application/ai-assistant/AiToolCalling.test.ts` ✅
