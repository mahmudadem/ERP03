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
import { IAiPlatformRuntimeProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiPlatformRuntimeProfileRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { IAiConversationMetaRepository } from '../../../repository/interfaces/ai-assistant/IAiConversationMetaRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory, ProviderProviderError } from '../providers/ProviderFactory';
import { IAiProvider, AiProviderRequest } from '../providers/IAiProvider';
import { AiRateLimiterService } from '../services/AiRateLimiterService';
import { AiToolCallingOrchestrator, ToolCallingResult } from '../services/AiToolCallingOrchestrator';
import { AiRuntimeGuard, AiRunContext } from '../services/AiRuntimeGuard';
import { AiModelProfile } from '../services/AiModelCapabilityCatalog';
import { AiSkillRegistry } from '../skills/AiSkillRegistry';
import { AiProviderToolContract } from '../../../domain/ai-assistant/tools/AiToolContract';
import { ProviderError } from '../../../errors/ProviderErrors';
import { ApiError } from '../../../api/errors/ApiError';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../platform/ModuleAvailabilityService';
import { AiProposalGeneratorRegistry } from '../proposals/AiProposalGeneratorRegistry';
import { CreateAiProposalUseCase } from './CreateAiProposalUseCase';
import { AiModelProfileUseCase } from './AiModelProfileUseCase';
import { AiModelRoutingGuard } from '../services/AiModelRoutingGuard';
import { AiCredentialResolver } from '../services/AiCredentialResolver';
import { AiContextBuilder } from '../services/AiContextBuilder';
import { AiToolPlanningLoop } from '../services/AiToolPlanningLoop';
import { AiResponsePersister } from '../services/AiResponsePersister';
import { SendChatMessageInput, SendChatMessageOutput } from './SendChatMessageTypes';
import { upsertConversationMeta, resolveModelProfile } from '../services/chatMessageHelpers';

// Lazy reference to StreamChatMessageUseCase to avoid circular import at module load.
// Resolved on first call to isStreamLockActive().
let _StreamChatMessageUseCase: typeof import('./StreamChatMessageUseCase').StreamChatMessageUseCase | undefined;

function isStreamLockActive(lockKey: string): boolean {
  if (!_StreamChatMessageUseCase) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _StreamChatMessageUseCase = require('./StreamChatMessageUseCase').StreamChatMessageUseCase;
  }
  return _StreamChatMessageUseCase.isLockActive(lockKey);
}

export { SendChatMessageInput, SendChatMessageOutput } from './SendChatMessageTypes';

export class SendChatMessageUseCase {
  private static activeLocks = new Set<string>();
  private rateLimiter: AiRateLimiterService;
  private credentialResolver: AiCredentialResolver;
  private contextBuilder: AiContextBuilder;
  private planningLoop: AiToolPlanningLoop;
  private responsePersister: AiResponsePersister;

  /** Check if a lock key is currently active (used by StreamChatMessageUseCase for deduplication). */
  static isLockActive(lockKey: string): boolean {
    return SendChatMessageUseCase.activeLocks.has(lockKey);
  }

  /** Acquire a cross-use-case lock key (used by StreamChatMessageUseCase for deduplication). */
  static acquireLock(lockKey: string): void {
    SendChatMessageUseCase.activeLocks.add(lockKey);
  }

  /** Release a cross-use-case lock key (used by StreamChatMessageUseCase for deduplication). */
  static releaseLock(lockKey: string): void {
    SendChatMessageUseCase.activeLocks.delete(lockKey);
  }

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
    private runtimeProfileRepository?: IAiPlatformRuntimeProfileRepository,
    private conversationMetaRepository?: IAiConversationMetaRepository,
    private modelProfileRepository?: IAiModelProfileRepository,
  ) {
    this.rateLimiter = new AiRateLimiterService(settingsRepository);
    this.credentialResolver = new AiCredentialResolver(encryptionService, providerRepository, creditLedgerRepository, runtimeProfileRepository, modelProfileRepository);
    this.contextBuilder = new AiContextBuilder(toolOrchestrator);
    this.planningLoop = new AiToolPlanningLoop(toolOrchestrator, runtimeGuard, auditService);
    this.responsePersister = new AiResponsePersister(chatRepository, usageLogRepository, creditLedgerRepository, auditService, runtimeProfileRepository, modelProfileRepository);
  }

  /**
   * Execute the synchronous chat flow.
   *
   * @param input                The chat message input.
   * @param skipRateLimitCheck   When true, skips the rate limit check.
   *                             Used by StreamChatMessageUseCase fallback path to avoid
   *                             double-counting (the stream path already checked rate limits).
   */
  async execute(input: SendChatMessageInput, skipRateLimitCheck = false): Promise<SendChatMessageOutput> {
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

    // 2. Check and increment rate limit (per-user burst + per-company daily)
    //    Skip when called from stream fallback — rate limit was already checked there.
    if (!skipRateLimitCheck) {
      await this.rateLimiter.checkAndIncrement(companyId, userId);
    }

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

    // 4b. Defense-in-depth: verify AI Assistant module availability in the module registry.
    //     The primary entitlement check is in the HTTP middleware (companyModuleGuard).
    try {
      const moduleService = ModuleAvailabilityService.getInstance();
      const info = moduleService.getAvailabilityInfo('ai-assistant');
      if (info) {
        if (info.state === ModuleAvailabilityState.SUSPENDED) {
          throw ApiError.locked('AI Assistant module is temporarily unavailable due to maintenance. Please try again later.');
        }
        if (info.state !== ModuleAvailabilityState.AVAILABLE) {
          runtimeWarnings.push(`AI Assistant module state: ${info.state}. Contact SuperAdmin if issues persist.`);
        }
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in (err as Record<string, unknown>)) throw err;
      console.warn(`[ModuleEntitlement] Could not verify module availability for company ${companyId}:`, err);
    }

    // 5. Determine conversation ID
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 5b. Concurrent request deduplication
    //     Check BOTH our own lock set AND the stream use case's lock set
    //     to prevent sync and stream requests racing on the same conversation.
    const lockKey = `${companyId}:${userId}:${convId}`;
    if (SendChatMessageUseCase.activeLocks.has(lockKey) || isStreamLockActive(lockKey)) {
      throw ApiError.conflict('A request is already being processed for this conversation. Please wait.');
    }
    SendChatMessageUseCase.activeLocks.add(lockKey);

    try {
      // 6. Build model capability profile
      const modelProfile = await resolveModelProfile(this.modelProfileUseCase, companyId, config.provider, config.model, config.selectedModelProfileId);
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
      } else if (toolRoutingDecision?.warning) {
        runtimeWarnings.push(toolRoutingDecision.reason || 'This model profile has a WARNING certification status. Use with caution.');
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
            skipToolDescriptions: isLikelySimpleChat || !toolRoutingDecision?.allowed,
            noToolsAvailable: allowedContracts.length === 0,
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

        // ── Update conversation metadata (title + message count) ────────
        await upsertConversationMeta(this.conversationMetaRepository, {
          companyId, userId, conversationId: convId, message: message.trim(),
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
              status: toolRoutingDecision?.certificationId ? 'CERTIFIED' : modelProfile.status,
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
          providerId: config.providerId,
          selectedModelProfileId: config.selectedModelProfileId,
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
}
