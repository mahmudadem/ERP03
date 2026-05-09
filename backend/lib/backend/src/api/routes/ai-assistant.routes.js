"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AiAssistantController_1 = require("../controllers/ai-assistant/AiAssistantController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const companyContextMiddleware_1 = require("../middlewares/companyContextMiddleware");
const permissionGuard_1 = require("../middlewares/guards/permissionGuard");
const router = (0, express_1.Router)();
// Apply auth and company context middlewares
router.use(authMiddleware_1.authMiddleware);
router.use(companyContextMiddleware_1.companyContextMiddleware);
// Settings — view and manage AI provider configuration
router.get('/settings', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.view'), AiAssistantController_1.AiAssistantController.getSettings);
router.put('/settings', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.manage'), AiAssistantController_1.AiAssistantController.updateSettings);
// Settings — test provider connectivity (consumes real tokens for external providers)
router.post('/settings/health', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.manage'), AiAssistantController_1.AiAssistantController.checkProviderHealth);
router.get('/settings/usage', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.view'), AiAssistantController_1.AiAssistantController.getUsageAnalytics);
router.post('/settings/custom-model-profiles', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.manage'), AiAssistantController_1.AiAssistantController.createTenantCustomModelProfile);
router.post('/settings/custom-model-profiles/:profileId/diagnostics', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.manage'), AiAssistantController_1.AiAssistantController.runTenantCustomModelDiagnostics);
router.post('/settings/custom-model-profiles/:profileId/certifications/run', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.manage'), AiAssistantController_1.AiAssistantController.runTenantCustomModelCertification);
router.get('/certified-profiles', (0, permissionGuard_1.permissionGuard)('ai-assistant.settings.view'), AiAssistantController_1.AiAssistantController.listTenantCertifiedProfiles);
// Tools — execute read-only AI tools (permission-gated per tool)
router.post('/tools/execute', (0, permissionGuard_1.permissionGuard)('ai-assistant.chat.use'), AiAssistantController_1.AiAssistantController.executeTool);
// Chat endpoints — no moduleInitializedGuard needed (no setup wizard)
router.post('/chat', (0, permissionGuard_1.permissionGuard)('ai-assistant.chat.use'), AiAssistantController_1.AiAssistantController.sendMessage);
router.get('/conversations', (0, permissionGuard_1.permissionGuard)('ai-assistant.chat.use'), AiAssistantController_1.AiAssistantController.getRecentConversations);
router.get('/conversations/:conversationId/messages', (0, permissionGuard_1.permissionGuard)('ai-assistant.chat.use'), AiAssistantController_1.AiAssistantController.getConversationMessages);
router.delete('/conversations/:conversationId', (0, permissionGuard_1.permissionGuard)('ai-assistant.chat.use'), AiAssistantController_1.AiAssistantController.deleteConversation);
// Proposal Sandbox endpoints — reviewable AI proposals, no real ERP data changes
router.get('/proposals', (0, permissionGuard_1.permissionGuard)('ai-assistant.proposals.view'), AiAssistantController_1.AiAssistantController.listProposals);
router.get('/proposals/:proposalId', (0, permissionGuard_1.permissionGuard)('ai-assistant.proposals.view'), AiAssistantController_1.AiAssistantController.getProposal);
router.post('/proposals', (0, permissionGuard_1.permissionGuard)('ai-assistant.proposals.create'), AiAssistantController_1.AiAssistantController.createProposal);
router.patch('/proposals/:proposalId/status', (0, permissionGuard_1.permissionGuard)('ai-assistant.proposals.review'), AiAssistantController_1.AiAssistantController.updateProposalStatus);
router.patch('/proposals/:proposalId/archive', (0, permissionGuard_1.permissionGuard)('ai-assistant.proposals.archive'), AiAssistantController_1.AiAssistantController.archiveProposal);
exports.default = router;
//# sourceMappingURL=ai-assistant.routes.js.map