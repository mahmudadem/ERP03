/**
 * AiResponsePersister - Handles message persistence and usage logging for AI chat
 *
 * Handles:
 * - Creating and saving user and assistant AiChatMessage objects
 * - Creating and saving AiUsageLog entries (success and failure)
 * - Debiting AI credits after successful responses (CREDITS mode)
 * - Audit logging helper
 *
 * DESIGN PRINCIPLES:
 * - All persistence operations are offloaded from the use case orchestrator
 * - Audit log failures never block the chat flow
 * - Credit debit failures only block on "Insufficient AI credits"
 */

import { IAiChatRepository } from '../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { IAiUsageLogRepository } from '../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';
import { IAiCreditLedgerRepository } from '../../../repository/interfaces/ai-assistant/IAiCreditLedgerRepository';
import { IAiPlatformRuntimeProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiPlatformRuntimeProfileRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { AiChatMessage } from '../../../domain/ai-assistant/entities/AiChatMessage';
import { AiUsageLog } from '../../../domain/ai-assistant/entities/AiUsageLog';
import { AiAuditService, AiAuditMeta } from './AiAuditService';
import { ApiError } from '../../../api/errors/ApiError';
import { ToolCallingResult } from './AiToolCallingOrchestrator';
import { AiModelProfile } from './AiModelCapabilityCatalog';
import { AiRunContext } from './AiRuntimeGuard';
import { AiProviderResponse } from '../providers/IAiProvider';
import { AiResponseSanitizer } from './AiResponseSanitizer';

export interface SaveMessagesInput {
  companyId: string;
  userId: string;
  conversationId: string;
  message: string;
  config: { provider: string; model?: string };
  finalResponse: AiProviderResponse;
  aiRunId: string;
  runContext?: AiRunContext;
  selectedSkills: string[];
  allowedToolIds: string[];
  modelProfile: AiModelProfile;
  runtimeWarnings: string[];
  toolCallsRequested: string[];
  toolResultsForMetadata: ToolCallingResult[];
  toolResultSummaries: Array<{ toolName: string; approved: boolean; rejectionReason?: string }>;
  proposalResultForMetadata: Record<string, unknown> | null;
}

export interface SaveMessagesResult {
  savedUserMessage: AiChatMessage;
  savedAssistantMessage: AiChatMessage;
}

export interface LogUsageInput {
  companyId: string;
  userId: string;
  providerType: string;
  model: string;
  messageCount: number;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  tokenCount?: number;
  status: 'success' | 'failure';
  errorCode?: string;
  latencyMs: number;
}

export interface DebitCreditsInput {
  config: { runtimeMode?: string; companyId: string; provider: string; model?: string };
  providerId?: string;
  selectedModelProfileId?: string;
  aiRunId: string;
  runContext?: AiRunContext;
  companyId: string;
  userId: string;
  conversationId: string;
}

export class AiResponsePersister {
  constructor(
    private chatRepository: IAiChatRepository,
    private usageLogRepository?: IAiUsageLogRepository,
    private creditLedgerRepository?: IAiCreditLedgerRepository,
    private auditService?: AiAuditService,
    private runtimeProfileRepository?: IAiPlatformRuntimeProfileRepository,
    private modelProfileRepository?: IAiModelProfileRepository,
  ) {}

  /**
   * Create and persist user and assistant chat messages.
   */
  async saveMessages(input: SaveMessagesInput): Promise<SaveMessagesResult> {
    const {
      companyId,
      userId,
      conversationId,
      message,
      config,
      finalResponse,
      aiRunId,
      runContext,
      selectedSkills,
      allowedToolIds,
      modelProfile,
      runtimeWarnings,
      toolCallsRequested,
      toolResultsForMetadata,
      toolResultSummaries,
      proposalResultForMetadata,
    } = input;

    const userMessage = AiChatMessage.create({
      companyId,
      userId,
      conversationId,
      role: 'user',
      content: message,
      provider: config.provider,
      model: config.model,
    });
    const savedUserMessage = await this.chatRepository.create(userMessage);

    // Ensure assistant content is never null — safe string even for tool-call-only first responses
    const rawAssistantContent = finalResponse.content || '[Processing complete. Please see the data above.]';

    // Strip hallucinated tool-call blocks. When the model only had real tools
    // available and used them, this is a no-op. When tools were stripped
    // (no certified profile, text-only mode, blocked) and the model still
    // emitted <tool_code>/<tool_output>/etc. blocks, the sanitizer replaces
    // them with a visible warning and pushes a user-facing notice into
    // runtimeWarnings so the chat UI can flag the misbehavior.
    const sanitizeResult = AiResponseSanitizer.sanitize(rawAssistantContent);
    const assistantContent = sanitizeResult.text || '[Processing complete. Please see the data above.]';
    if (sanitizeResult.modified && sanitizeResult.warning) {
      runtimeWarnings.push(sanitizeResult.warning);
    }

    const assistantMessage = AiChatMessage.create({
      companyId,
      userId,
      conversationId,
      role: 'assistant',
      content: assistantContent,
      provider: finalResponse.provider,
      model: finalResponse.model,
      metadata: {
        ...(finalResponse.metadata || {}),
        aiRunId: runContext?.aiRunId ?? aiRunId,
        conversationId,
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
        toolResults: toolResultsForMetadata,
        ...(toolResultSummaries.length > 0 ? { toolCallResults: toolResultSummaries } : {}),
        ...(proposalResultForMetadata ? { proposal: proposalResultForMetadata } : {}),
        ...(sanitizeResult.modified ? { responseSanitized: { matchedPatterns: sanitizeResult.matchedPatterns } } : {}),
      },
    });
    assistantMessage.tokenCount = finalResponse.tokenCount;

    const savedAssistantMessage = await this.chatRepository.create(assistantMessage);

    return { savedUserMessage, savedAssistantMessage };
  }

  /**
   * Create and persist an AI usage log entry.
   */
  async logUsage(input: LogUsageInput): Promise<void> {
    if (!this.usageLogRepository) return;

    const usageLog = AiUsageLog.create({
      companyId: input.companyId,
      userId: input.userId,
      providerType: input.providerType,
      model: input.model,
      messageCount: input.messageCount,
      promptTokens: input.usage?.promptTokens,
      completionTokens: input.usage?.completionTokens,
      totalTokens: input.usage?.totalTokens ?? input.tokenCount,
      status: input.status,
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
    });

    await this.usageLogRepository.create(usageLog).catch(err => {
      console.warn('[AI Assistant] Failed to log usage:', (err as Error).message);
    });
  }

  /**
   * Debit 1 credit after successful AI response (CREDITS mode only).
   * Throws on "Insufficient AI credits" error; other debit failures are non-critical.
   */
  async debitCredits(input: DebitCreditsInput): Promise<void> {
    const { config, aiRunId, runContext, companyId, userId, conversationId } = input;
    const resolvedRuntimeMode = config.runtimeMode || 'BYOK';

    if (resolvedRuntimeMode !== 'CREDITS' || !this.creditLedgerRepository) {
      return;
    }

    try {
      const ledger = await this.creditLedgerRepository.getByCompanyId(companyId);
      if (ledger) {
        const cost = await this.resolveCreditCost(input.selectedModelProfileId);
        if (cost > 0) {
          ledger.debit(cost, `chat_request_${runContext?.aiRunId ?? aiRunId}`);
          await this.creditLedgerRepository.save(ledger);
        }
      }
      // Runtime profile counter was already incremented atomically by
      // AiCredentialResolver.tryReserveRuntimeSlot() at pre-flight. No second increment here.
    } catch (debitError) {
      if (debitError instanceof Error && debitError.message.includes('Insufficient AI credits')) {
        throw ApiError.forbidden('Insufficient AI credits. Please purchase more credits or switch to BYOK mode.');
      }
      // Non-critical debit failure — audit log for observability, then continue
      this.auditLogSafe('AI_CREDIT_DEBIT_FAILED', {
        companyId,
        userId,
        conversationId,
        aiRunId: runContext?.aiRunId ?? aiRunId,
        providerModel: `${config.provider}/${config.model || 'unknown'}`,
        errorMessage: (debitError as Error).message?.substring(0, 500),
      });
      console.warn('[AI Assistant] Failed to debit credits:', (debitError as Error).message);
    }
  }

  /**
   * Look up the per-model credit cost. Defaults to 1 if profile missing or unset.
   */
  private async resolveCreditCost(selectedModelProfileId?: string): Promise<number> {
    if (!this.modelProfileRepository || !selectedModelProfileId) return 1;
    try {
      const profile = await this.modelProfileRepository.getById(selectedModelProfileId);
      const cost = profile?.creditCost;
      return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : 1;
    } catch {
      return 1;
    }
  }

  /**
   * Audit an event safely — never throws, never blocks the chat flow.
   */
  auditLogSafe(eventType: 'AI_RUN_STARTED' | 'AI_TOOL_CALL_APPROVED' | 'AI_TOOL_CALL_REJECTED' | 'AI_RUN_COMPLETED' | 'AI_RUN_FAILED' | 'AI_CREDIT_DEBIT_FAILED', meta: AiAuditMeta): void {
    if (this.auditService) {
      this.auditService.log(eventType, meta).catch(err => {
        console.warn(`[AI Assistant] Audit log failed for '${eventType}': ${(err as Error).message}`);
      });
    }
  }
}
