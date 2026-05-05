/**
 * SendChatMessageUseCase - AI Assistant Chat Business Logic
 *
 * AI Safety Rules (enforced here):
 * - The AI assistant is advisory-only.
 * - It may NOT create, update, delete, approve, post, or modify any business records.
 * - It may only answer, explain, validate, summarize, or suggest drafts.
 * - Any real business action must go through existing backend use cases
 *   with explicit user approval.
 *
 * Tool Integration:
 * - When a user message matches a known tool intent, the orchestrator
 *   executes the read-only tool and injects the result as context.
 * - The AI provider is instructed to use ONLY the provided tool data,
 *   not to invent numbers, and to state clearly if data is unavailable.
 * - Tool selection is deterministic (keyword matching), not free-form AI selection.
 *
 * Rate Limiting:
 * - Each company has a maxRequestsPerDay limit (default: 100)
 * - Checked via AiRateLimiterService before processing any request
 * - Returns 429 if limit exceeded
 *
 * Usage Logging:
 * - Every request is logged after completion (success or failure)
 * - Usage logs are for analytics/auditing ONLY — not for rate limiting
 * - Rate limiting uses config-based counters in AiProviderConfig
 */

import { IAiChatRepository } from '../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IAiUsageLogRepository } from '../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiChatMessage } from '../../../domain/ai-assistant/entities/AiChatMessage';
import { AiUsageLog } from '../../../domain/ai-assistant/entities/AiUsageLog';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory } from '../providers/ProviderFactory';
import { AiProviderRequest } from '../providers/IAiProvider';
import { AiRateLimiterService } from '../services/AiRateLimiterService';
import { AiToolCallingOrchestrator } from '../services/AiToolCallingOrchestrator';
import { ProviderError } from '../../../errors/ProviderErrors';
import { ApiError } from '../../../api/errors/ApiError';

export interface SendChatMessageInput {
  companyId: string;
  userId: string;
  message: string;
  conversationId?: string;
}

export interface SendChatMessageOutput {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
  provider: string;
  model: string;
}

export class SendChatMessageUseCase {
  private rateLimiter: AiRateLimiterService;

  constructor(
    private chatRepository: IAiChatRepository,
    private settingsRepository: IAiSettingsRepository,
    private encryptionService: IEncryptionService,
    private httpClient: IHttpClient,
    private usageLogRepository?: IAiUsageLogRepository,
    private toolOrchestrator?: AiToolCallingOrchestrator,
  ) {
    this.rateLimiter = new AiRateLimiterService(settingsRepository);
  }

