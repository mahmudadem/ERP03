# AI Assistant Runtime v2 Architecture

Date: 2026-05-07

## Purpose

AI Assistant Runtime v2 makes model-requested tool use safe and provider-agnostic. The model is treated as untrusted. It can request structured tool calls, but ERP-owned backend services decide whether a request is allowed.

## Runtime Flow

1. User sends a chat message.
2. Backend loads company AI settings and model/provider capability profile.
3. Backend prepares safe tool contracts from registered ERP tool definitions.
4. Provider may return structured tool-call requests.
5. `AiRuntimeGuard` validates each request:
   - registered tool only,
   - allowed mode only,
   - no model-supplied tenant/user identity,
   - permission/RBAC still required,
   - tenant context comes from server context,
   - write/proposal/draft execution blocked.
6. Approved read-only tools can execute through the existing tool registry/orchestrator.
7. Tool results are returned to the model for final response generation where supported.
8. Frontend displays runtime metadata, warnings, tool status, and proposal cards.

## Key Files

### Domain / Contracts
- `backend/src/domain/ai-assistant/tools/AiToolContract.ts`
- `backend/src/domain/ai-assistant/entities/AiToolDefinition.ts`

### Providers
- `backend/src/application/ai-assistant/providers/IAiProvider.ts`
- `backend/src/application/ai-assistant/providers/OpenAICompatibleProvider.ts`
- `backend/src/application/ai-assistant/providers/MockProvider.ts`

### Runtime Services
- `backend/src/application/ai-assistant/services/AiRuntimeGuard.ts`
- `backend/src/application/ai-assistant/services/AiAuditService.ts`
- `backend/src/application/ai-assistant/services/AiModelCapabilityCatalog.ts`
- `backend/src/application/ai-assistant/services/AiToolCallingOrchestrator.ts`

### Use Case / DI
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`

### Frontend
- `frontend/src/api/aiAssistantApi.ts`
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiProposalListPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiProposalDetailPage.tsx`
- `frontend/src/modules/super-admin/pages/AiProposalPolicyPage.tsx`

## Safety Boundaries

- Never instantiate repositories directly from controllers or runtime services.
- Never trust model-supplied `companyId`, `userId`, permission, role, or module claims.
- Never execute write tools from model output.
- Keep Firestore-specific code in infrastructure repositories only.
- Keep Proposal Sandbox separate from execution; proposals are reviewable suggestions only.
- Keep Super Admin policy management separate from tenant chat/proposal flows.

## Provider Compatibility

- Structured tool-capable providers can receive ERP-owned tool contracts.
- Text-only providers use deterministic fallback where possible.
- Unknown/custom models are allowed only with warnings and conservative capability assumptions.

## Verification

- Frontend typecheck passed.
- Backend typecheck passed.
- Targeted AI runtime/proposal tests passed: 4 suites, 103 tests.
