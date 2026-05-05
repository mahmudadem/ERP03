/**
 * AiTool - Domain Interface for AI Assistant Tools
 *
 * AI tools give the assistant read-only access to business data.
 * They are the ONLY way the AI can access real ERP data.
 *
 * DESIGN PRINCIPLES:
 * 1. ALL tools are READ-ONLY — they must never create, update, delete,
 *    approve, post, or reverse anything. This is enforced by:
 *    - The tool interface only has an `execute` method that returns data
 *    - The ExecuteAiToolUseCase checks permissions and company context
 *    - Tools cannot call mutating use cases
 *
 * 2. Tools are permission-gated — each tool requires a specific permission.
 *    If the user doesn't have the permission, the tool returns an error.
 *
 * 3. Tools are company-scoped — they only see data for the user's company.
 *
 * 4. Tool results are sanitized DTOs — raw domain entities are never
 *    returned to the AI. Only summary/DTO data is exposed.
 *
 * 5. Tools are registered in AiToolRegistry — the AI decides which
 *    tool to call based on the user's question.
 */

/**
 * Context provided to every tool execution.
 * Contains the authenticated user and company context.
 */
export interface ToolExecutionContext {
  companyId: string;
  userId: string;
  /** The user's permissions for this company */
  permissions: string[];
}

/**
 * The result of a tool execution.
 */
export interface AiToolResult {
  /** Whether the tool execution was successful */
  success: boolean;
  /** The data returned by the tool (null on failure) */
  data: Record<string, unknown> | null;
  /** Human-readable error message on failure */
  error?: string;
  /** The error code on failure (e.g., 'PERMISSION_DENIED') */
  errorCode?: string;
}

/**
 * The AI Tool interface.
 *
 * Implementations:
 * - Must be READ-ONLY
 * - Must check permissions via ToolExecutionContext
 * - Must respect company isolation (companyId)
 * - Must return sanitized data, not raw entities
 * - Must have descriptive names following the pattern: module.actionSubaction
 */
export interface AiTool {
  /** Unique tool identifier: 'module.actionSubaction' e.g., 'accounting.getTrialBalanceSummary' */
  readonly name: string;

  /** Human-readable description of what the tool does */
  readonly description: string;

  /** Permission required to use this tool */
  readonly requiredPermission: string;

  /** The module this tool belongs to (e.g., 'accounting', 'sales', 'inventory') */
  readonly module: string;

  /**
   * Execute the tool in the given context.
   * Returns sanitized data or an error.
   * MUST be READ-ONLY — no side effects.
   */
  execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult>;
}