  async execute(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
    const { companyId, userId, message, conversationId } = input;
    const startTime = Date.now();

    // 1. Validate input
    if (!message || message.trim().length === 0) {
      throw ApiError.badRequest('Message content is required');
    }

    if (message.length > 10000) {
      throw ApiError.badRequest('Message content must not exceed 10,000 characters');
    }

    // 2. Check and increment rate limit (per company per day)
    await this.rateLimiter.checkAndIncrement(companyId);

    // 3. Get or create provider config for this company
    let config = await this.settingsRepository.getConfig(companyId);
    if (!config) {
      config = AiProviderConfig.defaultForCompany(companyId);
    } else {
      // Decrypt apiKey for provider usage
      config = this.decryptConfig(config);
    }

    // 4. Check if AI is enabled for this company
    if (!config.isEnabled) {
      throw ApiError.forbidden('AI Assistant is not enabled for this company. Please enable it in settings.');
    }

    // 5. Determine conversation ID (new or existing)
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 6. Get recent conversation history for context (last 10 messages)
    const recentMessages = await this.chatRepository.getConversationMessages(
      companyId, userId, convId, 10
    );

    // 7. Detect and execute tools if the message matches any known intents
    let toolContextMessage: string | null = null;

    if (this.toolOrchestrator) {
      try {
        const toolResults = await this.toolOrchestrator.detectAndExecute(
          message,
          companyId,
          userId,
        );

        if (toolResults && toolResults.length > 0) {
          // Format tool results for inclusion in the AI context
          toolContextMessage = this.toolOrchestrator.formatToolResultsForContext(toolResults);
        }
      } catch (error) {
        // Tool execution failure should NOT block the chat flow.
        // The AI will respond without tool data, which is acceptable.
        console.warn(
          `[AI Assistant] Tool execution failed for company ${companyId}, user ${userId}: ${(error as Error).message}`
        );
      }
    }

    // 8. Build the provider request with conversation context
    const providerMessages: AiProviderRequest['messages'] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(toolContextMessage),
      },
      // Include recent history for context
      ...recentMessages
        .slice(-8) // Last 8 messages for context window
        .map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      // Add the current user message
      {
        role: 'user' as const,
        content: message.trim(),
      },
    ];

    // 9. Get the provider and send the request
    const provider = ProviderFactory.getProvider(config, this.httpClient);

    let result: SendChatMessageOutput;
    let usageLogStatus: 'success' | 'failure' = 'success';
    let usageLogErrorCode: string | undefined;
    let tokenCount: number | undefined;

    try {
      const response = await provider.chat({
        messages: providerMessages,
        maxTokens: config.maxTokensPerRequest,
        temperature: 0.7,
      });

      // Extract token usage from metadata if available
      const usage = response.metadata?.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
      tokenCount = response.tokenCount;

      // 10. Save the user message
      const userMessage = AiChatMessage.create({
        companyId,
        userId,
        conversationId: convId,
        role: 'user',
        content: message.trim(),
        provider: config.provider,
        model: config.model,
      });

      const savedUserMessage = await this.chatRepository.create(userMessage);

      // 11. Save the assistant response
      const assistantMessage = AiChatMessage.create({
        companyId,
        userId,
        conversationId: convId,
        role: 'assistant',
        content: response.content,
        provider: response.provider,
        model: response.model,
        metadata: response.metadata,
      });
      // Set token count after creation since create() doesn't accept it
      assistantMessage.tokenCount = response.tokenCount;

      const savedAssistantMessage = await this.chatRepository.create(assistantMessage);

      result = {
        userMessage: savedUserMessage,
        assistantMessage: savedAssistantMessage,
        provider: response.provider,
        model: response.model,
      };

      // Log successful usage
      if (this.usageLogRepository) {
        const latencyMs = Date.now() - startTime;
        const usageLog = AiUsageLog.create({
          companyId,
          userId,
          providerType: config.provider,
          model: config.model || response.model,
          messageCount: providerMessages.length,
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens ?? tokenCount,
          status: 'success',
          latencyMs,
        });

        await this.usageLogRepository.create(usageLog).catch(err => {
          // Usage logging failure must NOT block the chat response
          console.warn('[AI Assistant] Failed to log usage:', (err as Error).message);
        });
      }

      return result;

    } catch (error) {
      // Log failed usage
      usageLogStatus = 'failure';

      // Normalize error code for usage log
      if (error instanceof ProviderError) {
        // Map provider error types to normalized codes
        const providerErr = error as ProviderError;
        if ((providerErr as any).statusCode === 401) {
          usageLogErrorCode = 'AI_PROVIDER_AUTH_ERROR';
        } else if ((providerErr as any).statusCode === 429) {
          usageLogErrorCode = 'AI_PROVIDER_RATE_LIMIT';
        } else if ((providerErr as any).statusCode === 503) {
          usageLogErrorCode = 'AI_PROVIDER_UNAVAILABLE';
        } else {
          usageLogErrorCode = 'AI_PROVIDER_ERROR';
        }
      } else if (error instanceof ApiError) {
        usageLogErrorCode = error.code || 'API_ERROR';
      } else {
        usageLogErrorCode = 'UNKNOWN_ERROR';
      }

      if (this.usageLogRepository) {
        const latencyMs = Date.now() - startTime;
        const usageLog = AiUsageLog.create({
          companyId,
          userId,
          providerType: config.provider,
          model: config.model || 'unknown',
          messageCount: providerMessages.length,
          status: 'failure',
          errorCode: usageLogErrorCode,
          latencyMs,
        });

        await this.usageLogRepository.create(usageLog).catch(err => {
          // Usage logging failure must NOT mask the original error
          console.warn('[AI Assistant] Failed to log usage for failure:', (err as Error).message);
        });
      }

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Decrypt the apiKey in an AiProviderConfig after loading from storage.
   * Returns the config with plaintext apiKey for provider usage.
   */
  private decryptConfig(config: AiProviderConfig): AiProviderConfig {
    if (!config.apiKey) {
      return config;
    }

    // Check if this looks like encrypted data (contains colons from iv:ciphertext:authTag)
    // or is a passthrough plaintext (starts with 'plain:')
    if (config.apiKey.startsWith('plain:')) {
      // Development passthrough — remove prefix and use as plaintext
      const plainKey = config.apiKey.substring(6);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: plainKey,
        updatedAt: config.updatedAt.toISOString(),
      });
    }

    try {
      const decrypted = this.encryptionService.decrypt(config.apiKey);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: decrypted,
        updatedAt: config.updatedAt.toISOString(),
      });
    } catch (error) {
      console.warn(
        `[AI Assistant] Failed to decrypt API key for company ${config.companyId}. ` +
        `The key may be stored in plaintext (pre-encryption). Error: ${(error as Error).message}`
      );
      // Return config as-is — ProviderFactory will fall back to mock if the key is invalid
      return config;
    }
  }

  /**
   * System prompt that enforces AI safety rules.
   * This is ALWAYS prepended to the conversation, ensuring the AI
   * understands its advisory-only role regardless of provider.
   *
   * When tool data is available, it's appended to the system prompt
   * with strict instructions on how to use (and NOT use) the data.
   */
  private buildSystemPrompt(toolContextMessage?: string | null): string {
    let prompt = `You are the AI Assistant for an ERP system. Your role is STRICTLY advisory.

RULES YOU MUST FOLLOW:
1. You may ONLY answer, explain, validate, summarize, or suggest drafts.
2. You may NOT create, update, delete, approve, post, or modify any business records.
3. Any real business action (creating invoices, posting vouchers, adjusting inventory, etc.) MUST go through the standard ERP module workflows with explicit user approval.
4. For accounting, voucher, payment, and inventory questions — always advise the user to use the proper module for actual transactions.
5. Never provide API endpoints or direct database operations.
6. If a user asks you to perform an action, explain HOW to do it in the ERP UI instead of doing it yourself.

You are helpful, professional, and knowledgeable about business processes including:
- Accounting (chart of accounts, journal entries, financial reports)
- Sales (invoices, orders, delivery notes, returns)
- Purchases (purchase orders, goods receipts, purchase invoices, returns)
- Inventory (stock levels, movements, adjustments, transfers)
- General business management advice

Keep responses concise and actionable. Use markdown formatting when it helps readability.`;

    // Append tool descriptions if orchestrator is available
    if (this.toolOrchestrator) {
      const toolDescriptions = this.toolOrchestrator.getToolDescriptionsForPrompt();
      if (toolDescriptions) {
        prompt += `\n\n${toolDescriptions}`;
      }
    }

    // Append tool result context if data was retrieved
    if (toolContextMessage) {
      prompt += `\n\n${toolContextMessage}`;
    }

    return prompt;
  }
}