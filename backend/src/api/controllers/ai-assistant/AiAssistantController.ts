/**
 * AiAssistantController - Thin Express request handlers for AI Assistant
 *
 * Delegates all business logic to use cases.
 * Follows the existing controller pattern: validate → extract → delegate → respond.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { SendChatMessageUseCase } from '../../../application/ai-assistant/use-cases/SendChatMessageUseCase';
import { AiSettingsUseCase } from '../../../application/ai-assistant/use-cases/AiSettingsUseCase';
import { GetUsageAnalyticsUseCase } from '../../../application/ai-assistant/use-cases/GetUsageAnalyticsUseCase';
import { CheckProviderHealthUseCase } from '../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase';
import { ExecuteAiToolUseCase } from '../../../application/ai-assistant/use-cases/ExecuteAiToolUseCase';
import { validateSendChatMessageInput, validateUpdateAiSettingsInput } from '../../validators/ai-assistant.validators';
import { AiAssistantDTOMapper } from '../../dtos/AiAssistantDTOs';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { ApiError } from '../../../api/errors/ApiError';
import { certificationCategoryForModule } from '../../../application/ai-assistant/services/AiModelRoutingGuard';
import { getCatalogDefinition } from '../../../application/ai-assistant/catalog/AiToolCatalogSeed';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { isAiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiChatFeedback } from '../../../domain/ai-assistant/entities/AiChatMessage';

export class AiAssistantController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).tenantContext?.companyId;
    if (!companyId) {
      throw new Error('Company ID is required');
    }
    return companyId;
  }

  private static getUserId(req: Request): string {
    const userId = (req as any).tenantContext?.userId;
    if (!userId) {
      throw new Error('User ID is required');
    }
    return userId;
  }

  /**
   * Decode profile ID from route param.
   * Profile IDs may contain '/' which gets double-encoded in URLs.
   * Express auto-decodes once, so we decode a second time to get the original ID.
   */
  private static decodeProfileId(raw: string): string {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw; // Already decoded or invalid encoding
    }
  }

  /**
   * POST /ai-assistant/chat
   * Send a message to the AI assistant and receive a response.
   */
  static async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      validateSendChatMessageInput(req.body);

      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { message, conversationId } = req.body;

