/**
 * ai-assistant.routes.ts
 *
 * AI Assistant module routes.
 * All routes require authentication, company context, and module availability.
 * The module guard (companyModuleGuard) is applied at the tenant router level when mounting.
 *
 * NOTE: This module does NOT use moduleInitializedGuard because it has no setup wizard.
 * The AI Assistant works immediately upon install — the mock provider is available by default,
 * and no initialization flow is required. The module is usable as soon as it is enabled.
 */

import { Router } from 'express';
import { AiAssistantController } from '../controllers/ai-assistant/AiAssistantController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';
import { permissionGuard } from '../middlewares/guards/permissionGuard';

const router = Router();

// Apply auth and company context middlewares
router.use(authMiddleware);
router.use(companyContextMiddleware);

// Settings — view and manage AI provider configuration
router.get('/settings', permissionGuard('ai-assistant.settings.view'), AiAssistantController.getSettings);
router.put('/settings', permissionGuard('ai-assistant.settings.manage'), AiAssistantController.updateSettings);

// Settings — test provider connectivity (consumes real tokens for external providers)
router.post('/settings/health', permissionGuard('ai-assistant.settings.manage'), AiAssistantController.checkProviderHealth);
router.get('/settings/usage', permissionGuard('ai-assistant.settings.view'), AiAssistantController.getUsageAnalytics);
router.post('/settings/custom-model-profiles', permissionGuard('ai-assistant.settings.manage'), AiAssistantController.createTenantCustomModelProfile);
router.post('/settings/custom-model-profiles/:profileId/diagnostics', permissionGuard('ai-assistant.settings.manage'), AiAssistantController.runTenantCustomModelDiagnostics);
router.post('/settings/custom-model-profiles/:profileId/certifications/run', permissionGuard('ai-assistant.settings.manage'), AiAssistantController.runTenantCustomModelCertification);
router.get('/certified-profiles', permissionGuard('ai-assistant.settings.view'), AiAssistantController.listTenantCertifiedProfiles);

// Tools — execute read-only AI tools (permission-gated per tool)
router.post('/tools/execute', permissionGuard('ai-assistant.chat.use'), AiAssistantController.executeTool);

// Chat endpoints — no moduleInitializedGuard needed (no setup wizard)
router.post('/chat', permissionGuard('ai-assistant.chat.use'), AiAssistantController.sendMessage);
router.get('/conversations', permissionGuard('ai-assistant.chat.use'), AiAssistantController.getRecentConversations);
router.get('/conversations/:conversationId/messages', permissionGuard('ai-assistant.chat.use'), AiAssistantController.getConversationMessages);
router.delete('/conversations/:conversationId', permissionGuard('ai-assistant.chat.use'), AiAssistantController.deleteConversation);

// Proposal Sandbox endpoints — reviewable AI proposals, no real ERP data changes
router.get('/proposals', permissionGuard('ai-assistant.proposals.view'), AiAssistantController.listProposals);
router.get('/proposals/:proposalId', permissionGuard('ai-assistant.proposals.view'), AiAssistantController.getProposal);
router.post('/proposals', permissionGuard('ai-assistant.proposals.create'), AiAssistantController.createProposal);
router.patch('/proposals/:proposalId/status', permissionGuard('ai-assistant.proposals.review'), AiAssistantController.updateProposalStatus);
router.patch('/proposals/:proposalId/archive', permissionGuard('ai-assistant.proposals.archive'), AiAssistantController.archiveProposal);

export default router;
