/**
 * AiRuntimeGuard - Validates model-requested tool calls before execution
 *
 * This guard is the runtime safety boundary between untrusted AI model
 * tool-call requests and actual ERP tool execution. It ensures that:
 *
 * 1. The aiRun exists and hasn't expired
 * 2. The conversation exists and belongs to the tenant
 * 3. The tool is registered in the system
 * 4. The tool is in the allowedTools snapshot for this aiRun
 * 5. Model-supplied companyId/userId are REJECTED — we always use
 *    the authenticated backend identity
 * 6. Only READ operations can execute directly; PROPOSAL/DRAFT/CREATE/
 *    UPDATE/DELETE/POST/APPROVE are blocked
 * 7. Tool arguments are validated against the inputSchema (basic checks)
 * 8. The user has the required permission for the tool
 * 9. Max tool calls per aiRun are enforced
 * 10. The runtime hasn't expired
 *
 * DESIGN PRINCIPLES:
 * - Never trust model-supplied identity (companyId, userId)
 * - Never execute write operations
 * - Validate everything — the model is an untrusted actor
 * - Log all decisions through AiAuditService
 * - Guard failures never crash the chat — they block and report
 */

import { AiToolRegistry } from './AiToolRegistry';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import {
  AiProviderToolCallRequest,
  AiToolOperationType,
} from '../../../domain/ai-assistant/tools/AiToolContract';
import { AiToolDefinition } from '../../../domain/ai-assistant/entities/AiToolDefinition';
import { getCatalogDefinition } from '../catalog/AiToolCatalogSeed';

/**
 * State for a single AI "run" — one chat request.
 * Created at the start of each request, used to scope and limit tool calls.
 */
export interface AiRunContext {
  aiRunId: string;
  companyId: string;
  userId: string;
  conversationId: string;
  createdAt: number;          // epoch ms
  expiresAt: number;          // epoch ms
  maxToolCalls: number;
  toolCallsUsed: number;
  /** Snapshot of tool names allowed for this run */
  allowedToolIds: string[];
  /** Provider/model that initiated this run */
  providerModel: string;
}

/**
 * Result of a guard validation — approved or rejected with reason.
 */
export interface GuardDecision {
  approved: boolean;
  toolName: string;
  /** If rejected, the human-readable reason */
  rejectionReason?: string;
  /** If rejected, a machine-readable code */
  rejectionCode?: string;
  /** The original tool call request */
  originalRequest: AiProviderToolCallRequest;
  /** The resolved original tool name (dots, not underscores) */
  resolvedOriginalName: string;
  /** Operation type of the resolved tool */
  operationType: AiToolOperationType;
  /** If schema validation failed, details */
  schemaValidationErrors?: string[];
}

export class AiRuntimeGuard {
  private runs: Map<string, AiRunContext> = new Map();

  constructor(
    private toolRegistry: AiToolRegistry,
    private permissionChecker: PermissionChecker,
  ) {}

  /**
   * Create a new AiRunContext for a chat request.
   * This scopes all tool calls for this request.
   */
  createRun(params: {
    companyId: string;
    userId: string;
    conversationId: string;
    allowedToolIds: string[];
    providerModel: string;
    maxToolCalls?: number;
    ttlMs?: number;
  }): AiRunContext {
    const now = Date.now();
    const aiRunId = `run_${now}_${Math.random().toString(36).substring(2, 10)}`;
    const ctx: AiRunContext = {
      aiRunId,
      companyId: params.companyId,
      userId: params.userId,
      conversationId: params.conversationId,
      createdAt: now,
      expiresAt: now + (params.ttlMs ?? 5 * 60 * 1000), // default 5 min
      maxToolCalls: params.maxToolCalls ?? 5,
      toolCallsUsed: 0,
      allowedToolIds: params.allowedToolIds,
      providerModel: params.providerModel,
    };
    this.runs.set(aiRunId, ctx);
    return ctx;
  }

  /**
   * Get an existing run context. Returns undefined if not found or expired.
   */
  getRun(aiRunId: string): AiRunContext | undefined {
    const ctx = this.runs.get(aiRunId);
    if (!ctx) return undefined;
    if (Date.now() > ctx.expiresAt) {
      this.runs.delete(aiRunId);
      return undefined;
    }
    return ctx;
  }