const useCase = new SendChatMessageUseCase(
        diContainer.aiChatRepository,
        diContainer.aiSettingsRepository,
        diContainer.encryptionService,
        diContainer.httpClient,
        diContainer.aiUsageLogRepository,
        diContainer.aiToolCallingOrchestrator,
        diContainer.aiProposalGeneratorRegistry,
        diContainer.createAiProposalUseCase,
        diContainer.aiRuntimeGuard,
        diContainer.aiAuditService,
        diContainer.aiSkillRegistry,
        diContainer.aiModelProfileUseCase,
        diContainer.aiModelRoutingGuard,
        diContainer.aiProviderRepository,
        diContainer.aiCreditLedgerRepository,
        diContainer.aiConversationMetaRepository,
      );

      const result = await useCase.execute({
        companyId,
        userId,
        message,
        conversationId,
      });

      (res as any).status(200).json({
        success: true,
        data: {
          userMessage: AiAssistantDTOMapper.toChatMessageResponse(result.userMessage),
          assistantMessage: AiAssistantDTOMapper.toChatMessageResponse(result.assistantMessage),
          provider: result.provider,
          model: result.model,
          // Stage 2: optional runtime metadata — backward compatible
          ...(result.runtimeMeta ? { runtimeMeta: result.runtimeMeta } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/conversations/:conversationId/messages
   * Get messages for a specific conversation.
   */
  static async getConversationMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const messages = await diContainer.aiChatRepository.getConversationMessages(
        companyId, userId, conversationId, limit
      );

      (res as any).status(200).json({
        success: true,
        data: {
          messages: messages.map(AiAssistantDTOMapper.toChatMessageResponse),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/conversations
   * Get recent conversations for the current user, including title and message counts.
   */
  static async getRecentConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const limit = parseInt(req.query.limit as string) || 20;

      const metaList = await diContainer.aiConversationMetaRepository.listByUser(
        companyId, userId, limit
      );

      (res as any).status(200).json({
        success: true,
        data: {
          conversations: metaList.map(meta => ({
            conversationId: meta.id,
            title: meta.title,
            messageCount: meta.messageCount,
            lastMessageAt: meta.lastMessageAt.toISOString(),
            createdAt: meta.createdAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /ai-assistant/conversations/:conversationId
   * Delete all messages and metadata in a conversation.
   */
  static async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { conversationId } = req.params;

      // Delete both the messages and the conversation metadata
      await Promise.all([
        diContainer.aiChatRepository.deleteConversation(
          companyId, userId, conversationId
        ),
        diContainer.aiConversationMetaRepository.delete(
          conversationId, companyId
        ),
      ]);

      (res as any).status(200).json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai-assistant/messages/:messageId/feedback
   * Update user feedback (positive/negative) on an assistant message.
   * Only assistant messages can receive feedback.
   * Toggling the same value removes feedback; switching changes it.
   */
  static async updateMessageFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const { messageId } = req.params;
      const { feedback } = req.body || {};

      if (!feedback || (feedback !== 'positive' && feedback !== 'negative')) {
        throw ApiError.badRequest('feedback must be "positive" or "negative"');
      }

      const message = await diContainer.aiChatRepository.getById(companyId, messageId);
      if (!message) {
        throw ApiError.notFound(`Message ${messageId} not found`);
      }
      if (message.companyId !== companyId) {
        throw ApiError.forbidden('Message does not belong to your company');
      }
      if (message.role !== 'assistant') {
        throw ApiError.badRequest('Feedback can only be provided on assistant messages');
      }

      // Toggle: if same feedback, remove it; otherwise set new value
      const newFeedback: AiChatFeedback | undefined = message.feedback === feedback ? undefined : feedback;

      const updated = await diContainer.aiChatRepository.updateFeedback(companyId, messageId, newFeedback);

      (res as any).status(200).json({
        success: true,
        data: AiAssistantDTOMapper.toChatMessageResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/settings
   * Get AI provider configuration for the current company.
   */
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);

      const useCase = new AiSettingsUseCase(diContainer.aiSettingsRepository, diContainer.encryptionService);
      const result = await useCase.getSettings(companyId);

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /ai-assistant/settings
   * Update AI provider configuration for the current company.
   */
  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateAiSettingsInput(req.body);

      const companyId = AiAssistantController.getCompanyId(req);

      const useCase = new AiSettingsUseCase(diContainer.aiSettingsRepository, diContainer.encryptionService);
      const result = await useCase.updateSettings({
        companyId,
        provider: req.body.provider,
        model: req.body.model,
        apiKey: req.body.apiKey,
        apiEndpoint: req.body.apiEndpoint,
        maxTokensPerRequest: req.body.maxTokensPerRequest,
        maxRequestsPerDay: req.body.maxRequestsPerDay,
        conversationContextMode: req.body.conversationContextMode,
        includePreviousToolResults: req.body.includePreviousToolResults,
        isEnabled: req.body.isEnabled,
        mode: req.body.mode,
        providerId: req.body.providerId,
        selectedModelProfileId: req.body.selectedModelProfileId,
        selectedProfileHash: req.body.selectedProfileHash,
        runtimeMode: req.body.runtimeMode,
        allowedRuntimeModes: req.body.allowedRuntimeModes,
      });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/settings/usage
   * Get AI usage analytics for the current company.
   */
  static async getUsageAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const limit = Number(req.query.limit || 50);

      const useCase = new GetUsageAnalyticsUseCase(diContainer.aiUsageLogRepository);
      const result = await useCase.execute({ companyId, limit });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/usage/summary
   * Aggregated usage summary for the AI Assistant dashboard.
   * Returns: total requests this month, tokens, credits remaining, requests by user, requests by day.
   */
  static async getUsageSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);

      const logs = await diContainer.aiUsageLogRepository.getByCompany(companyId, 10000, 0);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthLogs = logs.filter(l => l.createdAt >= monthStart);

      const totalRequests = monthLogs.length;
      const totalTokensUsed = monthLogs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);

      const userMap = new Map<string, number>();
      const dayMap = new Map<string, number>();

      for (const log of monthLogs) {
        const userId = log.userId || 'unknown';
        userMap.set(userId, (userMap.get(userId) || 0) + 1);

        const dayKey = log.createdAt.toISOString().slice(0, 10);
        dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
      }

      const requestsByUser = Array.from(userMap.entries())
        .map(([userId, requests]) => ({ userId, requests }))
        .sort((a, b) => b.requests - a.requests);

      const requestsByDay = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Get credit balance if available
      let creditsRemaining: number | undefined;
      try {
        const ledger = await diContainer.aiCreditLedgerRepository.getByCompanyId(companyId);
        if (ledger) {
          creditsRemaining = ledger.balance;
        }
      } catch {
        // Credit ledger may not be configured; that's fine
      }

      res.json({
        success: true,
        data: {
          period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          totalRequests,
          totalTokensUsed,
          creditsRemaining,
          requestsByUser,
          requestsByDay,
        },
      });
    } catch (error) {
      next(error);
    }
  }

/**
   * GET /ai-assistant/providers
   * List enabled AI provider metadata available to tenant settings.
   * Secrets/internal ERP-managed credentials are never returned here.
   * Explicitly maps to a safe response shape — no secrets, no internal fields.
   */
  static async listAvailableProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = await diContainer.aiProviderRegistryUseCase.listProviders();
      const data = providers
        .filter(provider => provider.enabled)
        .map(provider => ({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          defaultBaseUrl: provider.defaultBaseUrl || null,
          authType: provider.authType,
          byok: provider.byok,
          enabled: provider.enabled,
          supportsTools: provider.supportsTools,
          supportsJsonMode: provider.supportsJsonMode,
          supportsModelSync: provider.supportsModelSync,
          notes: provider.notes || null,
          createdAt: provider.createdAt.toISOString(),
          updatedAt: provider.updatedAt.toISOString(),
        }));

      (res as any).status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/providers/:providerId/models
   * List enabled global model profiles registered under a selected provider.
   * Uses exact providerId matching only. Provider type fallback is intentionally
   * not used because multiple providers can share the same type (for example,
   * several OpenAI-compatible providers such as OpenAI, OpenRouter, and Groq).
   */
  static async listAvailableProviderModels(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const providerId = AiAssistantController.decodeProfileId(req.params.providerId);
      const provider = await diContainer.aiProviderRegistryUseCase.getProvider(providerId);
      if (!provider.enabled) throw ApiError.badRequest('AI provider is disabled');

      const profiles = await diContainer.aiModelProfileUseCase.listProfiles();
      const profileRows = profiles
        .filter(profile => profile.enabled)
        .filter(profile => profile.scope === 'GLOBAL')
        .filter(profile => profile.providerId === provider.id)
        .filter(profile => !['blocked', 'deprecated'].includes(profile.status));

      const certifiedEntries = await diContainer.aiModelCertificationUseCase.listValidCertifiedProfiles({
        scope: 'ALL',
        tenantId: companyId,
      });
      const certificationByProfileId = new Map<string, Record<string, unknown>[]>();
      for (const entry of certifiedEntries) {
        const profile = entry.profile as Record<string, unknown>;
        const id = String(profile.id || '');
        if (!id) continue;
        certificationByProfileId.set(id, entry.certifications as Record<string, unknown>[]);
      }

      const data = profileRows.map(profile => ({
        profile: profile.toJSON(),
        certifications: certificationByProfileId.get(profile.id) || [],
      }));

      (res as any).status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai-assistant/settings/health
   * Test AI provider connectivity and inference readiness.
   * Sends a safe prompt only ("Reply with only: provider-ok").
   * Does NOT expose API key. Does NOT include any ERP data.
   */
  static async checkProviderHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);

      const useCase = new CheckProviderHealthUseCase(
        diContainer.aiSettingsRepository,
        diContainer.encryptionService,
        diContainer.httpClient,
        diContainer.aiModelProfileUseCase,
        diContainer.aiProviderRepository,
      );

      const result = await useCase.execute(companyId);

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTenantCustomModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const body = req.body || {};
      if (!body.providerId || !body.provider || !body.modelId) {
        throw ApiError.badRequest('providerId, provider, and modelId are required');
      }

      const profile = await diContainer.aiModelProfileUseCase.createTenantCustomProfile({
        tenantId: companyId,
        providerId: body.providerId,
        provider: body.provider,
        modelId: body.modelId,
        displayName: body.displayName,
        baseUrl: body.baseUrl,
        temperature: body.temperature,
        maxOutputTokens: body.maxOutputTokens,
        jsonMode: body.jsonMode,
        toolMode: body.toolMode,
        timeoutMs: body.timeoutMs,
        retryPolicy: body.retryPolicy,
        safetyPolicyId: body.safetyPolicyId,
        systemPromptPolicyId: body.systemPromptPolicyId,
        dataFilterPolicyId: body.dataFilterPolicyId,
        createdBy: userId,
      });

      (res as any).status(201).json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async runTenantCustomModelDiagnostics(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const profile = await diContainer.aiModelProfileUseCase.getProfileById(AiAssistantController.decodeProfileId(req.params.profileId));
      if (!profile) throw ApiError.notFound(`AI model profile '${AiAssistantController.decodeProfileId(req.params.profileId)}' not found`);
      if (profile.scope !== 'TENANT' || profile.tenantId !== companyId) {
        throw ApiError.forbidden('Tenant model profile does not belong to this company');
      }

      const useCase = new CheckProviderHealthUseCase(
        diContainer.aiSettingsRepository,
        diContainer.encryptionService,
        diContainer.httpClient,
        diContainer.aiModelProfileUseCase,
        diContainer.aiProviderRepository,
      );
      const result = await useCase.execute({
        companyId,
        providerOverride: profile.provider as any,
        modelOverride: profile.modelId,
      });
      (res as any).status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async runTenantCustomModelCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { profileHash, category, moduleId, skillId } = req.body || {};
      if (!profileHash) throw ApiError.badRequest('profileHash is required');
      if (!category || !isAiCertificationCategory(category)) throw ApiError.badRequest('valid category is required');

      const result = await diContainer.aiModelCertificationUseCase.runShellCertification({
        scope: 'TENANT',
        tenantId: companyId,
        modelProfileId: AiAssistantController.decodeProfileId(req.params.profileId),
        profileHash,
        category,
        moduleId,
        skillId,
        testedBy: userId,
        approvedBy: userId,
      });

      (res as any).status(201).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async listTenantCertifiedProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const category = req.query.category as string | undefined;
      if (category && !isAiCertificationCategory(category)) throw ApiError.badRequest('Invalid category');
const scopeParam = (req.query.scope as string) || 'TENANT';
      if (scopeParam !== 'GLOBAL' && scopeParam !== 'TENANT' && scopeParam !== 'ALL') {
        throw ApiError.badRequest('scope must be one of: GLOBAL, TENANT, ALL');
      }
      const data = await diContainer.aiModelCertificationUseCase.listValidCertifiedProfiles({
        scope: scopeParam as 'GLOBAL' | 'TENANT' | 'ALL',
        tenantId: companyId,
        category: category as any,
        moduleId: req.query.moduleId as string | undefined,
      });
      (res as any).status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/settings/custom-model-profiles/:profileId
   * Get a tenant custom model profile by ID (tenant-scoped).
   */
  static async getTenantCustomModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);

      const profile = await diContainer.aiModelProfileUseCase.getProfileById(AiAssistantController.decodeProfileId(req.params.profileId));
      if (!profile) throw ApiError.notFound(`AI model profile '${AiAssistantController.decodeProfileId(req.params.profileId)}' not found`);
      if (profile.scope !== 'TENANT' || profile.tenantId !== companyId) {
        throw ApiError.forbidden('Tenant model profile does not belong to this company');
      }

      (res as any).status(200).json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai-assistant/settings/custom-model-profiles/:profileId
   * Update a tenant custom model profile's configuration.
   * Regenerates profileHash and increments revision.
   */
  static async updateTenantCustomModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const body = req.body || {};

      const profile = await diContainer.aiModelProfileUseCase.getProfileById(AiAssistantController.decodeProfileId(req.params.profileId));
      if (!profile) throw ApiError.notFound(`AI model profile '${AiAssistantController.decodeProfileId(req.params.profileId)}' not found`);
      if (profile.scope !== 'TENANT' || profile.tenantId !== companyId) {
        throw ApiError.forbidden('Tenant model profile does not belong to this company');
      }

      const updates: {
        toolMode?: 'none' | 'text_plan' | 'native_tools' | 'json_only';
        temperature?: number;
        maxOutputTokens?: number;
        dataFilterPolicyId?: string;
        safetyPolicyId?: string;
        systemPromptPolicyId?: string;
        displayName?: string;
        baseUrl?: string;
      } = {};
      if (body.toolMode) updates.toolMode = body.toolMode;
      if (body.temperature !== undefined) updates.temperature = body.temperature;
      if (body.maxOutputTokens !== undefined) updates.maxOutputTokens = body.maxOutputTokens;
      if (body.dataFilterPolicyId !== undefined) updates.dataFilterPolicyId = body.dataFilterPolicyId;
      if (body.safetyPolicyId !== undefined) updates.safetyPolicyId = body.safetyPolicyId;
      if (body.systemPromptPolicyId !== undefined) updates.systemPromptPolicyId = body.systemPromptPolicyId;
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.baseUrl !== undefined) updates.baseUrl = body.baseUrl;

      const updated = await diContainer.aiModelProfileUseCase.updateTenantProfile(AiAssistantController.decodeProfileId(req.params.profileId), companyId, updates);
      (res as any).status(200).json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /ai-assistant/settings/custom-model-profiles/:profileId
   * Deprecate a tenant custom model profile (soft-delete).
   * Marks the profile as deprecated, disables it, and clears the tenant's
   * selected profile reference if this was the active profile.
   */
  static async deprecateTenantCustomModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);

      const profile = await diContainer.aiModelProfileUseCase.getProfileById(AiAssistantController.decodeProfileId(req.params.profileId));
      if (!profile) throw ApiError.notFound(`AI model profile '${AiAssistantController.decodeProfileId(req.params.profileId)}' not found`);
      if (profile.scope !== 'TENANT' || profile.tenantId !== companyId) {
        throw ApiError.forbidden('Tenant model profile does not belong to this company');
      }

      // Deprecate the profile
      await diContainer.aiModelProfileUseCase.deprecateTenantProfile(AiAssistantController.decodeProfileId(req.params.profileId), companyId);

      // Clear the selected profile reference from tenant settings if this was the active profile
      const settingsUseCase = new AiSettingsUseCase(diContainer.aiSettingsRepository, diContainer.encryptionService);
      const settings = await settingsUseCase.getSettings(companyId);
      if (settings.config.selectedModelProfileId === AiAssistantController.decodeProfileId(req.params.profileId)) {
        await settingsUseCase.clearSelectedProfile(companyId);
      }

      (res as any).status(200).json({ success: true, message: 'Profile deprecated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai-assistant/tools/execute
   * Execute an AI tool. Tools are read-only and permission-gated.
   * Only accessible to users with ai-assistant.chat.use permission.
   */
  static async executeTool(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { toolName, params } = req.body;

      if (!toolName || typeof toolName !== 'string') {
        return next(ApiError.badRequest('toolName is required and must be a string'));
      }

      const config = await diContainer.aiSettingsRepository.getConfig(companyId);
      const catalogDef = getCatalogDefinition(toolName);
      const guardDecision = await diContainer.aiModelRoutingGuard.validateSensitiveWorkflow({
        tenantId: companyId,
        config: config || AiProviderConfig.defaultForCompany(companyId),
        category: certificationCategoryForModule(catalogDef?.moduleId),
        moduleId: catalogDef?.moduleId,
      });
      if (!guardDecision.allowed) {
        return next(ApiError.forbidden(
          guardDecision.reason || 'This model profile is not certified for this ERP module/workflow. Please select a certified profile or run company certification.',
        ));
      }

      const useCase = new ExecuteAiToolUseCase(
        diContainer.aiToolRegistry,
        diContainer.permissionChecker,
      );

      const result = await useCase.execute({
        companyId,
        userId,
        toolName,
        params,
      });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
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
  static async listProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const { type, status, moduleId, userId, limit, offset } = req.query;

      const useCase = diContainer.listAiProposalsUseCase;
      const result = await useCase.execute({
        companyId,
        type: type as string | undefined,
        status: status as string | undefined,
        moduleId: moduleId as string | undefined,
        userId: userId as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai-assistant/proposals/:proposalId
   * Get a single proposal by ID.
   */
  static async getProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const { proposalId } = req.params;

      const useCase = diContainer.getAiProposalUseCase;
      const result = await useCase.execute({
        companyId,
        proposalId,
      });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /ai-assistant/proposals
   * Create a new proposal in the sandbox.
   */
  static async createProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { type, title, summary, rationale, inputContextSummary, proposedData, warnings, riskLevel, moduleId, requiredPermissions, missingInfo, confidence, sourceChatMessageId } = req.body;

      const useCase = diContainer.createAiProposalUseCase;
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

      (res as any).status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai-assistant/proposals/:proposalId/status
   * Update proposal status (accept, reject, submit for review).
   * Accepting does NOT execute any business action.
   */
  static async updateProposalStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { proposalId } = req.params;
      const { newStatus, rejectionReason } = req.body;

      if (!newStatus) {
        return next(ApiError.badRequest('newStatus is required'));
      }

      const useCase = diContainer.updateAiProposalStatusUseCase;
      const result = await useCase.execute({
        companyId,
        proposalId,
        newStatus,
        reviewedBy: userId,
        rejectionReason,
      });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /ai-assistant/proposals/:proposalId/archive
   * Archive a proposal. No ERP data is deleted.
   */
  static async archiveProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const { proposalId } = req.params;

      const useCase = diContainer.archiveAiProposalUseCase;
      const result = await useCase.execute({
        companyId,
        proposalId,
      });

      (res as any).status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
