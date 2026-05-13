/**
 * AiToolPlanningLoop - AI-led tool planning and execution loop
 *
 * Handles:
 * - Multi-round tool planning with the AI provider
 * - Parsing text-tool-plan fallback format (ERP_TOOL_PLAN)
 * - Merging provider usage metadata across planning rounds
 * - Executing structured tool calls through the orchestrator
 * - Audit logging of tool call approvals/rejections
 *
 * DESIGN PRINCIPLES:
 * - The AI model decides which tools to call; this loop only validates and executes
 * - All tool calls go through RuntimeGuard validation
 * - Only READ operations are executed; write calls are blocked
 * - Text-plan parsing uses 3 strategies for maximum compatibility
 * - Usage metadata is accumulated across all planning rounds
 */

import { IAiProvider, AiProviderRequest, AiProviderResponse } from '../providers/IAiProvider';
import { AiProviderToolContract } from '../../../domain/ai-assistant/tools/AiToolContract';
import { AiRuntimeGuard, AiRunContext } from './AiRuntimeGuard';
import { AiToolCallingOrchestrator, StructuredToolCallResult } from './AiToolCallingOrchestrator';
import { AiAuditService, AiAuditMeta } from './AiAuditService';

export interface ParsedTextToolPlan {
  hasPlanBlock: boolean;
  calls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  error?: string;
}

export interface UsageAccumulator {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ToolResultSummary {
  toolName: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface PlanningLoopInput {
  provider: IAiProvider;
  maxTokens: number | undefined;
  temperature: number;
  initialMessages: AiProviderRequest['messages'];
  shouldUseNativeTools: boolean;
  shouldUseTextToolPlan: boolean;
  allowedContracts: AiProviderToolContract[];
  nameMapping: Map<string, string>;
  maxPlanningRounds: number;
  runContext?: AiRunContext;
  companyId: string;
  userId: string;
  conversationId: string;
  providerModelLabel: string;
  fallbackModel: string;
  fallbackProvider: string;
}

export interface PlanningLoopResult {
  finalResponse: AiProviderResponse;
  usage: UsageAccumulator | undefined;
  tokenCount: number | undefined;
  toolCallsRequested: string[];
  toolResultSummaries: ToolResultSummary[];
  structuredToolResultsForMetadata: Array<{
    toolName: string;
    toolCallId: string;
    result: StructuredToolCallResult['result'];
  }>;
}

export class AiToolPlanningLoop {
  constructor(
    private toolOrchestrator?: AiToolCallingOrchestrator,
    private runtimeGuard?: AiRuntimeGuard,
    private auditService?: AiAuditService,
  ) {}

