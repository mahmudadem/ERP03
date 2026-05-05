/**
 * AiToolRegistry - Central registry for AI Assistant tools
 *
 * All AI tools are registered here. The registry provides:
 * - Tool lookup by name
 * - Listing available tools (for AI context/system prompt)
 * - Module-scoped tool queries
 *
 * Tools are registered during DI setup and remain immutable at runtime.
 * Only READ-ONLY tools are allowed — see AiTool interface for rules.
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { ApiError } from '../../../api/errors/ApiError';

export class AiToolRegistry {
  private tools: Map<string, AiTool> = new Map();

  constructor(tools: AiTool[] = []) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Register a tool. Throws if a tool with the same name is already registered.
   */
  register(tool: AiTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`AI tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name. Returns undefined if not found.
   */
  get(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools.
   */
  getAll(): AiTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by module.
   */
  getByModule(module: string): AiTool[] {
    return this.getAll().filter(t => t.module === module);
  }

  /**
   * Get descriptions of all tools for AI context (system prompt).
   * Returns sanitized descriptions without exposing internal IDs or implementation details.
   */
  getToolDescriptions(): Array<{ name: string; description: string; module: string }> {
    return this.getAll().map(t => ({
      name: t.name,
      description: t.description,
      module: t.module,
    }));
  }

  /**
   * Execute a tool by name with permission and context checks.
   * This is the ONLY way to execute a tool safely.
   */
  async executeTool(
    toolName: string,
    context: ToolExecutionContext,
    params?: Record<string, unknown>
  ): Promise<AiToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        data: null,
        error: `Unknown tool: '${toolName}'. Available tools: ${this.getAll().map(t => t.name).join(', ')}`,
        errorCode: 'UNKNOWN_TOOL',
      };
    }

    // Check permission
    const hasPermission = context.permissions.some(perm => {
      if (perm === '*') return true;
      if (perm === tool.requiredPermission) return true;
      // Parent permission check: 'accounting.reports' grants 'accounting.reports.trialBalance.view'
      if (tool.requiredPermission.startsWith(perm + '.')) return true;
      return false;
    });

    if (!hasPermission) {
      return {
        success: false,
        data: null,
        error: `Permission denied: '${tool.requiredPermission}' is required to use the '${tool.name}' tool.`,
        errorCode: 'PERMISSION_DENIED',
      };
    }

    try {
      return await tool.execute(context, params);
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          success: false,
          data: null,
          error: error.message,
          errorCode: error.code,
        };
      }
      return {
        success: false,
        data: null,
        error: `Tool execution failed: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}