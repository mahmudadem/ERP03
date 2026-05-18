# AI Proposal Sandbox

## Overview

The AI Proposal Sandbox is a safe, reviewable proposal system that allows the AI Assistant to create draft suggestions without mutating real ERP business data. This is NOT execution, NOT posting, NOT approval, and NOT creating real vouchers/invoices/items.

## Safety Model

### Absolute Safety Rules

1. **No real business mutations** — Proposals never create real ERP records
2. **No voucher creation** in real accounting tables
3. **No posting** — No proposal triggers posting of any kind
4. **No approval** — Accepting a proposal only marks it as reviewed
5. **No delete/update** of ERP records
6. **No direct DB access** from AI — All data flows through use cases
7. **No raw DB documents** in proposedData — Only sanitized DTOs
8. **No API key exposure** — Keys never appear in proposals
9. **AI proposals clearly marked** as AI-generated and unapproved
10. **allowBusinessExecution is ALWAYS false** — Enforced at entity level, cannot be overridden

### Proposal Acceptance

When a user "accepts" a proposal:
- The proposal status changes to `accepted`
- The `reviewedBy` and `reviewedAt` fields are set
- **NO real ERP record is created**
- **NO voucher is posted**
- **NO business action is executed**

Accepting is purely a review acknowledgment — "I've seen this and agree with the suggestion."

## Architecture

### Domain Entities

| Entity | Purpose |
|--------|---------|
| `AiProposal` | A single AI-generated proposal with status lifecycle |
| `AiProposalPolicy` | Controls which proposal types are enabled, limits, and safety settings |

### Proposal Types

| Type | Module | Description |
|------|--------|-------------|
| `accounting.voucherDraft` | accounting | Draft voucher structure |
| `accounting.journalEntryProposal` | accounting | Proposed debit/credit lines |
| `accounting.correctionEntryProposal` | accounting | Suggested correction approach |
| `accounting.accountMappingProposal` | accounting | Suggested account code/name |
| `inventory.reorderProposal` | inventory | Suggested reorder quantities |
| `sales.collectionFollowUpProposal` | sales | Suggested follow-up for overdue receivables |
| `reports.managementInsightProposal` | reports | AI-generated management insights |

### Status Lifecycle

```
draft → pending_review → accepted → archived
                   ↘ rejected → archived
                   ↗ pending_review (re-submit)
```

### Proposal Generators

Each proposal type has a registered generator that produces deterministic `proposedData`:

- `JournalEntryProposalGenerator` — Produces debit/credit line structure
- `CorrectionEntryProposalGenerator` — Produces correction approach and lines
- `AccountMappingProposalGenerator` — Produces suggested account mapping
- `VoucherDraftProposalGenerator` — Produces voucher draft structure
- `ReorderProposalGenerator` — Produces reorder suggestions from low-stock data
- `CollectionFollowUpProposalGenerator` — Produces follow-up actions for overdue invoices
- `ManagementInsightProposalGenerator` — Produces management insights from financial data

All generators use **deterministic templates + AI explanation** — the AI does not create arbitrary JSON freely.

### Policy System

- **Global default policy** — Super Admin controls for the entire platform
- **Per-company override** — Company-specific policy that merges with global
- **DENY takes precedence** — If a type is in `disabledProposalTypes`, it's always blocked
- **`allowBusinessExecution` is ALWAYS false** — Cannot be overridden at any level

## API Endpoints

### Tenant Endpoints (company-scoped)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/ai-assistant/proposals` | `ai-assistant.proposals.view` | List proposals with filters |
| GET | `/ai-assistant/proposals/:proposalId` | `ai-assistant.proposals.view` | Get single proposal |
| POST | `/ai-assistant/proposals` | `ai-assistant.proposals.create` | Create a proposal |
| PATCH | `/ai-assistant/proposals/:proposalId/status` | `ai-assistant.proposals.review` | Update status (accept/reject) |
| PATCH | `/ai-assistant/proposals/:proposalId/archive` | `ai-assistant.proposals.archive` | Archive a proposal |

### Super Admin Endpoints (platform-level)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/platform/ai-proposal-policies` | Get global policy |
| PATCH | `/platform/ai-proposal-policies/:policyId` | Update policy |
| GET | `/platform/ai-proposals/summary` | Get usage summary |

## Frontend Pages

### Tenant Pages

- `/ai-assistant/proposals` — Proposal list with filters (type, status, module)
- `/ai-assistant/proposals/:proposalId` — Proposal detail with status controls
- Chat UI shows proposal cards with "AI Proposal · Sandbox · No ERP changes" badge
- Disabled "Execute (Not Available)" button placeholder

### Super Admin Pages

- `/super-admin/ai-proposal-policies` — Policy management with safety lock

## Permissions

| Permission | Description |
|------------|-------------|
| `ai-assistant.proposals.view` | View proposals |
| `ai-assistant.proposals.create` | Create proposals |
| `ai-assistant.proposals.review` | Accept/reject proposals |
| `ai-assistant.proposals.manage` | Full proposal management |
| `ai-assistant.proposals.archive` | Archive proposals |