  /**
   * Execute the multi-round AI-led tool planning loop.
   *
   * The AI model proposes tool calls (native or text-plan), which are validated
   * by the RuntimeGuard and executed through the ToolCallingOrchestrator.
   * The loop continues until the model produces a final response or max rounds
   * are reached.
   */
  async execute(input: PlanningLoopInput): Promise<PlanningLoopResult> {
    const {
      provider,
      maxTokens,
      temperature,
      initialMessages,
      shouldUseNativeTools,
      shouldUseTextToolPlan,
      allowedContracts,
      nameMapping,
      maxPlanningRounds,
      runContext,
      companyId,
      userId,
      conversationId,
      providerModelLabel,
      fallbackModel,
      fallbackProvider,
    } = input;

    let usage: UsageAccumulator | undefined;
    let finalResponse: AiProviderResponse | null = null;
    let lastResponse: AiProviderResponse | null = null;
    let tokenCount: number | undefined;
    const activeMessages: AiProviderRequest['messages'] = [...initialMessages];
    const structuredToolResultsForMetadata: PlanningLoopResult['structuredToolResultsForMetadata'] = [];
    const toolCallsRequested: string[] = [];
    const toolResultSummaries: ToolResultSummary[] = [];

    for (let round = 0; round < maxPlanningRounds; round++) {
      const response = await provider.chat({
        messages: activeMessages,
        maxTokens,
        temperature,
        ...(shouldUseNativeTools ? { tools: allowedContracts } : {}),
      });
      lastResponse = response;
      tokenCount = response.tokenCount;
      usage = this.mergeUsage(usage, response.metadata?.usage as UsageAccumulator | undefined);

      const textPlan = response.toolCalls && response.toolCalls.length > 0
        ? { hasPlanBlock: false, calls: [] } as ParsedTextToolPlan
        : this.parseTextToolPlan(response.content);

      if (textPlan.hasPlanBlock && textPlan.error) {
        finalResponse = {
          ...response,
          content: 'I could not prepare a valid ERP tool request from the model response. Please rephrase the request with the needed report, name/code, and filters.',
        };
        break;
      }

      const plannedToolCalls = response.toolCalls && response.toolCalls.length > 0 && shouldUseNativeTools
        ? response.toolCalls
        : textPlan.calls;

      if (
        plannedToolCalls.length === 0 ||
        !this.toolOrchestrator ||
        !runContext
      ) {
        finalResponse = response;
        break;
      }

      console.log(`[AI Assistant] Model requested ${plannedToolCalls.length} tool call(s) in planning round ${round + 1}`);

      for (const tc of plannedToolCalls) {
        toolCallsRequested.push(tc.name);
      }

      const structuredToolResults = await this.toolOrchestrator.executeStructuredToolCalls(
        runContext.aiRunId,
        plannedToolCalls,
        nameMapping,
        companyId,
        userId,
      );

      structuredToolResultsForMetadata.push(
        ...structuredToolResults
          .filter((r): r is StructuredToolCallResult & { result: NonNullable<StructuredToolCallResult['result']> } => !!r.result)
          .map(r => ({
            toolName: r.toolName,
            toolCallId: r.toolCallId,
            result: r.result,
          })),
      );

      for (const strResult of structuredToolResults) {
        const matchingCall = plannedToolCalls.find(tc => tc.id === strResult.toolCallId);
        const auditEventType = strResult.approved ? 'AI_TOOL_CALL_APPROVED' : 'AI_TOOL_CALL_REJECTED';
        this.auditLogSafe(auditEventType, {
          companyId,
          userId,
          conversationId,
          aiRunId: runContext.aiRunId,
          providerModel: providerModelLabel,
          resolvedOriginalName: strResult.toolName,
          operationType: 'READ',
          rejectionReason: strResult.rejectionReason,
          rejectionCode: strResult.rejectionCode,
          toolCallKeys: Object.keys(matchingCall?.arguments ?? {}),
        });

        toolResultSummaries.push({
          toolName: strResult.toolName,
          approved: strResult.approved,
          rejectionReason: strResult.rejectionReason,
        });
      }

      const toolCallContext = this.toolOrchestrator.formatStructuredResultsForProviderContext(
        structuredToolResults,
      );

      activeMessages.push({
        role: 'assistant',
        content: response.content || '[Tool calls requested]',
      });
      activeMessages.push({
        role: 'system',
        content: toolCallContext +
          '\n\nContinue the same conversation from these tool results. First combine them with the current user request and any prior context. If another read-only tool is needed to fulfill the clear intent, request it. If the intent or required extra information is truly ambiguous, ask a short clarification question. Otherwise answer the user using only returned tool data and relevant prior context.',
      });
    }

    if (!finalResponse) {
      const successfulTools = structuredToolResultsForMetadata
        .filter(r => r.result.success)
        .map(r => r.toolName)
        .join(', ');
      finalResponse = lastResponse
        ? {
            ...lastResponse,
            content: successfulTools
              ? `I retrieved data from ${successfulTools}, but the model did not produce a final answer. Please ask again if you need the details summarized.`
              : 'I could not retrieve the requested ERP data. Please rephrase the request or check the relevant ERP module.',
          }
        : {
            content: 'I was unable to get a response from the AI provider. Please try again.',
            model: fallbackModel || 'unknown',
            provider: fallbackProvider,
          };
    }

    return {
      finalResponse,
      usage,
      tokenCount,
      toolCallsRequested,
      toolResultSummaries,
      structuredToolResultsForMetadata,
    };
  }

