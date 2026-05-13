/**
 * SendChatMessageUseCase - AI Assistant Chat Business Logic
 *
 * This use case orchestrates the AI chat flow by delegating to focused services:
 * - AiCredentialResolver: credential decryption and resolution
 * - AiContextBuilder: system prompt and conversation context
 * - AiToolPlanningLoop: multi-round tool planning and execution
 * - AiResponsePersister: message saving, usage logging, and credit debiting
 *
 * The orchestrator handles: input validation, rate limiting, config loading,
 * model profile resolution, skill selection, tool contract building, provider
 * creation, and error handling.
 *
 * AI Safety Rules (enforced via AiContextBuilder and AiToolPlanningLoop):
 * - The AI assistant is advisory-only.
 * - It may NOT create, update, delete, approve, post, or modify any business records.
 * - It may only answer, explain, validate, summarize, or suggest drafts.
 * - Any real business action must go through existing backend use cases
 *   with explicit user approval.
 *
 * Rate Limiting:
 * - Each company has a maxRequestsPerDay limit (default: 100)
 * - Checked via AiRateLimiterService before processing any request
 *
 * Concurrent Request Deduplication:
 * - Same company/user/conversation gets a 409 Conflict if already processing
 * - Lock is released in finally block, even on errors
 */

import { IAiChatRepository } from '../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IAiUsageLogRepository } from '../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';
import { IAiCreditLedgerRepository } from '../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory, ProviderProviderError } from '../providers/ProviderFactory';
import { IAiProvider, AiProviderRequest, AiStreamEvent as ProviderStreamEvent } from '../providers/IAiProvider';
import { AiRateLimiterService } from '../services/AiRateLimiterService';
import { AiToolCallingOrchestrator, ToolCallingResult } from '../services/AiToolCallingOrchestrator';
import { AiRuntimeGuard, AiRunContext } from '../services/AiRuntimeGuard';
import { AiModelCapabilityCatalog, AiModelProfile } from '../services/AiModelCapabilityCatalog';
import { AiSkillRegistry } from '../skills/AiSkillRegistry';
import { AiProviderToolContract } from '../../../domain/ai-assistant/tools/AiToolContract';
import { ProviderError } from '../../../errors/ProviderErrors';
import { ApiError } from '../../../api/errors/ApiError';
import { AiProposalGeneratorRegistry } from '../proposals/AiProposalGeneratorRegistry';
import { CreateAiProposalUseCase } from './CreateAiProposalUseCase';
import { AiModelProfileUseCase } from './AiModelProfileUseCase';
import { AiModelRoutingGuard } from '../services/AiModelRoutingGuard';
import { AiCredentialResolver } from '../services/AiCredentialResolver';
import { AiContextBuilder } from '../services/AiContextBuilder';
import { AiToolPlanningLoop } from '../services/AiToolPlanningLoop';
import { AiResponsePersister } from '../services/AiResponsePersister';
import { SendChatMessageInput, SendChatMessageOutput } from './SendChatMessageTypes';
import { AiStreamEvent, AiStreamDoneMetadata } from './SendChatMessageStreamTypes';

export { SendChatMessageInput, SendChatMessageOutput } from './SendChatMessageTypes';
export type { AiStreamEvent, AiStreamDoneMetadata } from './SendChatMessageStreamTypes';

export class SendChatMessageUseCase {
  private static activeLocks = new Set<string>();
  private rateLimiter: AiRateLimiterService;
  private credentialResolver: AiCredentialResolver;
  private contextBuilder: AiContextBuilder;
  private planningLoop: AiToolPlanningLoop;
  private responsePersister: AiResponsePersister;

  constructor(
    private chatRepository: IAiChatRepository,
    private settingsRepository: IAiSettingsRepository,
    private encryptionService: IEncryptionService,
    private httpClient: IHttpClient,
    private usageLogRepository?: IAiUsageLogRepository,
    private toolOrchestrator?: AiToolCallingOrchestrator,
    private proposalGeneratorRegistry?: AiProposalGeneratorRegistry,
    private createAiProposalUseCase?: CreateAiProposalUseCase,
    private runtimeGuard?: AiRuntimeGuard,
    private auditService?: import('../services/AiAuditService').AiAuditService,
    private skillRegistry?: AiSkillRegistry,
    private modelProfileUseCase?: AiModelProfileUseCase,
    private modelRoutingGuard?: AiModelRoutingGuard,
    private providerRepository?: IAiProviderRepository,
    private creditLedgerRepository?: IAiCreditLedgerRepository,
  ) {
    this.rateLimiter = new AiRateLimiterService(settingsRepository);
    this.credentialResolver = new AiCredentialResolver(encryptionService, providerRepository, creditLedgerRepository);
    this.contextBuilder = new AiContextBuilder(toolOrchestrator);
    this.planningLoop = new AiToolPlanningLoop(toolOrchestrator, runtimeGuard, auditService);
    this.responsePersister = new AiResponsePersister(chatRepository, usageLogRepository, creditLedgerRepository, auditService);
  }

