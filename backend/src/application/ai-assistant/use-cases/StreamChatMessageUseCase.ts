/**
 * StreamChatMessageUseCase - SSE streaming for AI Assistant chat
 *
 * Extracted from SendChatMessageUseCase per Phase 3.3 architecture split.
 * This use case owns the streaming (SSE) chat flow end-to-end.
 *
 * It performs the same pre-checks as the sync flow (rate limit, config, credits,
 * context building, etc.) but streams tokens as they arrive from the provider.
 * Tool calls happen server-side — tool_result events are yielded between
 * token chunks.
 *
 * If the provider does not support chatStream(), falls back to calling
 * SendChatMessageUseCase.execute() and yielding the full response as
 * simulated streaming tokens.
 *
 * Delegates to focused services:
 * - AiCredentialResolver: credential decryption and resolution
 * - AiContextBuilder: system prompt and conversation context
 * - AiResponsePersister: message saving, usage logging, credit debiting
 * - chatMessageHelpers: shared helpers (upsertConversationMeta, generateTitle, resolveModelProfile)
 */

import { IAiChatRepository } from '../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IAiUsageLogRepository } from '../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';
import { IAiCreditLedgerRepository } from '../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';
import { IAiConversationMetaRepository } from '../../../repository/interfaces/ai-assistant/IAiConversationMetaRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory, ProviderProviderError } from '../providers/ProviderFactory';
import { IAiProvider, AiProviderRequest, AiStreamEvent as ProviderStreamEvent } from '../providers/IAiProvider';
import { AiRateLimiterService } from '../services/AiRateLimiterService';
import { AiToolCallingOrchestrator } from '../services/AiToolCallingOrchestrator';
import { AiRuntimeGuard, AiRunContext } from '../services/AiRuntimeGuard';
import { AiModelRoutingGuard } from '../services/AiModelRoutingGuard';
import { AiModelProfile } from '../services/AiModelCapabilityCatalog';
import { AiSkillRegistry } from '../skills/AiSkillRegistry';
import { AiProviderToolContract } from '../../../domain/ai-assistant/tools/AiToolContract';
import { ApiError } from '../../../api/errors/ApiError';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../platform/ModuleAvailabilityService';
import { AiModelProfileUseCase } from './AiModelProfileUseCase';
import { AiCredentialResolver } from '../services/AiCredentialResolver';
import { AiContextBuilder } from '../services/AiContextBuilder';
import { AiResponsePersister } from '../services/AiResponsePersister';
import { SendChatMessageInput } from './SendChatMessageTypes';
import { AiStreamEvent, AiStreamDoneMetadata } from './SendChatMessageStreamTypes';
import { upsertConversationMeta, resolveModelProfile } from '../services/chatMessageHelpers';
import { SendChatMessageUseCase } from './SendChatMessageUseCase';

export class StreamChatMessageUseCase {
  private static activeLocks = new Set<string>();

  /** Check if a lock key is currently active (used by SendChatMessageUseCase for symmetric cross-lock deduplication). */
  static isLockActive(lockKey: string): boolean {
    return StreamChatMessageUseCase.activeLocks.has(lockKey);
  }

  private rateLimiter: AiRateLimiterService;
  private credentialResolver: AiCredentialResolver;
  private contextBuilder: AiContextBuilder;
  private responsePersister: AiResponsePersister;

  /** @param sendChatMessageUseCase DI-injected sync use case for the non-streaming fallback path. */
  constructor(
    private chatRepository: IAiChatRepository,
    private settingsRepository: IAiSettingsRepository,
    private encryptionService: IEncryptionService,
    private httpClient: IHttpClient,
    private usageLogRepository?: IAiUsageLogRepository,
    private toolOrchestrator?: AiToolCallingOrchestrator,
    private runtimeGuard?: AiRuntimeGuard,
    private auditService?: import('../services/AiAuditService').AiAuditService,
    private skillRegistry?: AiSkillRegistry,
    private modelProfileUseCase?: AiModelProfileUseCase,
    private modelRoutingGuard?: AiModelRoutingGuard,
    private providerRepository?: IAiProviderRepository,
    private creditLedgerRepository?: IAiCreditLedgerRepository,
    private conversationMetaRepository?: IAiConversationMetaRepository,
    private sendChatMessageUseCase?: SendChatMessageUseCase,
  ) {
    this.rateLimiter = new AiRateLimiterService(settingsRepository);
    this.credentialResolver = new AiCredentialResolver(encryptionService, providerRepository, creditLedgerRepository);
    this.contextBuilder = new AiContextBuilder(toolOrchestrator);
    this.responsePersister = new AiResponsePersister(chatRepository, usageLogRepository, creditLedgerRepository, auditService);
  }

  /**
   * Stream a chat response via SSE.
   *
   * Performs the same pre-checks as SendChatMessageUseCase.execute() (rate limit,
   * config, credits, etc.) but streams tokens as they arrive from the provider.
   * Tool calls happen server-side — tool_result events are yielded between
   * token chunks.
   *
   * If the provider does not support chatStream(), falls back to calling
   * execute() and yielding the full response as simulated streaming tokens.
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
      await this.rateLimiter.checkAndIncrement(companyId, userId);
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

    // 4b. Defense-in-depth: verify AI Assistant module availability in the module registry.
    try {
      const moduleService = ModuleAvailabilityService.getInstance();
      const info = moduleService.getAvailabilityInfo('ai-assistant');
      if (info && info.state === ModuleAvailabilityState.SUSPENDED) {
        yield { type: 'error', message: 'AI Assistant module is temporarily unavailable due to maintenance.' };
        return;
      }
    } catch (err) {
      console.warn(`[ModuleEntitlement] Could not verify module availability for company ${companyId}:`, err);
    }

    // 5. Determine conversation ID
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 5b. Concurrent request deduplication
    const lockKey = `${companyId}:${userId}:${convId}`;
    if (StreamChatMessageUseCase.activeLocks.has(lockKey) || SendChatMessageUseCase.isLockActive(lockKey)) {
      yield { type: 'error', message: 'A request is already being processed for this conversation. Please wait.' };
      return;
    }
    StreamChatMessageUseCase.activeLocks.add(lockKey);

    try {
      // 6. Build model capability profile
      const modelProfile = await resolveModelProfile(this.modelProfileUseCase, config.provider, config.model);
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

          // ── Update conversation metadata (title + message count) ──────
          await upsertConversationMeta(this.conversationMetaRepository, {
            companyId, userId, conversationId: convId, message: message.trim(),
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
        // Use the DI-injected SendChatMessageUseCase and pass skipRateLimitCheck=true
        // to avoid double-counting the rate limit (we already checked it above).
        // Bug 1 fix: skipRateLimitCheck=true prevents double rate limit debit.
        // Bug 3 fix: use DI-injected sendChatMessageUseCase instead of `new SendChatMessageUseCase(...)`.
        try {
          if (!this.sendChatMessageUseCase) {
            // Safety net: if not injected via DI, we cannot safely fall back without
            // risking double rate-limit debit. Yield an error instead.
            yield { type: 'error', message: 'Streaming not supported by this provider and fallback is unavailable.' };
            return;
          }
          const result = await this.sendChatMessageUseCase.execute(input, true /* skipRateLimitCheck */);

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
      StreamChatMessageUseCase.activeLocks.delete(lockKey);
    }
  }
}