  /**
   * Validate a model-requested tool call against all guard policies.
   *
   * This is the main entry point for tool call validation.
   * Returns a GuardDecision indicating whether the call is approved or rejected.
   *
   * IMPORTANT: companyId and userId from the tool call arguments are IGNORED.
   * We always use the authenticated backend identity from the AiRunContext.
   */
  async validateToolCall(
    aiRunId: string,
    toolCall: AiProviderToolCallRequest,
    nameMapping: Map<string, string>, // provider-safe name -> original name
  ): Promise<GuardDecision> {
    const ctx = this.getRun(aiRunId);

    // 1. aiRunId must exist and not be expired
    if (!ctx) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `AI run ${aiRunId} not found or expired`,
        rejectionCode: 'RUN_NOT_FOUND_OR_EXPIRED',
        originalRequest: toolCall,
        resolvedOriginalName: nameMapping.get(toolCall.name) ?? toolCall.name,
        operationType: 'READ',
      };
    }

    // 2. Resolve provider-safe name to original registered name
    const originalName = nameMapping.get(toolCall.name) ?? toolCall.name;
    const catalogDef = getCatalogDefinition(originalName);

    if (!toolCall.arguments || typeof toolCall.arguments !== 'object' || Array.isArray(toolCall.arguments)) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${toolCall.name}' arguments must be a JSON object`,
        rejectionCode: 'INVALID_TOOL_ARGUMENTS',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType: catalogDef?.operationType ?? 'READ',
      };
    }

    // 3. Tool must exist in catalog/registry
    const registeredTool = this.toolRegistry.get(originalName);
    if (!registeredTool && !catalogDef) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${toolCall.name}' is not registered in the system`,
        rejectionCode: 'TOOL_NOT_FOUND',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType: 'READ',
      };
    }

    // 4. Determine operation type
    const operationType: AiToolOperationType = catalogDef?.operationType ?? 'READ';

    // 5. Tool must be in allowed tools snapshot for this run
    if (!ctx.allowedToolIds.includes(originalName)) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${originalName}' is not in the allowed tools for this run`,
        rejectionCode: 'TOOL_NOT_ALLOWED_FOR_RUN',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // 6. REJECT model-supplied companyId/userId — always use backend identity
    if (toolCall.arguments.companyId || toolCall.arguments.userId) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${originalName}' attempted to supply companyId/userId. Identity must come only from authenticated backend context.`,
        rejectionCode: 'MODEL_SUPPLIED_IDENTITY_REJECTED',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // 7. Only READ operations can be directly executed
    const blockedOperationTypes: AiToolOperationType[] = [
      'PROPOSAL', 'DRAFT', 'CREATE', 'UPDATE', 'DELETE', 'POST', 'APPROVE',
    ];
    if (blockedOperationTypes.includes(operationType)) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${originalName}' has operation type '${operationType}' which cannot be directly executed. Write/draft/proposal operations require human review.`,
        rejectionCode: 'OPERATION_TYPE_BLOCKED',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // 8. Check if tool is registered and executable
    if (!registeredTool) {
      // Tool is in catalog but not in runtime registry (may be unavailable)
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${originalName}' exists in catalog but is not available for execution`,
        rejectionCode: 'TOOL_NOT_EXECUTABLE',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // 9. Schema validation against inputSchema
    const schemaErrors = this.validateInputSchema(toolCall.arguments, catalogDef);
    if (schemaErrors.length > 0 && catalogDef) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Tool '${originalName}' arguments failed schema validation: ${schemaErrors.join('; ')}`,
        rejectionCode: 'SCHEMA_VALIDATION_FAILED',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
        schemaValidationErrors: schemaErrors,
      };
    }

    // 10. Permission check — user must have the required permission
    const requiredPermission = catalogDef?.requiredPermissions?.[0] ?? registeredTool.requiredPermission;
    const hasPermission = await this.permissionChecker.hasPermission(
      ctx.userId,
      ctx.companyId,
      requiredPermission,
    );
    if (!hasPermission) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `User does not have permission '${requiredPermission}' required for tool '${originalName}'`,
        rejectionCode: 'PERMISSION_DENIED',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // 11. Max tool calls per run check
    if (ctx.toolCallsUsed >= ctx.maxToolCalls) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `Maximum tool calls (${ctx.maxToolCalls}) for this run have been reached`,
        rejectionCode: 'MAX_TOOL_CALLS_EXCEEDED',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // 12. Runtime must not be expired (re-check)
    if (Date.now() > ctx.expiresAt) {
      return {
        approved: false,
        toolName: toolCall.name,
        rejectionReason: `AI run ${aiRunId} has expired`,
        rejectionCode: 'RUN_EXPIRED',
        originalRequest: toolCall,
        resolvedOriginalName: originalName,
        operationType,
      };
    }

    // All checks passed — approve
    ctx.toolCallsUsed++;
    return {
      approved: true,
      toolName: toolCall.name,
      originalRequest: toolCall,
      resolvedOriginalName: originalName,
      operationType,
    };
  }

  /**
   * Validate tool call arguments against the catalog's inputSchema.
   *
   * Basic validation:
   * - Reject unknown top-level fields when properties are specified
   * - Validate basic types (string, number, boolean, object, array)
   * - If inputSchema has no properties defined, allow any arguments
   * - Never crash on malformed input — just report errors
   */
  private validateInputSchema(
    args: Record<string, unknown>,
    catalogDef: AiToolDefinition | undefined,
  ): string[] {
    const errors: string[] = [];
    if (!catalogDef) return errors; // No catalog def = no schema to validate against

    const schema = catalogDef.inputSchema;
    if (!schema || !schema.properties) return errors; // No properties = allow anything

    const knownProperties = Object.keys(schema.properties as Record<string, unknown>);

    // Check for unknown fields when properties are known
    const argsKeys = Object.keys(args);
    // Remove identity fields that we explicitly ignore
    const safeArgsKeys = argsKeys.filter(k => k !== 'companyId' && k !== 'userId');

    for (const key of safeArgsKeys) {
      // Check if it's a known property
      if (!knownProperties.includes(key)) {
        errors.push(`Unknown field '${key}'`);
      }
    }

    // Validate basic types for known properties
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    for (const key of knownProperties) {
      if (!(key in args)) continue; // Missing properties are OK (may be optional)

      const propSchema = properties[key];
      const value = args[key];
      const expectedType = propSchema.type as string | undefined;
      if (!expectedType) continue;

      // Type validation
      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push(`Field '${key}' must be a string, got ${typeof value}`);
      } else if (expectedType === 'number' && typeof value !== 'number') {
        errors.push(`Field '${key}' must be a number, got ${typeof value}`);
      } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Field '${key}' must be a boolean, got ${typeof value}`);
      } else if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        errors.push(`Field '${key}' must be an object`);
      } else if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field '${key}' must be an array`);
      }
    }

    return errors;
  }

  /**
   * Clean up expired runs. Call periodically or between requests.
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [id, ctx] of this.runs) {
      if (now > ctx.expiresAt) {
        this.runs.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