  async execute(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
    const { companyId, userId, message, conversationId } = input;
    const startTime = Date.now();

    // ── Stage 2: Initialize runtime context ──────────────────────────────
    const aiRunId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    let runContext: AiRunContext | undefined;
    const runtimeWarnings: string[] = [];
    const toolCallsRequested: string[] = [];
    let toolResultsForMetadata: ToolCallingResult[] = [];

    // 1. Validate input
    if (!message || message.trim().length === 0) {
      throw ApiError.badRequest('Message content is required');
    }
    if (message.length > 10000) {
      throw ApiError.badRequest('Message content must not exceed 10,000 characters');
    }

    // 2. Check and increment rate limit
    await this.rateLimiter.checkAndIncrement(companyId);

    // 3. Get or create provider config, then decrypt and resolve credentials
    let config = await this.settingsRepository.getConfig(companyId);
    if (!config) {
      config = AiProviderConfig.defaultForCompany(companyId);
    } else {
      config = this.credentialResolver.decryptConfig(config);
    }
    config = await this.credentialResolver.resolveRuntimeCredential(config);

    // 4. Check if AI is enabled
    if (!config.isEnabled) {
      throw ApiError.forbidden('AI Assistant is not enabled for this company. Please enable it in settings.');
    }

    // 5. Determine conversation ID
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 5b. Concurrent request deduplication
    const lockKey = `${companyId}:${userId}:${convId}`;
    if (SendChatMessageUseCase.activeLocks.has(lockKey)) {
      throw ApiError.conflict('A request is already being processed for this conversation. Please wait.');
    }
    SendChatMessageUseCase.activeLocks.add(lockKey);

    try {
      // 6. Build model capability profile
      const modelProfile = await this.resolveModelProfile(config.provider, config.model);
      if (modelProfile.textOnlyMode) {
        runtimeWarnings.push(modelProfile.warningMessage || `Model '${config.model}' is running in text-only mode. Tool calling is disabled.`);
      }
      if (modelProfile.warningLevel === 'danger') {
        runtimeWarnings.push(`Model '${config.model}' on provider '${config.provider}' is not recognized. Responses may be unreliable.`);
      }

      // 7. Select domain skills from message
      let selectedSkills: string[] = ['base-orchestration'];
      if (this.skillRegistry) {
        const domainSkills = this.skillRegistry.selectDomainSkills(message);
        selectedSkills = ['base-orchestration', ...domainSkills.map(s => s.id)];
      }

      // 8. Build allowed tool contracts for this user/run
      let allowedContracts: AiProviderToolContract[] = [];
      let nameMapping = new Map<string, string>();
      let allowedToolIds: string[] = [];

      if (this.toolOrchestrator && typeof (this.toolOrchestrator as any).buildAllowedToolContracts === 'function') {
        try {
          const contractsResult = await this.toolOrchestrator.buildAllowedToolContracts(userId, companyId, {
            providerConfig: config,
            routingGuard: this.modelRoutingGuard,
          });
          allowedContracts = contractsResult.contracts;
          nameMapping = contractsResult.nameMapping;
          allowedToolIds = contractsResult.allowedToolIds;
        } catch (error) {
          console.warn(`[AI Assistant] Failed to build allowed tool contracts: ${(error as Error).message}`);
        }
      }

      // 9. Create AiRunContext
      const toolRoutingDecision = this.modelRoutingGuard
        ? await this.modelRoutingGuard.validateSensitiveWorkflow({
            tenantId: companyId,
            config,
            category: 'TOOL_CALLING',
          })
        : undefined;

      if (this.modelRoutingGuard && !toolRoutingDecision?.allowed) {
        runtimeWarnings.push(toolRoutingDecision?.reason || 'This model profile is not certified for ERP tool workflows.');
        allowedContracts = [];
        nameMapping = new Map();
        allowedToolIds = [];
      }

      if (this.runtimeGuard) {
        runContext = this.runtimeGuard.createRun({
          companyId,
          userId,
          conversationId: convId,
          allowedToolIds,
          providerModel: `${config.provider}/${config.model || 'unknown'}`,
          certification: toolRoutingDecision,
          maxToolCalls: 5,
          ttlMs: 5 * 60 * 1000,
        });
      }

      // 10. Audit: AI_RUN_STARTED
      this.responsePersister.auditLogSafe('AI_RUN_STARTED', {
        companyId,
        userId,
        conversationId: convId,
        aiRunId: runContext?.aiRunId ?? aiRunId,
        providerModel: `${config.provider}/${config.model || 'unknown'}`,
        selectedSkills,
        allowedToolIds,
      });

      // ── Build conversation context ─────────────────────────────────────
      const contextBudget = this.contextBuilder.resolveConversationContextBudget(config);
      const recentMessages = await this.chatRepository.getConversationMessages(
        companyId, userId, convId, contextBudget.fetchMessageLimit
      );
      const recentToolDataContext = this.contextBuilder.buildRecentToolDataContext(recentMessages, contextBudget);
      let historyContextWasTrimmed = recentMessages.length > contextBudget.providerHistoryMessageLimit;
      const recentProviderMessages = recentMessages
        .slice(-contextBudget.providerHistoryMessageLimit)
        .map(m => {
          const trimmedContent = this.contextBuilder.truncateForPrompt(
            m.content,
            contextBudget.providerHistoryMessageCharLimit,
          );
          if (trimmedContent.wasTruncated) {
            historyContextWasTrimmed = true;
          }
          return { role: m.role as 'user' | 'assistant' | 'system', content: trimmedContent.text };
        });

      if (historyContextWasTrimmed || recentToolDataContext.wasTruncated) {
        runtimeWarnings.push(
          'Conversation context was limited to control AI token cost. Older or very large details may be omitted; ask for a specific report again if needed.',
        );
      }

      // ── Proposal intent detection ───────────────────────────────────────
      let proposalContextMessage: string | null = null;
      let proposalResultForMetadata: Record<string, unknown> | null = null;

      if (this.proposalGeneratorRegistry && this.createAiProposalUseCase) {
        try {
          const proposalType = this.proposalGeneratorRegistry.detectProposalIntent(message);
          if (proposalType) {
            console.log(`[AI Assistant] Proposal intent detected: ${proposalType}`);
            const generatorOutput = await this.proposalGeneratorRegistry.generate(proposalType, {
              companyId, userId, userMessage: message,
              toolResultData: toolResultsForMetadata.length > 0
                ? toolResultsForMetadata[0].result.data as Record<string, unknown>
                : undefined,
            });
            const createResult = await this.createAiProposalUseCase.execute({
              companyId, userId, type: generatorOutput.type, title: generatorOutput.title,
              summary: generatorOutput.summary, rationale: generatorOutput.rationale,
              inputContextSummary: generatorOutput.inputContextSummary, proposedData: generatorOutput.proposedData,
              warnings: generatorOutput.warnings, riskLevel: generatorOutput.riskLevel,
              moduleId: generatorOutput.moduleId, requiredPermissions: generatorOutput.requiredPermissions,
              missingInfo: generatorOutput.missingInfo, confidence: generatorOutput.confidence,
            });
            proposalResultForMetadata = createResult.proposal;
            proposalContextMessage = this.contextBuilder.formatProposalForContext(
              createResult.proposal, generatorOutput.missingInfo,
            );
          }
        } catch (error) {
          console.warn(`[AI Assistant] Proposal creation failed for company ${companyId}, user ${userId}: ${(error as Error).message}`);
        }
      }

      // ── Build skill context ──────────────────────────────────────────────
      let skillContext = '';
      if (this.skillRegistry) {
        skillContext = this.skillRegistry.buildSkillContext(message);
      }

      // ── Create provider ───────────────────────────────────────────────────
      let provider: IAiProvider;
      try {
        provider = ProviderFactory.getProvider(config, this.httpClient);
      } catch (providerError) {
        const providerMsg = providerError instanceof ProviderProviderError
          ? providerError.message
          : 'AI provider could not be initialized. Please check your AI settings and run diagnostics.';
        throw ApiError.badRequest(providerMsg);
      }
      const providerCapabilities = provider.getCapabilities();

      // ── Determine tool calling mode ────────────────────────────────────────
      const shouldUseNativeTools = modelProfile.supportsToolCalling
        && providerCapabilities.supportsToolCalling
        && !modelProfile.textOnlyMode
        && allowedContracts.length > 0;

      const shouldUseTextToolPlan = !shouldUseNativeTools
        && allowedContracts.length > 0
        && !!this.toolOrchestrator
        && !!runContext;

      if (modelProfile.supportsToolCalling && !providerCapabilities.supportsToolCalling) {
        runtimeWarnings.push(`Provider '${provider.providerName}' does not support native structured tool calling. Guarded text-plan mode may be used if the model proposes a valid ERP_TOOL_PLAN.`);
      }
      if (shouldUseTextToolPlan) {
        runtimeWarnings.push('Native structured tool calling is not available for this model/provider. The assistant may use guarded text-plan mode for read-only tools.');
      }

      const keywordHints = this.toolOrchestrator && typeof (this.toolOrchestrator as any).getKeywordHints === 'function'
        ? this.toolOrchestrator.getKeywordHints(message, allowedToolIds)
        : [];

      const isLikelySimpleChat = message.trim().length < 60
        && keywordHints.length === 0
        && selectedSkills.length <= 1;

      const toolPlanningContextMessage = !isLikelySimpleChat && this.toolOrchestrator && typeof (this.toolOrchestrator as any).buildToolPlanningContext === 'function'
        ? this.toolOrchestrator.buildToolPlanningContext(message, allowedContracts, {
            keywordHints,
            textPlanMode: shouldUseTextToolPlan,
            maxToolCalls: runContext?.maxToolCalls ?? 5,
          })
        : '';

      // ── Build provider messages ───────────────────────────────────────────
      const providerMessages: AiProviderRequest['messages'] = [
        {
          role: 'system',
          content: this.contextBuilder.buildSystemPrompt({
            toolContextMessage: null,
            proposalContextMessage,
            skillContext,
            modelProfile,
            toolPlanningContextMessage,
            recentToolDataContextMessage: recentToolDataContext.content,
            skipToolDescriptions: isLikelySimpleChat,
          }),
        },
        ...recentProviderMessages,
        { role: 'user' as const, content: message.trim() },
      ];

      // ── Context window overflow guard ──────────────────────────────────────
      if (modelProfile.maxContextTokens > 0) {
        const estimatedTokens = AiContextBuilder.estimateTokenCount(
          providerMessages.map(m => m.content || '').join(''),
        );
        if (estimatedTokens > modelProfile.maxContextTokens * 0.9) {
          runtimeWarnings.push(
            `The conversation context (~${estimatedTokens} tokens) is approaching the model's limit (${modelProfile.maxContextTokens} tokens). Some older context may be trimmed.`,
          );
          while (
            providerMessages.length > 2
            && AiContextBuilder.estimateTokenCount(providerMessages.map(m => m.content || '').join('')) > modelProfile.maxContextTokens * 0.85
          ) {
            const removeIndex = providerMessages.findIndex((m, i) => i > 0 && i < providerMessages.length - 1);
            if (removeIndex === -1) break;
            providerMessages.splice(removeIndex, 1);
          }
        }
      }

      const providerRequest: AiProviderRequest = {
        messages: providerMessages,
        maxTokens: config.maxTokensPerRequest,
        temperature: 0.7,
        ...(shouldUseNativeTools ? { tools: allowedContracts } : {}),
      };

      // ── Run tool planning loop ─────────────────────────────────────────────
      let result: SendChatMessageOutput;
      let usageLogStatus: 'success' | 'failure' = 'success';
      let usageLogErrorCode: string | undefined;
      let tokenCount: number | undefined;

      try {
        const planningResult = await this.planningLoop.execute({
          provider,
          maxTokens: config.maxTokensPerRequest,
          temperature: 0.7,
          initialMessages: providerMessages,
          shouldUseNativeTools,
          shouldUseTextToolPlan,
          allowedContracts,
          nameMapping,
          maxPlanningRounds: 4,
          runContext,
          companyId,
          userId,
          conversationId: convId,
          providerModelLabel: `${config.provider}/${config.model || 'unknown'}`,
          fallbackModel: config.model || 'unknown',
          fallbackProvider: config.provider,
        });

        const { finalResponse, usage, toolCallsRequested: loopToolCalls, toolResultSummaries } = planningResult;
        tokenCount = planningResult.tokenCount;
        toolResultsForMetadata = planningResult.structuredToolResultsForMetadata as unknown as ToolCallingResult[];
        toolCallsRequested.push(...loopToolCalls);

        // ── Save messages ──────────────────────────────────────────────────
        const { savedUserMessage, savedAssistantMessage } = await this.responsePersister.saveMessages({
          companyId, userId, conversationId: convId,
          message: message.trim(), config,
          finalResponse,
          aiRunId: runContext?.aiRunId ?? aiRunId,
          runContext, selectedSkills, allowedToolIds, modelProfile,
          runtimeWarnings, toolCallsRequested,
          toolResultsForMetadata,
          toolResultSummaries, proposalResultForMetadata,
        });

        result = {
          userMessage: savedUserMessage,
          assistantMessage: savedAssistantMessage,
          provider: finalResponse.provider,
          model: finalResponse.model,
          runtimeMeta: {
            aiRunId: runContext?.aiRunId ?? aiRunId,
            conversationId: convId,
            runtimeStatus: 'completed',
            selectedSkills,
            allowedToolIds,
            modelProfile: {
              provider: modelProfile.provider,
              modelName: modelProfile.modelName,
              status: modelProfile.status,
              supportsToolCalling: modelProfile.supportsToolCalling,
              textOnlyMode: modelProfile.textOnlyMode,
              warningLevel: modelProfile.warningLevel,
              warningMessage: modelProfile.warningMessage,
            },
            runtimeWarnings,
            toolCallsRequested,
            toolResults: toolResultSummaries.length > 0 ? toolResultSummaries : [],
            ...(proposalResultForMetadata ? { proposal: proposalResultForMetadata } : {}),
          },
        };

        // Audit: AI_RUN_COMPLETED
        this.responsePersister.auditLogSafe('AI_RUN_COMPLETED', {
          companyId, userId,
          conversationId: convId,
          aiRunId: runContext?.aiRunId ?? aiRunId,
          providerModel: `${config.provider}/${config.model || 'unknown'}`,
          selectedSkills, allowedToolIds,
          runtimeStatus: 'completed',
          toolCallsRequested,
          durationMs: Date.now() - startTime,
          tokenUsage: usage ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          } : undefined,
        });

        // Log successful usage
        await this.responsePersister.logUsage({
          companyId, userId,
          providerType: config.provider,
          model: config.model || finalResponse.model,
          messageCount: providerMessages.length,
          usage: usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, totalTokens: usage.totalTokens } : undefined,
          tokenCount,
          status: 'success',
          latencyMs: Date.now() - startTime,
        });

        // Debit credits (CREDITS mode only)
        await this.responsePersister.debitCredits({
          config: { runtimeMode: config.runtimeMode, companyId: config.companyId, provider: config.provider, model: config.model },
          aiRunId: runContext?.aiRunId ?? aiRunId,
          runContext,
          companyId, userId, conversationId: convId,
        });

        return result;
      } catch (error) {
        // Audit: AI_RUN_FAILED
        this.responsePersister.auditLogSafe('AI_RUN_FAILED', {
          companyId, userId,
          conversationId: convId,
          aiRunId: runContext?.aiRunId ?? aiRunId,
          providerModel: `${config.provider}/${config.model || 'unknown'}`,
          runtimeStatus: 'failed',
          errorMessage: (error as Error).message?.substring(0, 500),
          durationMs: Date.now() - startTime,
          tokenUsage: undefined,
        });

        // Log failed usage
        usageLogStatus = 'failure';
        if (error instanceof ProviderError) {
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

        await this.responsePersister.logUsage({
          companyId, userId,
          providerType: config.provider,
          model: config.model || 'unknown',
          messageCount: providerMessages.length,
          status: 'failure',
          errorCode: usageLogErrorCode,
          latencyMs: Date.now() - startTime,
        });

        throw error;
      }
    } finally {
      SendChatMessageUseCase.activeLocks.delete(lockKey);
    }
  }

  /**
   * Stream a chat response via SSE.
   *
   * Performs the same pre-checks as execute() (rate limit, config, credits, etc.)
   * but streams tokens as they arrive from the provider. Tool calls happen
   * server-side — tool_result events are yielded between token chunks.
   *
   * If the provider does not support chatStream(), falls back to calling
   * execute() and yielding the full response as a single token event.
   */
  async *executeStream(input: SendChatMessageInput): AsyncGenerator<AiStreamEvent> {
    const { companyId, userId, message, conversationId } = input;
    const startTime = Date.now();

    const aiRunId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    let runContext: AiRunContext | undefined;
    const runtimeWarnings: string[] = [];
    const toolCallsRequested: string[] = [];

    // 1. Validate input
    if (!message || message.trim().length === 0) {
      yield { type: 'error', message: 'Message content is required' };
      return;
    }
    if (message.length > 10000) {
      yield { type: 'error', message: 'Message content must not exceed 10,000 characters' };
      return;
    }

    // 2. Check and increment rate limit
    try {
      await this.rateLimiter.checkAndIncrement(companyId);
    } catch (error) {
      yield { type: 'error', message: error instanceof Error ? error.message : 'Rate limit exceeded' };
      return;
    }

    // 3. Get or create provider config
    let config: AiProviderConfig;
    try {
      let storedConfig = await this.settingsRepository.getConfig(companyId);
      if (!storedConfig) {
        config = AiProviderConfig.defaultForCompany(companyId);
      } else {
        config = this.credentialResolver.decryptConfig(storedConfig);
      }
      config = await this.credentialResolver.resolveRuntimeCredential(config);
    } catch (error) {
      yield { type: 'error', message: 'Failed to load AI configuration' };
      return;
    }

    // 4. Check if AI is enabled
    if (!config.isEnabled) {
      yield { type: 'error', message: 'AI Assistant is not enabled for this company.' };
      return;
    }

    // 5. Determine conversation ID
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 5b. Concurrent request deduplication
    const lockKey = `${companyId}:${userId}:${convId}`;
    if (SendChatMessageUseCase.activeLocks.has(lockKey)) {
      yield { type: 'error', message: 'A request is already being processed for this conversation. Please wait.' };
      return;
    }
    SendChatMessageUseCase.activeLocks.add(lockKey);

    try {
      // 6. Build model capability profile
      const modelProfile = await this.resolveModelProfile(config.provider, config.model);
      if (modelProfile.textOnlyMode) {
        runtimeWarnings.push(modelProfile.warningMessage || `Model '${config.model}' is running in text-only mode.`);
      }
      if (modelProfile.warningLevel === 'danger') {
        runtimeWarnings.push(`Model '${config.model}' on provider '${config.provider}' is not recognized.`);
      }

      // 7. Select domain skills
      let selectedSkills: string[] = ['base-orchestration'];
      if (this.skillRegistry) {
        const domainSkills = this.skillRegistry.selectDomainSkills(message);
        selectedSkills = ['base-orchestration', ...domainSkills.map(s => s.id)];
      }

      // 8. Build allowed tool contracts
      let allowedContracts: AiProviderToolContract[] = [];
      let nameMapping = new Map<string, string>();
      let allowedToolIds: string[] = [];

      if (this.toolOrchestrator && typeof (this.toolOrchestrator as any).buildAllowedToolContracts === 'function') {
        try {
          const contractsResult = await this.toolOrchestrator.buildAllowedToolContracts(userId, companyId, {
            providerConfig: config,
            routingGuard: this.modelRoutingGuard,
          });
          allowedContracts = contractsResult.contracts;
          nameMapping = contractsResult.nameMapping;
          allowedToolIds = contractsResult.allowedToolIds;
        } catch (error) {
          console.warn(`[AI Assistant Stream] Failed to build allowed tool contracts: ${(error as Error).message}`);
        }
      }

      // 9. Create AiRunContext
      const toolRoutingDecision = this.modelRoutingGuard
        ? await this.modelRoutingGuard.validateSensitiveWorkflow({
            tenantId: companyId,
            config,
            category: 'TOOL_CALLING',
          })
        : undefined;

      if (this.modelRoutingGuard && !toolRoutingDecision?.allowed) {
        runtimeWarnings.push(toolRoutingDecision?.reason || 'This model profile is not certified for ERP tool workflows.');
        allowedContracts = [];
        nameMapping = new Map();
        allowedToolIds = [];
      }

      if (this.runtimeGuard) {
        runContext = this.runtimeGuard.createRun({
          companyId,
          userId,
          conversationId: convId,
          allowedToolIds,
          providerModel: `${config.provider}/${config.model || 'unknown'}`,
          certification: toolRoutingDecision,
          maxToolCalls: 5,
          ttlMs: 5 * 60 * 1000,
        });
      }

      // 10. Audit: AI_RUN_STARTED
      this.responsePersister.auditLogSafe('AI_RUN_STARTED', {
        companyId, userId, conversationId: convId,
        aiRunId: runContext?.aiRunId ?? aiRunId,
        providerModel: `${config.provider}/${config.model || 'unknown'}`,
        selectedSkills, allowedToolIds,
      });

      // ── Build conversation context ─────────────────────────────────────
      const contextBudget = this.contextBuilder.resolveConversationContextBudget(config);
      const recentMessages = await this.chatRepository.getConversationMessages(
        companyId, userId, convId, contextBudget.fetchMessageLimit
      );
      const recentToolDataContext = this.contextBuilder.buildRecentToolDataContext(recentMessages, contextBudget);
      let historyContextWasTrimmed = recentMessages.length > contextBudget.providerHistoryMessageLimit;
      const recentProviderMessages = recentMessages
        .slice(-contextBudget.providerHistoryMessageLimit)
        .map(m => {
          const trimmedContent = this.contextBuilder.truncateForPrompt(
            m.content,
            contextBudget.providerHistoryMessageCharLimit,
          );
          if (trimmedContent.wasTruncated) {
            historyContextWasTrimmed = true;
          }
          return { role: m.role as 'user' | 'assistant' | 'system', content: trimmedContent.text };
        });

      if (historyContextWasTrimmed || recentToolDataContext.wasTruncated) {
        runtimeWarnings.push(
          'Conversation context was limited to control AI token cost.',
        );
      }

      // ── Build skill context ──────────────────────────────────────────────
      let skillContext = '';
      if (this.skillRegistry) {
        skillContext = this.skillRegistry.buildSkillContext(message);
      }

      // ── Create provider ───────────────────────────────────────────────────
      let provider: IAiProvider;
      try {
        provider = ProviderFactory.getProvider(config, this.httpClient);
      } catch (providerError) {
        const providerMsg = providerError instanceof ProviderProviderError
          ? providerError.message
          : 'AI provider could not be initialized.';
        yield { type: 'error', message: providerMsg };
        return;
      }
      const providerCapabilities = provider.getCapabilities();

      // ── Determine tool calling mode ────────────────────────────────────────
      const shouldUseNativeTools = modelProfile.supportsToolCalling
        && providerCapabilities.supportsToolCalling
        && !modelProfile.textOnlyMode
        && allowedContracts.length > 0;

      const shouldUseTextToolPlan = !shouldUseNativeTools
        && allowedContracts.length > 0
        && !!this.toolOrchestrator
        && !!runContext;

      // ── Build provider messages ───────────────────────────────────────────
      const keywordHints = this.toolOrchestrator && typeof (this.toolOrchestrator as any).getKeywordHints === 'function'
        ? this.toolOrchestrator.getKeywordHints(message, allowedToolIds)
        : [];

      const isLikelySimpleChat = message.trim().length < 60
        && keywordHints.length === 0
        && selectedSkills.length <= 1;

      const toolPlanningContextMessage = !isLikelySimpleChat && this.toolOrchestrator && typeof (this.toolOrchestrator as any).buildToolPlanningContext === 'function'
        ? this.toolOrchestrator.buildToolPlanningContext(message, allowedContracts, {
            keywordHints,
            textPlanMode: shouldUseTextToolPlan,
            maxToolCalls: runContext?.maxToolCalls ?? 5,
          })
        : '';

      const providerMessages: AiProviderRequest['messages'] = [
        {
          role: 'system',
          content: this.contextBuilder.buildSystemPrompt({
            toolContextMessage: null,
            proposalContextMessage: null,
            skillContext,
            modelProfile,
            toolPlanningContextMessage,
            recentToolDataContextMessage: recentToolDataContext.content,
            skipToolDescriptions: isLikelySimpleChat,
          }),
        },
        ...recentProviderMessages,
        { role: 'user' as const, content: message.trim() },
      ];

      // ── Context window overflow guard ──────────────────────────────────────
      if (modelProfile.maxContextTokens > 0) {
        const estimatedTokens = AiContextBuilder.estimateTokenCount(
          providerMessages.map(m => m.content || '').join(''),
        );
        if (estimatedTokens > modelProfile.maxContextTokens * 0.9) {
          runtimeWarnings.push(
            `Conversation context (~${estimatedTokens} tokens) approaching model limit (${modelProfile.maxContextTokens} tokens).`,
          );
          while (
            providerMessages.length > 2
            && AiContextBuilder.estimateTokenCount(providerMessages.map(m => m.content || '').join('')) > modelProfile.maxContextTokens * 0.85
          ) {
            const removeIndex = providerMessages.findIndex((m, i) => i > 0 && i < providerMessages.length - 1);
            if (removeIndex === -1) break;
            providerMessages.splice(removeIndex, 1);
          }
        }
      }

      const providerRequest: AiProviderRequest = {
        messages: providerMessages,
        maxTokens: config.maxTokensPerRequest,
        temperature: 0.7,
        ...(shouldUseNativeTools ? { tools: allowedContracts } : {}),
      };

      // ── Stream from provider ──────────────────────────────────────────────
      // If provider supports streaming, use it; otherwise fall back to execute()
      if (typeof provider.chatStream === 'function') {
        let fullContent = '';
        let streamProvider = '';
        let streamModel = '';
        let streamUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

        try {
          for await (const event of provider.chatStream(providerRequest)) {
            switch (event.type) {
              case 'token':
                fullContent += event.content;
                yield { type: 'token', content: event.content };
                break;

              case 'tool_call': {
                toolCallsRequested.push(event.toolName);

                // Execute the tool server-side if orchestrator is available
                if (this.toolOrchestrator && runContext) {
                  try {
                    const structuredCall = {
                      id: event.toolCallId || `stream_tc_${toolCallsRequested.length}`,
                      name: event.toolName,
                      arguments: event.toolArgs,
                    };

                    const structuredResults = await this.toolOrchestrator.executeStructuredToolCalls(
                      runContext.aiRunId,
                      [structuredCall],
                      nameMapping,
                      companyId,
                      userId,
                    );

                    for (const result of structuredResults) {
                      const auditEventType = result.approved ? 'AI_TOOL_CALL_APPROVED' : 'AI_TOOL_CALL_REJECTED';
                      this.responsePersister.auditLogSafe(auditEventType as 'AI_TOOL_CALL_APPROVED' | 'AI_TOOL_CALL_REJECTED', {
                        companyId, userId, conversationId: convId,
                        aiRunId: runContext.aiRunId,
                        providerModel: `${config.provider}/${config.model || 'unknown'}`,
                        resolvedOriginalName: result.toolName,
                        operationType: 'READ',
                        rejectionReason: result.rejectionReason,
                        rejectionCode: result.rejectionCode,
                        toolCallKeys: Object.keys(event.toolArgs),
                      });

                      yield {
                        type: 'tool_result',
                        toolName: result.toolName,
                        data: result.result?.data ?? null,
                        approved: result.approved,
                      };
                    }
                  } catch (toolError) {
                    console.warn(`[AI Assistant Stream] Tool execution failed: ${(toolError as Error).message}`);
                    yield {
                      type: 'tool_result',
                      toolName: event.toolName,
                      data: { error: 'Tool execution failed' },
                      approved: false,
                    };
                  }
                }
                break;
              }

              case 'done':
                streamProvider = event.metadata.provider;
                streamModel = event.metadata.model;
                streamUsage = event.metadata.usage;
                break;

              case 'error':
                yield { type: 'error', message: event.message };
                return;
            }
          }
        } catch (streamError) {
          yield {
            type: 'error',
            message: streamError instanceof Error ? streamError.message : 'Streaming error occurred.',
          };

          this.responsePersister.auditLogSafe('AI_RUN_FAILED', {
            companyId, userId, conversationId: convId,
            aiRunId: runContext?.aiRunId ?? aiRunId,
            providerModel: `${config.provider}/${config.model || 'unknown'}`,
            runtimeStatus: 'failed',
            errorMessage: (streamError as Error).message?.substring(0, 500),
            durationMs: Date.now() - startTime,
          });

          return;
        }

        // ── Save messages after streaming completes ───────────────────────
        try {
          const assistantContent = fullContent || 'I was unable to generate a response. Please try again.';
          const finalResponse = {
            content: assistantContent,
            model: streamModel || config.model || 'unknown',
            provider: streamProvider || config.provider,
            tokenCount: streamUsage?.totalTokens,
            runtimeMeta: {
              modelUsed: streamModel || config.model || 'unknown',
              capabilities: providerCapabilities,
            },
          };

          await this.responsePersister.saveMessages({
            companyId, userId, conversationId: convId,
            message: message.trim(), config,
            finalResponse, aiRunId: runContext?.aiRunId ?? aiRunId,
            runContext, selectedSkills, allowedToolIds, modelProfile,
            runtimeWarnings, toolCallsRequested,
            toolResultsForMetadata: [],
            toolResultSummaries: [],
            proposalResultForMetadata: null,
          });

          await this.responsePersister.logUsage({
            companyId, userId,
            providerType: config.provider,
            model: config.model || streamModel || 'unknown',
            messageCount: providerMessages.length,
            usage: streamUsage
              ? { promptTokens: streamUsage.promptTokens, completionTokens: streamUsage.completionTokens, totalTokens: streamUsage.totalTokens }
              : undefined,
            tokenCount: streamUsage?.totalTokens,
            status: 'success',
            latencyMs: Date.now() - startTime,
          });

          await this.responsePersister.debitCredits({
            config: { runtimeMode: config.runtimeMode, companyId: config.companyId, provider: config.provider, model: config.model },
            aiRunId: runContext?.aiRunId ?? aiRunId,
            runContext, companyId, userId, conversationId: convId,
          });

          this.responsePersister.auditLogSafe('AI_RUN_COMPLETED', {
            companyId, userId, conversationId: convId,
            aiRunId: runContext?.aiRunId ?? aiRunId,
            providerModel: `${config.provider}/${config.model || 'unknown'}`,
            selectedSkills, allowedToolIds,
            runtimeStatus: 'completed',
            toolCallsRequested,
            durationMs: Date.now() - startTime,
            tokenUsage: streamUsage ? {
              promptTokens: streamUsage.promptTokens,
              completionTokens: streamUsage.completionTokens,
              totalTokens: streamUsage.totalTokens,
            } : undefined,
          });

          // Yield final done event with full metadata
          const doneMetadata: AiStreamDoneMetadata = {
            provider: streamProvider || config.provider,
            model: streamModel || config.model || 'unknown',
            runtimeMeta: {
              aiRunId: runContext?.aiRunId ?? aiRunId,
              conversationId: convId,
              runtimeStatus: 'completed',
              selectedSkills,
              allowedToolIds,
              modelProfile: {
                provider: modelProfile.provider,
                modelName: modelProfile.modelName,
                status: modelProfile.status,
                supportsToolCalling: modelProfile.supportsToolCalling,
                textOnlyMode: modelProfile.textOnlyMode,
                warningLevel: modelProfile.warningLevel,
                warningMessage: modelProfile.warningMessage,
              },
              runtimeWarnings,
              toolCallsRequested,
              toolResults: [],
            },
            usage: streamUsage,
          };

          yield { type: 'done', metadata: doneMetadata };
        } catch (persistError) {
          // Streaming completed but persistence failed — yield done anyway
          // since the user already received the streaming content.
          console.warn(`[AI Assistant Stream] Persistence error: ${(persistError as Error).message}`);

          yield {
            type: 'done',
            metadata: {
              provider: streamProvider || config.provider,
              model: streamModel || config.model || 'unknown',
              runtimeMeta: {
                aiRunId: runContext?.aiRunId ?? aiRunId,
                conversationId: convId,
                runtimeStatus: 'completed',
                selectedSkills,
                allowedToolIds,
                modelProfile: {
                  provider: modelProfile.provider,
                  modelName: modelProfile.modelName,
                  status: modelProfile.status,
                  supportsToolCalling: modelProfile.supportsToolCalling,
                  textOnlyMode: modelProfile.textOnlyMode,
                  warningLevel: modelProfile.warningLevel,
                  warningMessage: modelProfile.warningMessage,
                },
                runtimeWarnings,
                toolCallsRequested,
                toolResults: [],
              },
              usage: streamUsage,
            },
          };
        }
      } else {
        // ── Fallback: provider doesn't support streaming ──────────────────────
        // Use the existing execute() method and yield the full response
        try {
          const result = await this.execute(input);

          // Yield content tokens in chunks for a realistic streaming feel
          if (result.assistantMessage.content) {
            const content = result.assistantMessage.content;
            const chunkSize = 20; // Yield 20 chars at a time
            for (let i = 0; i < content.length; i += chunkSize) {
              yield { type: 'token', content: content.slice(i, i + chunkSize) };
            }
          }

          yield {
            type: 'done',
            metadata: {
              provider: result.provider,
              model: result.model,
              runtimeMeta: result.runtimeMeta,
              usage: result.runtimeMeta?.toolResults
                ? undefined
                : undefined,
            },
          };
        } catch (fallbackError) {
          yield {
            type: 'error',
            message: fallbackError instanceof Error ? fallbackError.message : 'Failed to get AI response.',
          };
        }
      }
    } finally {
      SendChatMessageUseCase.activeLocks.delete(lockKey);
    }
  }

  private async resolveModelProfile(provider: string, modelName: string | null | undefined): Promise<AiModelProfile> {
    if (this.modelProfileUseCase) {
      return this.modelProfileUseCase.resolveRuntimeProfile(provider, modelName);
    }
    return AiModelCapabilityCatalog.getProfile(provider, modelName);
  }
}