## Chat Integration

When a user sends a message matching a proposal intent (e.g., "اقترح قيد", "suggest journal entry", "propose correction"):

1. The `AiProposalGeneratorRegistry.detectProposalIntent()` detects the proposal type
2. The appropriate generator produces `proposedData`, `warnings`, `missingInfo`
3. The `CreateAiProposalUseCase` persists the proposal (with policy checks)
4. The proposal data is injected into the AI context
5. The AI response includes: "I created a reviewable proposal in the AI Sandbox. No ERP data was changed."
6. The chat message metadata includes the proposal reference
7. The chat UI renders a proposal card with link to detail page

When a user asks to **create/post/delete/approve** real records (e.g., "create voucher", "post entry"), the request is **rejected as before** — no proposal is created.

## File Map

### Backend — New Files

**Domain:**
- `backend/src/domain/ai-assistant/entities/AiProposal.ts`
- `backend/src/domain/ai-assistant/entities/AiProposalPolicy.ts`

**Repository Interfaces:**
- `backend/src/repository/interfaces/ai-assistant/IAiProposalRepository.ts`
- `backend/src/repository/interfaces/ai-assistant/IAiProposalPolicyRepository.ts`

**Firestore Implementations:**
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiProposalRepository.ts`
- `backend/src/infrastructure/firestore/repositories/ai-assistant/FirestoreAiProposalPolicyRepository.ts`

**Use Cases:**
- `backend/src/application/ai-assistant/use-cases/CreateAiProposalUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/ListAiProposalsUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/GetAiProposalUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/UpdateAiProposalStatusUseCase.ts`
- `backend/src/application/ai-assistant/use-cases/ArchiveAiProposalUseCase.ts`

**Proposal Generators:**
- `backend/src/application/ai-assistant/proposals/AiProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/AiProposalGeneratorRegistry.ts`
- `backend/src/application/ai-assistant/proposals/JournalEntryProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/CorrectionEntryProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/AccountMappingProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/VoucherDraftProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/ReorderProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/CollectionFollowUpProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/ManagementInsightProposalGenerator.ts`
- `backend/src/application/ai-assistant/proposals/index.ts`

**API:**
- `backend/src/api/routes/ai-proposal-policies.routes.ts`

**Tests:**
- `backend/src/tests/application/ai-assistant/AiProposalSandbox.test.ts` (47 tests)

### Backend — Modified Files

- `backend/src/domain/ai-assistant/entities/index.ts` — Added exports
- `backend/src/repository/interfaces/ai-assistant/index.ts` — Added exports
- `backend/src/infrastructure/di/bindRepositories.ts` — Added proposal repos and use cases
- `backend/src/modules/ai-assistant/AiAssistantModule.ts` — Added 5 proposal permissions
- `backend/src/seeder/seedOnboardingData.ts` — Added 5 proposal permissions
- `backend/src/application/ai-assistant/use-cases/SendChatMessageUseCase.ts` — Proposal integration
- `backend/src/api/controllers/ai-assistant/AiAssistantController.ts` — Proposal endpoints + DI
- `backend/src/api/routes/ai-assistant.routes.ts` — Proposal routes
- `backend/src/api/server/platform.router.ts` — Proposal policy routes

### Frontend — New Files

- `frontend/src/modules/ai-assistant/pages/AiProposalListPage.tsx`
- `frontend/src/modules/ai-assistant/pages/AiProposalDetailPage.tsx`
- `frontend/src/modules/super-admin/pages/AiProposalPolicyPage.tsx`

### Frontend — Modified Files

- `frontend/src/api/aiAssistantApi.ts` — Proposal API types and methods
- `frontend/src/router/routes.config.ts` — Proposal routes
- `frontend/src/layout/SuperAdminShell.tsx` — Proposal policy nav item
- `frontend/src/hooks/useSidebarConfig.ts` — Proposal label mapping
- `frontend/src/modules/ai-assistant/pages/AiAssistantHomePage.tsx` — Proposal card in chat
- `frontend/src/locales/en/common.json` — Sidebar label
- `frontend/src/locales/ar/common.json` — Sidebar label
- `frontend/src/locales/tr/common.json` — Sidebar label
- `frontend/src/locales/en/aiAssistant.json` — Full proposal i18n
- `frontend/src/locales/ar/aiAssistant.json` — Full proposal i18n
- `frontend/src/locales/tr/aiAssistant.json` — Full proposal i18n

## Future Path

The proposal sandbox is designed to support future **human-approved execution**:

1. A user accepts a proposal
2. A future "Execute" button would create real ERP records based on the proposedData
3. Execution would go through existing ERP use cases (CreateVoucherUseCase, etc.)
4. This is **NOT implemented yet** — the "Execute" button is disabled and labeled "Execution is not available in this version."

This architecture ensures that when execution is added, it goes through the proper business logic layer with all existing validations, permissions, and audit trails.
