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
 * - Maps recognized intents to registered tool names
 * - Multiple tools can be matched for a single message (future)
 * - If no intent is detected, returns null (normal chat continues)
 *
 * SECURITY:
 * - All tool executions go through ExecuteAiToolUseCase
 * - Permission checks are enforced BEFORE tool execution
 * - Company context is enforced (tools only see authenticated company data)
 * - Unregistered tool names are never invoked
 * - The orchestrator NEVER executes arbitrary code or SQL
 */

import { AiToolRegistry } from './AiToolRegistry';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { AiToolResult } from '../../../domain/ai-assistant/tools/AiTool';

/**
 * Supported tool intents with keyword patterns.
 * Each intent maps to a registered tool name.
 * Keywords are matched case-insensitively against the user message.
 */
const TOOL_INTENTS: Array<{
  toolName: string;
  keywords: string[];
}> = [
  {
    toolName: 'accounting.getTrialBalanceSummary',
    keywords: [
      // English
      'trial balance', 'balance summary', 'accounting summary',
      'debit credit summary', 'closing balance', 'account balances',
      'financial summary', 'total debit', 'total credit',
      // Arabic
      'ميزان المراجعة', 'ميزان مراجعة', 'ملخص الميزان',
      'ميزانية', 'رصيد', 'أرصدة',
      // Turkish
      'deneme bilançosu', 'mizan', 'genel Mizan',
      'borç alacak özeti', 'hesap özeti',
    ],
  },
  {
    toolName: 'accounting.getProfitAndLoss',
    keywords: [
      // English
      'profit and loss', 'profit & loss', 'p&l', 'income statement',
      'net profit', 'gross profit', 'revenue and expenses',
      // Arabic
      'الأرباح والخسائر', 'ارباح وخسائر', 'قائمة الدخل',
      'صافي الربح', 'الإيرادات والمصروفات',
      // Turkish
      'kar zarar', 'gelir tablosu', 'net kar',
      'gelir ve gider',
    ],
  },
  {
    toolName: 'accounting.getBalanceSheet',
    keywords: [
      // English
      'balance sheet', 'statement of financial position',
      'assets and liabilities', 'assets liabilities equity',
      // Arabic
      'الميزانية العمومية', 'قائمة المركز المالي',
      'الأصول والخصوم', 'الاصول والخصوم',
      // Turkish
      'bilanço', 'finansal durum tablosu',
      'varlıklar ve borçlar',
    ],
  },
];

export interface ToolCallingResult {
  /** The tool that was invoked */
  toolName: string;
  /** The result from the tool */
  result: AiToolResult;
}

export class AiToolCallingOrchestrator {
  constructor(
    private toolRegistry: AiToolRegistry,
    private permissionChecker: PermissionChecker,
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
   * Uses simple case-insensitive keyword matching.
   * Returns an array of matching intents (usually 0 or 1 for now).
   */
  detectIntents(message: string): Array<{ toolName: string; keywords: string[] }> {
    const lowerMessage = message.toLowerCase();
    const matches: Array<{ toolName: string; keywords: string[] }> = [];

    for (const intent of TOOL_INTENTS) {
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

    const getPermsUseCase = (this.permissionChecker as any).getPermissionsUC;
    if (getPermsUseCase && typeof getPermsUseCase.execute === 'function') {
      const result = await getPermsUseCase.execute({ userId, companyId });
      return result || [];
    }
    return [];
  }
}
