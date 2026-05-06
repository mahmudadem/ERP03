/**
 * ExecuteAiToolUseCase - Safely executes an AI tool with permission and context checks
 *
 * This use case is the gateway for all AI tool executions:
 * 1. Resolves the tool from the registry
 * 2. Fetches the user's permissions for the company
 * 3. Builds the ToolExecutionContext
 * 4. Delegates to AiToolRegistry.executeTool() which checks permissions
 * 5. Returns the result to the caller (typically SendChatMessageUseCase)
 *
 * SAFETY:
 * - Tools are READ-ONLY — they cannot create, update, delete, post, approve, or reverse
 * - Permission checks are enforced BEFORE tool execution
 * - Company context is enforced — tools only see data for the authenticated company
 * - Invalid tool names return an error, not an exception
 */

import { AiToolRegistry } from '../services/AiToolRegistry';
import { AiToolResult } from '../../../domain/ai-assistant/tools/AiTool';
import { PermissionChecker } from '../../rbac/PermissionChecker';

export interface ExecuteAiToolInput {
  companyId: string;
  userId: string;
  toolName: string;
  params?: Record<string, unknown>;
}

export class ExecuteAiToolUseCase {
  constructor(
    private toolRegistry: AiToolRegistry,
    private permissionChecker: PermissionChecker,
  ) {}

  async execute(input: ExecuteAiToolInput): Promise<AiToolResult> {
    const { companyId, userId, toolName, params } = input;

    // Get user permissions for the company
    const permissions = await this.permissionChecker.hasPermission(userId, companyId, '*')
      .then(hasWildcard => {
        if (hasWildcard) return ['*'];
        // Fetch actual permissions — we need this for tool permission checking
        return this.getUserPermissions(userId, companyId);
      });

    // Build execution context
    const context = {
      companyId,
      userId,
      permissions,
    };

    // Execute via registry (which handles permission checks)
    return this.toolRegistry.executeTool(toolName, context, params);
  }

  /**
   * Get all permissions for a user in a company.
   * This delegates to the permission checker's underlying use case.
   */
  private async getUserPermissions(userId: string, companyId: string): Promise<string[]> {
    // Use the proper public method instead of bypassing encapsulation
    return this.permissionChecker.getAllPermissions(userId, companyId);
  }
}