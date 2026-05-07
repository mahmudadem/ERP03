"use strict";
/**
 * AiAssistantController - Thin Express request handlers for AI Assistant
 *
 * Delegates all business logic to use cases.
 * Follows the existing controller pattern: validate → extract → delegate → respond.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAssistantController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const SendChatMessageUseCase_1 = require("../../../application/ai-assistant/use-cases/SendChatMessageUseCase");
const AiSettingsUseCase_1 = require("../../../application/ai-assistant/use-cases/AiSettingsUseCase");
const GetUsageAnalyticsUseCase_1 = require("../../../application/ai-assistant/use-cases/GetUsageAnalyticsUseCase");
const CheckProviderHealthUseCase_1 = require("../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase");
const ExecuteAiToolUseCase_1 = require("../../../application/ai-assistant/use-cases/ExecuteAiToolUseCase");
const ai_assistant_validators_1 = require("../../validators/ai-assistant.validators");
const AiAssistantDTOs_1 = require("../../dtos/AiAssistantDTOs");
const ApiError_1 = require("../../../api/errors/ApiError");
class AiAssistantController {
    static getCompanyId(req) {
        var _a;
        const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
        if (!companyId) {
            throw new Error('Company ID is required');
        }
        return companyId;
    }
    static getUserId(req) {
        var _a;
        const userId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            throw new Error('User ID is required');
        }
        return userId;
    }
    /**
     * POST /ai-assistant/chat
     * Send a message to the AI assistant and receive a response.
     */
    static async sendMessage(req, res, next) {
        try {
            (0, ai_assistant_validators_1.validateSendChatMessageInput)(req.body);
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const { message, conversationId } = req.body;
            const useCase = new SendChatMessageUseCase_1.SendChatMessageUseCase(bindRepositories_1.diContainer.aiChatRepository, bindRepositories_1.diContainer.aiSettingsRepository, bindRepositories_1.diContainer.encryptionService, bindRepositories_1.diContainer.httpClient, bindRepositories_1.diContainer.aiUsageLogRepository, bindRepositories_1.diContainer.aiToolCallingOrchestrator, bindRepositories_1.diContainer.aiProposalGeneratorRegistry, bindRepositories_1.diContainer.createAiProposalUseCase, bindRepositories_1.diContainer.aiRuntimeGuard, bindRepositories_1.diContainer.aiAuditService, bindRepositories_1.diContainer.aiSkillRegistry);
            const result = await useCase.execute({
                companyId,
                userId,
                message,
                conversationId,
            });
            res.status(200).json({
                success: true,
                data: Object.assign({ userMessage: AiAssistantDTOs_1.AiAssistantDTOMapper.toChatMessageResponse(result.userMessage), assistantMessage: AiAssistantDTOs_1.AiAssistantDTOMapper.toChatMessageResponse(result.assistantMessage), provider: result.provider, model: result.model }, (result.runtimeMeta ? { runtimeMeta: result.runtimeMeta } : {})),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /ai-assistant/conversations/:conversationId/messages
     * Get messages for a specific conversation.
     */
    static async getConversationMessages(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const { conversationId } = req.params;
            const limit = parseInt(req.query.limit) || 50;
            const messages = await bindRepositories_1.diContainer.aiChatRepository.getConversationMessages(companyId, userId, conversationId, limit);
            res.status(200).json({
                success: true,
                data: {
                    messages: messages.map(AiAssistantDTOs_1.AiAssistantDTOMapper.toChatMessageResponse),
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /ai-assistant/conversations
     * Get recent conversations for the current user.
     */
    static async getRecentConversations(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const limit = parseInt(req.query.limit) || 10;
            const messages = await bindRepositories_1.diContainer.aiChatRepository.getRecentConversations(companyId, userId, limit);
            res.status(200).json({
                success: true,
                data: {
                    conversations: messages.map(msg => ({
                        conversationId: msg.conversationId,
                        lastMessage: AiAssistantDTOs_1.AiAssistantDTOMapper.toChatMessageResponse(msg),
                    })),
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /ai-assistant/conversations/:conversationId
     * Delete all messages in a conversation.
     */
    static async deleteConversation(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const { conversationId } = req.params;
            await bindRepositories_1.diContainer.aiChatRepository.deleteConversation(companyId, userId, conversationId);
            res.status(200).json({
                success: true,
                data: { deleted: true },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /ai-assistant/settings
     * Get AI provider configuration for the current company.
     */
    static async getSettings(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const useCase = new AiSettingsUseCase_1.AiSettingsUseCase(bindRepositories_1.diContainer.aiSettingsRepository, bindRepositories_1.diContainer.encryptionService);
            const result = await useCase.getSettings(companyId);
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /ai-assistant/settings
     * Update AI provider configuration for the current company.
     */
    static async updateSettings(req, res, next) {
        try {
            (0, ai_assistant_validators_1.validateUpdateAiSettingsInput)(req.body);
            const companyId = AiAssistantController.getCompanyId(req);
            const useCase = new AiSettingsUseCase_1.AiSettingsUseCase(bindRepositories_1.diContainer.aiSettingsRepository, bindRepositories_1.diContainer.encryptionService);
            const result = await useCase.updateSettings({
                companyId,
                provider: req.body.provider,
                model: req.body.model,
                apiKey: req.body.apiKey,
                apiEndpoint: req.body.apiEndpoint,
                maxTokensPerRequest: req.body.maxTokensPerRequest,
                maxRequestsPerDay: req.body.maxRequestsPerDay,
                isEnabled: req.body.isEnabled,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /ai-assistant/settings/usage
     * Get AI usage analytics for the current company.
     */
    static async getUsageAnalytics(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const limit = Number(req.query.limit || 50);
            const useCase = new GetUsageAnalyticsUseCase_1.GetUsageAnalyticsUseCase(bindRepositories_1.diContainer.aiUsageLogRepository);
            const result = await useCase.execute({ companyId, limit });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /ai-assistant/settings/health
     * Test AI provider connectivity and inference readiness.
     * Sends a safe prompt only ("Reply with only: provider-ok").
     * Does NOT expose API key. Does NOT include any ERP data.
     */
    static async checkProviderHealth(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const useCase = new CheckProviderHealthUseCase_1.CheckProviderHealthUseCase(bindRepositories_1.diContainer.aiSettingsRepository, bindRepositories_1.diContainer.encryptionService, bindRepositories_1.diContainer.httpClient);
            const result = await useCase.execute(companyId);
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /ai-assistant/tools/execute
     * Execute an AI tool. Tools are read-only and permission-gated.
     * Only accessible to users with ai-assistant.chat.use permission.
     */
    static async executeTool(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const { toolName, params } = req.body;
            if (!toolName || typeof toolName !== 'string') {
                return next(ApiError_1.ApiError.badRequest('toolName is required and must be a string'));
            }
            const useCase = new ExecuteAiToolUseCase_1.ExecuteAiToolUseCase(bindRepositories_1.diContainer.aiToolRegistry, bindRepositories_1.diContainer.permissionChecker);
            const result = await useCase.execute({
                companyId,
                userId,
                toolName,
                params,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ================================================================
    // PROPOSAL SANDBOX ENDPOINTS
    // These endpoints manage AI proposals in the sandbox.
    // Proposals are safe, reviewable drafts — no real ERP data changes.
    // ================================================================
    /**
     * GET /ai-assistant/proposals
     * List proposals for the current company.
     */
    static async listProposals(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const { type, status, moduleId, userId, limit, offset } = req.query;
            const useCase = bindRepositories_1.diContainer.listAiProposalsUseCase;
            const result = await useCase.execute({
                companyId,
                type: type,
                status: status,
                moduleId: moduleId,
                userId: userId,
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /ai-assistant/proposals/:proposalId
     * Get a single proposal by ID.
     */
    static async getProposal(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const { proposalId } = req.params;
            const useCase = bindRepositories_1.diContainer.getAiProposalUseCase;
            const result = await useCase.execute({
                companyId,
                proposalId,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /ai-assistant/proposals
     * Create a new proposal in the sandbox.
     */
    static async createProposal(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const { type, title, summary, rationale, inputContextSummary, proposedData, warnings, riskLevel, moduleId, requiredPermissions, missingInfo, confidence, sourceChatMessageId } = req.body;
            const useCase = bindRepositories_1.diContainer.createAiProposalUseCase;
            const result = await useCase.execute({
                companyId,
                userId,
                sourceChatMessageId,
                type,
                title,
                summary,
                rationale,
                inputContextSummary,
                proposedData,
                warnings,
                riskLevel,
                moduleId,
                requiredPermissions,
                missingInfo,
                confidence,
            });
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /ai-assistant/proposals/:proposalId/status
     * Update proposal status (accept, reject, submit for review).
     * Accepting does NOT execute any business action.
     */
    static async updateProposalStatus(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const userId = AiAssistantController.getUserId(req);
            const { proposalId } = req.params;
            const { newStatus, rejectionReason } = req.body;
            if (!newStatus) {
                return next(ApiError_1.ApiError.badRequest('newStatus is required'));
            }
            const useCase = bindRepositories_1.diContainer.updateAiProposalStatusUseCase;
            const result = await useCase.execute({
                companyId,
                proposalId,
                newStatus,
                reviewedBy: userId,
                rejectionReason,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /ai-assistant/proposals/:proposalId/archive
     * Archive a proposal. No ERP data is deleted.
     */
    static async archiveProposal(req, res, next) {
        try {
            const companyId = AiAssistantController.getCompanyId(req);
            const { proposalId } = req.params;
            const useCase = bindRepositories_1.diContainer.archiveAiProposalUseCase;
            const result = await useCase.execute({
                companyId,
                proposalId,
            });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AiAssistantController = AiAssistantController;
//# sourceMappingURL=AiAssistantController.js.map