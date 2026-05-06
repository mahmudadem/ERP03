/**
 * Provider-agnostic AI tool contract types.
 *
 * These types live in the domain layer because they describe the safe public
 * contract of ERP AI tools, not a specific model/provider implementation.
 * Provider adapters map this neutral contract to provider-specific formats.
 */

/**
 * Operation types for AI tool definitions.
 *
 * READ / PROPOSAL / DRAFT are non-direct-business-execution paths.
 * CREATE / UPDATE / DELETE / POST / APPROVE are unsafe for autonomous AI use
 * and must be blocked or redirected to the Proposal/Draft Sandbox.
 */
export type AiToolOperationType =
  | 'READ'
  | 'PROPOSAL'
  | 'DRAFT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'POST'
  | 'APPROVE';

/**
 * Provider-agnostic tool contract exposed to AI providers.
 *
 * This contract must never contain API URLs, secrets, repository details,
 * database details, service account information, or hidden policies.
 */
export interface AiProviderToolContract {
  /** Provider-safe function name, e.g. accounting_getTrialBalanceSummary */
  name: string;
  /** Original registered ERP tool name, e.g. accounting.getTrialBalanceSummary */
  originalName: string;
  description: string;
  whenToUse: string;
  operationType: AiToolOperationType;
  moduleId: string;
  requiredPermissions: string[];
  /** JSON Schema for tool inputs */
  inputSchema: Record<string, unknown>;
  /** Alias used by OpenAI-compatible providers */
  parameters: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  outputDescription?: string;
  maxRows?: number;
  maxResults?: number;
  examples: string[];
  safetyNotes: string[];
  safeForAutoInvoke: boolean;
}

/**
 * A structured tool-call request returned by an AI provider.
 *
 * The backend runtime must treat this as an untrusted request and validate it
 * against runtime state, allowed tools, tenant context, permissions and schema
 * before any tool is executed.
 */
export interface AiProviderToolCallRequest {
  id: string;
  /** Provider-safe or original tool name requested by the model */
  name: string;
  arguments: Record<string, unknown>;
}
