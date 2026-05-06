/**
 * AiModelToolPolicy - Domain Entity
 *
 * Controls which tools a specific AI provider/model combination can use.
 * This is per-provider-model configuration, NOT per-company.
 *
 * Default policy:
 * - defaultToolPolicy = 'read-only'  (only read-only tools allowed)
 * - allowReadOnlyTools = true
 * - allowProposalTools = false
 * - allowWriteTools = false           (write tools ALWAYS blocked)
 * - requireExplicitUserIntent = true  (deterministic mapping only)
 * - requireDeterministicMapping = true (no free-form AI function calling)
 *
 * Super Admin can override these per provider/model.
 */

export type AiToolPolicy = 'none' | 'read-only' | 'proposal-only' | 'all';

export interface AiModelToolPolicyProps {
  id: string;                              // Composite: providerConfigId + model
  providerConfigId: string;                 // Reference to the provider config (company-scoped)
  providerType: string;                     // 'mock' | 'openai_compatible' | 'ollama'
  model: string;                            // e.g., 'gpt-4o', 'llama3', 'mock'
  defaultToolPolicy: AiToolPolicy;          // Default policy for this provider/model
  allowedTools: string[];                   // Explicitly allowed tool names
  disabledTools: string[];                  // Explicitly disabled tool names
  allowReadOnlyTools: boolean;              // Whether read-only tools can execute
  allowProposalTools: boolean;              // Whether proposal tools can execute
  allowWriteTools: boolean;                // Always false — write tools are ALWAYS blocked
  maxToolCallsPerMessage: number;          // Max tools invoked per chat message
  maxToolResultBytes: number;              // Max size of tool result data in bytes
  requireExplicitUserIntent: boolean;        // Only deterministic mapping, no AI function calling
  requireDeterministicMapping: boolean;      // Intent detection (keywords) only, not AI selection
  createdAt: Date;
  updatedAt: Date;
}

export class AiModelToolPolicy implements AiModelToolPolicyProps {
  constructor(
    public id: string,
    public providerConfigId: string,
    public providerType: string,
    public model: string,
    public defaultToolPolicy: AiToolPolicy = 'read-only',
    public allowedTools: string[] = [],
    public disabledTools: string[] = [],
    public allowReadOnlyTools: boolean = true,
    public allowProposalTools: boolean = false,
    public allowWriteTools: boolean = false,  // ALWAYS false — write tools blocked
    public maxToolCallsPerMessage: number = 2,
    public maxToolResultBytes: number = 50000,
    public requireExplicitUserIntent: boolean = true,
    public requireDeterministicMapping: boolean = true,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  /**
   * Check if a specific tool is allowed for this provider/model combination.
   */
  isToolAllowed(toolName: string, toolMode: 'read-only' | 'proposal' | 'write'): boolean {
    // Write tools are ALWAYS blocked
    if (toolMode === 'write') return false;

    // Explicitly disabled = hard block
    if (this.disabledTools.includes(toolName)) return false;

    // Explicitly allowed = hard allow (unless write)
    if (this.allowedTools.includes(toolName)) return true;

    // Policy-based checks
    if (this.defaultToolPolicy === 'none') return false;

    if (toolMode === 'proposal' && !this.allowProposalTools) return false;
    if (toolMode === 'read-only' && !this.allowReadOnlyTools) return false;

    return true;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      providerConfigId: this.providerConfigId,
      providerType: this.providerType,
      model: this.model,
      defaultToolPolicy: this.defaultToolPolicy,
      allowedTools: this.allowedTools,
      disabledTools: this.disabledTools,
      allowReadOnlyTools: this.allowReadOnlyTools,
      allowProposalTools: this.allowProposalTools,
      allowWriteTools: this.allowWriteTools,
      maxToolCallsPerMessage: this.maxToolCallsPerMessage,
      maxToolResultBytes: this.maxToolResultBytes,
      requireExplicitUserIntent: this.requireExplicitUserIntent,
      requireDeterministicMapping: this.requireDeterministicMapping,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): AiModelToolPolicy {
    return new AiModelToolPolicy(
      data.id as string,
      data.providerConfigId as string,
      data.providerType as string,
      data.model as string,
      (data.defaultToolPolicy as AiToolPolicy) ?? 'read-only',
      (data.allowedTools as string[]) ?? [],
      (data.disabledTools as string[]) ?? [],
      (data.allowReadOnlyTools as boolean) ?? true,
      (data.allowProposalTools as boolean) ?? false,
      (data.allowWriteTools as boolean) ?? false,
      (data.maxToolCallsPerMessage as number) ?? 2,
      (data.maxToolResultBytes as number) ?? 50000,
      (data.requireExplicitUserIntent as boolean) ?? true,
      (data.requireDeterministicMapping as boolean) ?? true,
      new Date(data.createdAt as string),
      new Date(data.updatedAt as string),
    );
  }
}