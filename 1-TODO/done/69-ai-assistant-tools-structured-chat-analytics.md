# 69 — AI Assistant Tools + Structured Chat + Analytics

Date: 2026-05-06

## Technical Developer View

### Scope Completed
1. Added two read-only AI tools:
   - `accounting.getProfitAndLoss`
   - `accounting.getBalanceSheet`
2. Added deterministic intent detection keywords (EN/AR/TR) for both tools
3. Extended chat metadata pipeline so assistant messages carry `toolResults`
4. Added structured tool-result rendering in frontend chat
5. Added usage analytics backend endpoint + frontend analytics tab

### Backend Files
- `backend/src/application/ai-assistant/tools/GetProfitAndLossTool.ts` (new)
- `backend/src/application/ai-assistant/tools/GetBalanceSheetTool.ts` (new)
- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/api/dtos/AiAssistantDTOs.ts`
- `backend/src/application/ai-assistant/use-cases/GetUsageAnalyticsUseCase.ts` (new)
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts`
- `backend/src/api/routes/ai-assistant.routes.ts`

### Frontend Files
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/components/AiToolResultsPanel.tsx` (new)
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiAssistantSettingsPage.tsx`
- `frontend/src/locales/en/aiAssistant.json`
- `frontend/src/locales/ar/aiAssistant.json`
- `frontend/src/locales/tr/aiAssistant.json`

### Documentation
- `docs/architecture/ai-assistant-tooling-and-analytics.md` (new)
- `docs/user-guide/ai-assistant-tool-data-and-analytics.md` (new)

### Verification
- `backend`: `npx tsc --noEmit` ✅
- `frontend`: `npx tsc --noEmit` ✅
- `backend`: `npm run test -- --runInBand src/tests/application/ai-assistant/AiToolCalling.test.ts` ✅ (15/15)

### Risks / Follow-ups
- Add dedicated tests for new P&L and Balance Sheet tool classes
- Add date-range filters to usage analytics endpoint/dashboard
- Add chart visualizations for tool cards

## End-User View

### What You Can Do Now
- Ask the AI assistant for:
  - Trial Balance summary
  - Profit & Loss summary
  - Balance Sheet summary
- See both explanation text and structured summary cards/tables in chat.

### New Admin Capability
- In **AI Assistant → Settings → Analytics**, admins can now monitor:
  - today’s usage
  - success/failure counts
  - token usage
  - request latency
  - recent request activity

### Important Note
The AI assistant is still advisory-only and cannot post, edit, or delete accounting records.
