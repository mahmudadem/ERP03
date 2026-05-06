/**
 * AiToolCallingOrchestrator - Inspects user messages and invokes read-only tools
 *
 * This orchestrator determines whether a user's message requires tool data,
 * executes the appropriate tool via AiToolRegistry, and formats the result
 * for inclusion in the AI provider's context.
 *
 * DESIGN PRINCIPLES:
 * - Tool selection is DETERMINISTIC (keyword matching), NOT free-form AI selection.
 * - Only registered, permission-checked, read-only tools can be invoked.
 * - Tool results are NEVER raw DB documents — always sanitized DTOs.
 * - The AI provider receives tool data as context and is instructed to:
 *   - Use ONLY the provided tool result
 *   - NOT invent balances or data
 *   - State clearly if data is unavailable
 *   - NOT suggest any financial action was performed
 *
 * INTENT DETECTION:
 * - Uses simple keyword matching (English, Arabic, Turkish)
 * - Keywords are defined in tool-intents.config.ts
 * - Maps recognized intents to registered tool names
 * - Multiple tools can be matched for a single message
 * - If no intent is detected, returns null (normal chat continues)
 *
 * STAGE 2 EXTENSIONS:
 * - buildAllowedToolContracts(): Builds provider tool contracts for a user/run
 *   from registered tools + catalog definitions, filtering by permissions.
 * - executeStructuredToolCalls(): Executes model-requested tool calls through
 *   AiRuntimeGuard and AiToolRegistry.
 * - Provider-safe name mapping (dots -> underscores and back).
 * - toolCallId preservation in ToolCallingResult for traceability.
 *
 * SECURITY:
 * - All tool executions go through ExecuteAiToolUseCase
 * - Permission checks are enforced BEFORE tool execution
 * - Company context is enforced (tools only see authenticated company data)
 * - Unregistered tool names are never invoked
 * - The orchestrator NEVER executes arbitrary code or SQL
 * - Model-requested tool calls are validated by AiRuntimeGuard before execution
 * - Only READ operation types are directly executed
 */

import { AiToolRegistry } from './AiToolRegistry';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { AiToolResult } from '../../../domain/ai-assistant/tools/AiTool';
import {
  AiProviderToolContract,
  AiProviderToolCallRequest,
} from '../../../domain/ai-assistant/tools/AiToolContract';
import { getToolIntents, ToolIntent } from '../config/tool-intents.config';
import { AiRuntimeGuard, GuardDecision } from './AiRuntimeGuard';
import { getCatalogDefinition, getExecutableDefinitions } from '../catalog/AiToolCatalogSeed';

export interface ToolCallingResult {
  /** The tool that was invoked */
  toolName: string;
  /** The result from the tool */
  result: AiToolResult;
  /** Tool call ID from the provider (if available from structured tool calls) */
  toolCallId?: string;
}

/**
 * Result of executing a structured tool call through the guard.
 */
export interface StructuredToolCallResult {
  toolName: string;
  toolCallId: string;
  approved: boolean;
  result: AiToolResult | null;
  rejectionReason?: string;
  rejectionCode?: string;
}

export class AiToolCallingOrchestrator {
  constructor(
    private toolRegistry: AiToolRegistry,
    private permissionChecker: PermissionChecker,
    private runtimeGuard?: AiRuntimeGuard,
  ) {}

  /**
   * Inspect a user message and determine if any tools should be invoked.
   * Returns tool results to inject into the AI context, or null if no tools match.
   *
   * @param message - The user's message
   * @param companyId - The authenticated company ID
   * @param userId - The authenticated user ID
   * @returns Array of ToolCallingResult (possibly empty), or null if no intents detected
   */
  async detectAndExecute(
    message: string,
    companyId: string,
    userId: string,
    params?: Record<string, unknown>,
  ): Promise<ToolCallingResult[] | null> {
    const matchedIntents = this.detectIntents(message);
    console.log(`[AI Assistant] Tool orchestration: message="${message.substring(0, 80)}", matchedIntents=${matchedIntents.length > 0 ? matchedIntents.map(i => i.toolName).join(',') : 'none'}`);

    if (matchedIntents.length === 0) {
      return null; // No tool needed — normal chat continues
    }

    // Get user permissions for context
    const permissions = await this.getUserPermissions(userId, companyId);
    console.log(`[AI Assistant] Tool orchestration: userId=${userId}, companyId=${companyId}, permissions=${permissions.length > 5 ? permissions.length + ' permissions' : permissions.join(',')}`);

    const context = { companyId, userId, permissions };

    const results: ToolCallingResult[] = [];

    for (const intent of matchedIntents) {
      console.log(`[AI Assistant] Executing tool: ${intent.toolName}`);
      const result = await this.toolRegistry.executeTool(
        intent.toolName,
        context,
        params,
      );
      console.log(`[AI Assistant] Tool ${intent.toolName} result: success=${result.success}, errorCode=${result.errorCode || 'none'}`);

      results.push({
        toolName: intent.toolName,
        result,
      });
    }

    return results;
  }