  /**
   * Parse the text-plan fallback format used when native tool calling is not
   * available. The result is treated exactly like provider tool calls: untrusted
   * input that must pass Runtime Guard validation before execution.
   */
  parseTextToolPlan(content: string | null): ParsedTextToolPlan {
    if (!content) {
      return { hasPlanBlock: false, calls: [] };
    }

    // Strategy 1: [ERP_TOOL_PLAN]...[/ERP_TOOL_PLAN] markers (primary expected format)
    const match = content.match(/\[ERP_TOOL_PLAN\]([\s\S]*?)\[\/ERP_TOOL_PLAN\]/i);
    if (match) {
      const rawJson = match[1]
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(rawJson) as Record<string, unknown>;
        const rawCalls = Array.isArray(parsed.calls) ? parsed.calls : [];
        const calls = rawCalls
          .slice(0, 5)
          .map((raw, index) => {
            const call = raw as Record<string, unknown>;
            const name = String(call.tool || call.name || call.providerTool || '').trim().replace(/\./g, '_');
            const args = call.arguments;

            return {
              id: `text_plan_call_${index + 1}`,
              name,
              arguments: args && typeof args === 'object' && !Array.isArray(args)
                ? args as Record<string, unknown>
                : {},
            };
          })
          .filter(call => call.name.length > 0);

        if (calls.length === 0) {
          return {
            hasPlanBlock: true,
            calls: [],
            error: 'ERP_TOOL_PLAN contained no valid calls',
          };
        }

        return { hasPlanBlock: true, calls };
      } catch (error) {
        return {
          hasPlanBlock: true,
          calls: [],
          error: `Invalid ERP_TOOL_PLAN JSON: ${(error as Error).message}`,
        };
      }
    }

    // Strategy 2: Bare JSON tool call format in code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonBlockMatch) {
      const candidate = jsonBlockMatch[1].trim();
      const result = this.tryParseBareToolJson(candidate);
      if (result.calls.length > 0) return result;
    }

    // Strategy 3: Inline JSON (not in code block)
    const inlineJsonMatch = content.match(/\{[\s\S]*?"tool_?calls?[\s\S]*?\}/);
    if (inlineJsonMatch) {
      const result = this.tryParseBareToolJson(inlineJsonMatch[0]);
      if (result.calls.length > 0) return result;
    }

    return { hasPlanBlock: false, calls: [] };
  }

  /**
   * Merge provider usage metadata across planning rounds.
   */
  mergeUsage(
    current: UsageAccumulator | undefined,
    next: UsageAccumulator | undefined,
  ): UsageAccumulator | undefined {
    if (!next) return current;
    if (!current) return { ...next };

    return {
      promptTokens: (current.promptTokens || 0) + (next.promptTokens || 0),
      completionTokens: (current.completionTokens || 0) + (next.completionTokens || 0),
      totalTokens: (current.totalTokens || 0) + (next.totalTokens || 0),
    };
  }

  /**
   * Try to parse a bare JSON object that contains tool call information.
   */
  private tryParseBareToolJson(raw: string): ParsedTextToolPlan {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      // Format: {"tool_call": "module.function"} → single tool call
      if (typeof parsed.tool_call === 'string' && parsed.tool_call.trim()) {
        const name = String(parsed.tool_call).trim();
        const normalizedName = name.replace(/\./g, '_');
        return {
          hasPlanBlock: false,
          calls: [{
            id: 'text_plan_call_1',
            name: normalizedName,
            arguments: typeof parsed.arguments === 'object' && !Array.isArray(parsed.arguments)
              ? parsed.arguments as Record<string, unknown>
              : {},
          }],
        };
      }

      // Format: {"tool_calls": [...]} or {"calls": [...]}
      const rawCalls = Array.isArray(parsed.tool_calls)
        ? parsed.tool_calls
        : Array.isArray(parsed.calls)
          ? parsed.calls
          : [];

      if (rawCalls.length > 0) {
        const calls = rawCalls
          .slice(0, 5)
          .map((raw, index) => {
            const call = raw as Record<string, unknown>;
            const name = String(call.tool || call.name || call.providerTool || '').trim();
            const normalizedName = name.replace(/\./g, '_');
            const args = call.arguments || call.args;

            return {
              id: `text_plan_call_${index + 1}`,
              name: normalizedName,
              arguments: args && typeof args === 'object' && !Array.isArray(args)
                ? args as Record<string, unknown>
                : {},
            };
          })
          .filter(call => call.name.length > 0);

        if (calls.length > 0) {
          return { hasPlanBlock: false, calls };
        }
      }

      return { hasPlanBlock: false, calls: [] };
    } catch {
      return { hasPlanBlock: false, calls: [] };
    }
  }

  /**
   * Audit an event safely — never throws, never blocks the chat flow.
   */
  private auditLogSafe(eventType: 'AI_TOOL_CALL_APPROVED' | 'AI_TOOL_CALL_REJECTED', meta: AiAuditMeta): void {
    if (this.auditService) {
      this.auditService.log(eventType, meta).catch(err => {
        console.warn(`[AI Assistant] Audit log failed for '${eventType}': ${(err as Error).message}`);
      });
    }
  }
}