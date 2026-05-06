/**
 * AiToolDefinition - Domain Entity for AI Tool Catalog
 *
 * Defines the metadata, permissions, and status of every AI tool
 * that can be registered in the system.
 *
 * DESIGN PRINCIPLES:
 * 1. ALL tools are categorized by mode (read-only, proposal, write)
 * 2. WRITE tools are ALWAYS blocked — they can never be executed
 * 3. PROPOSAL tools are disabled by default
 * 4. READ-ONLY tools are the only ones that can execute
 * 5. Tools can be globally enabled/disabled by Super Admin
 * 6. Each tool declares required modules and permissions
 * 7. Unavailable tools (missing underlying module) return DATA_UNAVAILABLE
 *
 * This entity is the SINGLE SOURCE OF TRUTH for the tool catalog.
 * The AiToolRegistry uses these definitions for routing and policy enforcement.
 */

export type AiToolStatus = 'active' | 'disabled' | 'unavailable' | 'deprecated';
export type AiToolMode = 'read-only' | 'proposal' | 'write';
export type AiToolRiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export type AiToolDataSensitivity = 'low' | 'medium' | 'high';
export type AiToolCategory =
  | 'accounting'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'crm'
  | 'vendors'
  | 'hr'
  | 'reports'
  | 'audit'
  | 'platform'
  | 'system'
  | 'BLOCKED';

export interface AiToolDefinitionProps {
  id: string;
  name: string;                    // Unique identifier: 'module.actionSubaction'
  namespace: string;                // e.g., 'accounting', 'sales', 'inventory'
  moduleId: string;                 // Required module: 'accounting', 'inventory', etc.
  description: string;             // Human-readable description
  category: AiToolCategory;         // Business category
  status: AiToolStatus;             // active, disabled, unavailable, deprecated
  mode: AiToolMode;                 // read-only, proposal, write
  requiredPermissions: string[];     // Permissions needed to use this tool
  requiredModules: string[];         // Modules that must be active for the tool to work
  inputSchema: Record<string, unknown>;  // JSON Schema for tool inputs
  outputSchema: Record<string, unknown>; // JSON Schema for tool outputs
  enabledByDefault: boolean;        // Whether the tool is enabled for new companies
  supportsChatInvocation: boolean;  // Can be triggered via chat intent detection
  supportsManualExecution: boolean; // Can be called via API endpoint
  riskLevel: AiToolRiskLevel;       // Security risk level
  dataSensitivity: AiToolDataSensitivity; // Data sensitivity classification
  unavailabilityReason?: string;    // Why the tool is unavailable (e.g., "HR module not implemented")
  createdAt: Date;
  updatedAt: Date;
}

export class AiToolDefinition implements AiToolDefinitionProps {
  constructor(
    public id: string,
    public name: string,
    public namespace: string,
    public moduleId: string,
    public description: string,
    public category: AiToolCategory,
    public status: AiToolStatus,
    public mode: AiToolMode,
    public requiredPermissions: string[],
    public requiredModules: string[],
    public inputSchema: Record<string, unknown>,
    public outputSchema: Record<string, unknown>,
    public enabledByDefault: boolean,
    public supportsChatInvocation: boolean,
    public supportsManualExecution: boolean,
    public riskLevel: AiToolRiskLevel,
    public dataSensitivity: AiToolDataSensitivity,
    public unavailabilityReason?: string,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  /**
   * Is this tool executable? Only active, read-only tools can execute.
   * Write tools are ALWAYS blocked. Proposal tools require explicit enablement.
   */
  get isExecutable(): boolean {
    if (this.mode === 'write') return false;
    if (this.status === 'unavailable' || this.status === 'deprecated') return false;
    if (this.mode === 'proposal' && this.status !== 'active') return false;
    return this.status === 'active';
  }

  /**
   * Is this tool blocked from ever executing?
   */
  get isBlocked(): boolean {
    return this.mode === 'write' || this.riskLevel === 'blocked';
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      namespace: this.namespace,
      moduleId: this.moduleId,
      description: this.description,
      category: this.category,
      status: this.status,
      mode: this.mode,
      readOnly: this.mode === 'read-only',
      requiredPermissions: this.requiredPermissions,
      requiredModules: this.requiredModules,
      enabledByDefault: this.enabledByDefault,
      supportsChatInvocation: this.supportsChatInvocation,
      supportsManualExecution: this.supportsManualExecution,
      riskLevel: this.riskLevel,
      dataSensitivity: this.dataSensitivity,
      isExecutable: this.isExecutable,
      isBlocked: this.isBlocked,
      unavailabilityReason: this.unavailabilityReason,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): AiToolDefinition {
    return new AiToolDefinition(
      data.id as string,
      data.name as string,
      data.namespace as string,
      data.moduleId as string,
      data.description as string,
      data.category as AiToolCategory,
      data.status as AiToolStatus,
      data.mode as AiToolMode,
      data.requiredPermissions as string[],
      data.requiredModules as string[],
      data.inputSchema as Record<string, unknown>,
      data.outputSchema as Record<string, unknown>,
      data.enabledByDefault as boolean,
      data.supportsChatInvocation as boolean,
      data.supportsManualExecution as boolean,
      data.riskLevel as AiToolRiskLevel,
      data.dataSensitivity as AiToolDataSensitivity,
      data.unavailabilityReason as string | undefined,
      new Date(data.createdAt as string),
      new Date(data.updatedAt as string),
    );
  }
}