  /**
   * Detect which tool intents match the user's message.
   * Uses simple case-insensitive keyword matching from the intent config.
   * Returns an array of matching intents (may be empty or have multiple matches).
   * Only returns intents for tools that are actually registered in the registry.
   */
  detectIntents(message: string): Array<{ toolName: string; keywords: string[] }> {
    const lowerMessage = message.toLowerCase();
    const toolIntents = getToolIntents();
    const matches: Array<{ toolName: string; keywords: string[] }> = [];

    for (const intent of toolIntents) {
      // Check if any keyword is found in the message
      const matched = intent.keywords.some(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
      );

      if (matched) {
        // Also verify the tool is actually registered
        if (this.toolRegistry.get(intent.toolName)) {
          matches.push(intent);
        }
      }
    }

    return matches;
  }

  /**
   * Format tool results into a system message that instructs the AI
   * on how to use the data. This message is injected into the conversation
   * before sending to the provider.
   *
   * IMPORTANT: This message enforces that the AI:
   * - Uses ONLY the provided tool data
   * - Does NOT invent numbers or balances
   * - States clearly if data is unavailable
   * - Does NOT suggest any financial action was performed
   */
  formatToolResultsForContext(results: ToolCallingResult[]): string {
    if (!results || results.length === 0) return '';

    const sections: string[] = [];

    for (const { toolName, result } of results) {
      if (result.success && result.data) {
        sections.push(
          `[TOOL RESULT: ${toolName}]\n` +
          `The following data was retrieved from the ERP system for the user's company.\n` +
          `CRITICAL RULES FOR USING THIS DATA:\n` +
          `1. Use ONLY the numbers and data provided below. Do NOT invent, estimate, or fabricate any balances or amounts.\n` +
          `2. If any data appears missing, incomplete, or zero when it shouldn't be, say "The data is currently unavailable" rather than making up numbers.\n` +
          `3. This is READ-ONLY data. No financial action has been performed. Do NOT suggest that any posting, approval, voucher creation, or modification was done.\n` +
          `4. Explain the data clearly and help the user understand what they see.\n` +
          `5. Do NOT invent missing accounts, vouchers, customers, suppliers, items, or employees.\n` +
          `6. If the data appears truncated or incomplete, mention the limitation rather than guessing.\n` +
          `\nData:\n${JSON.stringify(result.data, null, 2)}\n` +
          `\n[END TOOL RESULT: ${toolName}]`
        );
      } else {
        // Tool failed or permission denied
        const errorDetail = result.error || 'Unknown error';
        const errorCode = result.errorCode || 'UNKNOWN';

        sections.push(
          `[TOOL RESULT: ${toolName}]\n` +
          `The requested data could not be retrieved.\n` +
          `Reason: ${errorDetail} (Code: ${errorCode})\n` +
          `Tell the user: "I was unable to retrieve the requested data. ${errorCode === 'PERMISSION_DENIED' ? 'You may not have the required permission to view this information. Please contact your administrator.' : 'Please try again later or contact support if the issue persists.'}"\n` +
          `\n[END TOOL RESULT: ${toolName}]`
        );
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Get descriptions of all registered tools for inclusion in the system prompt.
   * This tells the AI what tools are available in case the user's question
   * relates to one of these areas (but the AI does NOT invoke tools directly).
   */
  getToolDescriptionsForPrompt(): string {
    const tools = this.toolRegistry.getToolDescriptions();
    if (tools.length === 0) return '';

    const lines = tools.map(t =>
      `- "${t.name}" (${t.module}): ${t.description}`
    );

    return `You have access to the following data tools through the ERP system. ` +
      `When a user asks about these topics, you can provide answers using the data ` +
      `that was automatically retrieved for their question.\n\n` +
      `Available tools:\n${lines.join('\n')}\n\n` +
      `IMPORTANT: You do NOT invoke these tools yourself. They are invoked automatically ` +
      `based on the user's question. If tool data is provided in this conversation, ` +
      `use it in your response following the data usage rules provided with the data.`;
  }

  /**
   * Get user permissions for the given company.
   */
  private async getUserPermissions(userId: string, companyId: string): Promise<string[]> {
    const hasWildcard = await this.permissionChecker.hasPermission(userId, companyId, '*');
    if (hasWildcard) return ['*'];

    // Use the proper public method instead of bypassing encapsulation
    return this.permissionChecker.getAllPermissions(userId, companyId);
  }

  // ─── STAGE 2: Structured Tool Calling Methods ────────────────────────────

  /**
   * Build the list of allowed provider tool contracts for a user/run.
   *
   * Filters registered, executable, chat-invokable tools by the user's
   * permissions. Returns only READ operation types (writes are blocked).
   *
   * Uses getCatalogDefinition from AiToolCatalogSeed as the source of
   * tool metadata, then cross-references with the runtime registry to
   * ensure the tool is actually available.
   *
   * @returns An object with:
   *   - contracts: Array of AiProviderToolContract for the provider
   *   - nameMapping: Map from provider-safe name -> original registered name
   *   - allowedToolIds: Array of original tool names that are allowed
   */
  async buildAllowedToolContracts(
    userId: string,
    companyId: string,
  ): Promise<{
    contracts: AiProviderToolContract[];
    nameMapping: Map<string, string>;
    allowedToolIds: string[];
  }> {
    const permissions = await this.getUserPermissions(userId, companyId);
    const nameMapping = new Map<string, string>();
    const contracts: AiProviderToolContract[] = [];
    const allowedToolIds: string[] = [];

    // Get all executable catalog definitions
    const executableDefs = getExecutableDefinitions();

    for (const def of executableDefs) {
      // Must also be registered in the runtime tool registry
      const registeredTool = this.toolRegistry.get(def.name);
      if (!registeredTool) continue;

      // Must support chat invocation
      if (!def.supportsChatInvocation) continue;

      // Must be READ operation type for direct execution
      if (def.operationType !== 'READ') continue;

      // Must not be blocked
      if (def.isBlocked) continue;

      // User must have the required permission
      const requiredPermission = def.requiredPermissions[0];
      const hasPermission = !requiredPermission || permissions.some(perm => {
        if (perm === '*') return true;
        if (perm === requiredPermission) return true;
        if (requiredPermission.startsWith(perm + '.')) return true;
        return false;
      });
      if (!hasPermission) continue;

      // Build the provider contract
      const contract = def.toProviderToolContract();
      contracts.push(contract);

      // Map provider-safe name (dots -> underscores) back to original name
      const providerSafeName = contract.name; // already has dots replaced with underscores
      nameMapping.set(providerSafeName, def.name);
      allowedToolIds.push(def.name);
    }

    return { contracts, nameMapping, allowedToolIds };
  }

  /**
   * Execute structured model tool calls through AiRuntimeGuard and AiToolRegistry.
   *
   * This method is called when the AI provider returns structured toolCalls
   * in its response. Each call is validated by the RuntimeGuard before execution.
   * Only READ operations are executed; write/draft/proposal calls are rejected.
   *
   * @param aiRunId - The AI run context ID for guard validation
   * @param toolCalls - Structured tool call requests from the provider
   * @param nameMapping - Map from provider-safe name -> original registered name
   * @param companyId - Authenticated company ID (trumps any model-supplied value)
   * @param userId - Authenticated user ID (trumps any model-supplied value)
   * @returns Array of StructuredToolCallResult for each tool call
   */
  async executeStructuredToolCalls(
    aiRunId: string,
    toolCalls: AiProviderToolCallRequest[],
    nameMapping: Map<string, string>,
    companyId: string,
    userId: string,
  ): Promise<StructuredToolCallResult[]> {
    const results: StructuredToolCallResult[] = [];

    for (const toolCall of toolCalls) {
      // If runtimeGuard is available, validate the call
      if (this.runtimeGuard) {
        const decision: GuardDecision = await this.runtimeGuard.validateToolCall(
          aiRunId,
          toolCall,
          nameMapping,
        );

        if (!decision.approved) {
          results.push({
            toolName: decision.resolvedOriginalName,
            toolCallId: toolCall.id,
            approved: false,
            result: null,
            rejectionReason: decision.rejectionReason,
            rejectionCode: decision.rejectionCode,
          });
          continue;
        }

        // Approved — execute the tool using the authenticated identity
        const originalName = decision.resolvedOriginalName;
        const toolResult = await this.executeApprovedToolCall(
          originalName,
          companyId,
          userId,
          toolCall.arguments,
        );

        results.push({
          toolName: originalName,
          toolCallId: toolCall.id,
          approved: true,
          result: toolResult,
        });
      } else {
        // No runtime guard — fall back to direct execution (existing behavior)
        // Resolve name from provider-safe format
        const originalName = nameMapping.get(toolCall.name) ?? toolCall.name;
        const toolResult = await this.executeApprovedToolCall(
          originalName,
          companyId,
          userId,
          toolCall.arguments,
        );

        results.push({
          toolName: originalName,
          toolCallId: toolCall.id,
          approved: true,
          result: toolResult,
        });
      }
    }

    return results;
  }

  /**
   * Execute an approved tool call using the AiToolRegistry.
   * Uses authenticated backend identity, never model-supplied values.
   */
  private async executeApprovedToolCall(
    toolName: string,
    companyId: string,
    userId: string,
    args: Record<string, unknown>,
  ): Promise<AiToolResult> {
    // Strip model-supplied identity fields — we always use backend identity
    const safeArgs = { ...args };
    delete safeArgs.companyId;
    delete safeArgs.userId;

    const permissions = await this.getUserPermissions(userId, companyId);
    const context = { companyId, userId, permissions };

    return this.toolRegistry.executeTool(toolName, context, safeArgs);
  }

  /**
   * Format structured tool call results for inclusion in a second provider call.
   *
   * This wraps the tool results as tool response messages that the provider
   * can understand, including both successful and rejected tool calls.
   */
  formatStructuredResultsForProviderContext(
    results: StructuredToolCallResult[],
  ): string {
    if (!results || results.length === 0) return '';

    const sections: string[] = [];

    for (const result of results) {
      if (result.approved && result.result?.success && result.result.data) {
        sections.push(
          `[TOOL RESULT: ${result.toolName}]\n` +
          `The following data was retrieved from the ERP system.\n` +
          `CRITICAL RULES FOR USING THIS DATA:\n` +
          `1. Use ONLY the numbers and data provided below. Do NOT invent, estimate, or fabricate any values.\n` +
          `2. If data appears missing or incomplete, say "The data is currently unavailable" rather than making up values.\n` +
          `3. This is READ-ONLY data. No financial action has been performed.\n` +
          `4. Explain the data clearly.\n\n` +
          `Data:\n${JSON.stringify(result.result.data, null, 2)}\n` +
          `\n[END TOOL RESULT: ${result.toolName}]`
        );
      } else if (result.approved && result.result && !result.result.success) {
        // Tool was approved but execution failed
        sections.push(
          `[TOOL RESULT: ${result.toolName}]\n` +
          `The requested data could not be retrieved.\n` +
          `Reason: ${result.result.error || 'Unknown error'} (Code: ${result.result.errorCode || 'UNKNOWN'})\n` +
          `Tell the user: "I was unable to retrieve the requested data. Please try again later."\n` +
          `\n[END TOOL RESULT: ${result.toolName}]`
        );
      } else if (!result.approved) {
        // Tool call was rejected by runtime guard
        sections.push(
          `[TOOL CALL REJECTED: ${result.toolName}]\n` +
          `The AI model requested to call '${result.toolName}' but it was blocked for safety.\n` +
          `Reason: ${result.rejectionReason || 'Not allowed'}\n` +
          `Tell the user: "I cannot perform that action automatically. ${result.rejectionCode === 'PERMISSION_DENIED' ? 'You may not have the required permission.' : 'This type of operation requires manual review.'}"\n` +
          `\n[END TOOL CALL REJECTED: ${result.toolName}]`
        );
      }
    }

    return sections.join('\n\n');
  }
}
