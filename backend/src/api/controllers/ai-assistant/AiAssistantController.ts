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
import { CheckProviderHealthUseCase } from '../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase';
import { ExecuteAiToolUseCase } from '../../../application/ai-assistant/use-cases/ExecuteAiToolUseCase';
import { validateSendChatMessageInput, validateUpdateAiSettingsInput } from '../../validators/ai-assistant.validators';
import { AiAssistantDTOMapper } from '../../dtos/AiAssistantDTOs';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { ApiError } from '../../../api/errors/ApiError';

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
   * Get recent conversations for the current user.
   */
  static async getRecentConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const limit = parseInt(req.query.limit as string) || 10;

      const messages = await diContainer.aiChatRepository.getRecentConversations(
        companyId, userId, limit
      );

      (res as any).status(200).json({
        success: true,
        data: {
          conversations: messages.map(msg => ({
            conversationId: msg.conversationId,
            lastMessage: AiAssistantDTOMapper.toChatMessageResponse(msg),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /ai-assistant/conversations/:conversationId
   * Delete all messages in a conversation.
   */
  static async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = AiAssistantController.getCompanyId(req);
      const userId = AiAssistantController.getUserId(req);
      const { conversationId } = req.params;

      await diContainer.aiChatRepository.deleteConversation(
        companyId, userId, conversationId
      );

      (res as any).status(200).json({
        success: true,
        data: { deleted: true },
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
        isEnabled: req.body.isEnabled,
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
}