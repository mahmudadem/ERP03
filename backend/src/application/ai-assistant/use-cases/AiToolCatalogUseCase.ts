/**
 * AiToolCatalogUseCase - Use cases for managing the AI Tool Catalog
 *
 * Provides:
 * - Listing all tool definitions (with filters)
 * - Getting a specific tool definition
 * - Updating tool status (enable/disable)
 * - Getting tool enablement policies
 * - Updating enablement policies
 * - Getting model tool policies
 * - Updating model tool policies
 *
 * SUPER ADMIN ONLY — these operations are restricted to platform administrators.
 *
 * SAFETY:
 * - WRITE tools (mode: 'write') can NEVER be enabled
 * - Blocked tools (riskLevel: 'blocked') can NEVER be enabled
 * - Proposal tools require explicit enablement (enabledByDefault: false)
 */

import { IAiToolCatalogRepository } from '../../../repository/interfaces/ai-assistant/IAiToolCatalogRepository';
import { IAiToolEnablementRepository } from '../../../repository/interfaces/ai-assistant/IAiToolEnablementRepository';
import { IAiModelToolPolicyRepository } from '../../../repository/interfaces/ai-assistant/IAiModelToolPolicyRepository';
import {
  AI_TOOL_CATALOG,
  getCatalogDefinition,
} from '../catalog/AiToolCatalogSeed';
import { AiToolDefinition } from '../../../domain/ai-assistant/entities/AiToolDefinition';
import { AiToolEnablementPolicy } from '../../../domain/ai-assistant/entities/AiToolEnablementPolicy';
import { AiModelToolPolicy } from '../../../domain/ai-assistant/entities/AiModelToolPolicy';

export class AiToolCatalogUseCase {
  constructor(
    private catalogRepo: IAiToolCatalogRepository,
    private enablementRepo: IAiToolEnablementRepository,
    private modelPolicyRepo: IAiModelToolPolicyRepository,
  ) {}

  // ─── Catalog Operations ──────────────────────────────────────────────

  /**
   * Get all tool definitions from the catalog.
   * Merges the static seed with any DB overrides.
   */
  async listCatalog(filters?: {
    module?: string;
    category?: string;
    status?: string;
    mode?: string;
  }): Promise<AiToolDefinition[]> {
    // Start with seed definitions
    let definitions = [...AI_TOOL_CATALOG];

    // Overlay with DB overrides (status changes, etc.)
    const dbDefinitions = await this.catalogRepo.list();
    const dbMap = new Map(dbDefinitions.map(d => [d.id, d]));

    // Merge: DB overrides take precedence for status changes
    definitions = definitions.map(seed => {
      const dbOverride = dbMap.get(seed.id);
      if (dbOverride) {
        // DB override can change status but NOT mode, permissions, or safety properties
        return new AiToolDefinition(
          seed.id,
          seed.name,
          seed.namespace,
          seed.moduleId,
          seed.description,
          seed.category,
          dbOverride.status, // DB override for status
          seed.mode, // Mode is ALWAYS from seed (safety)
          seed.requiredPermissions,
          seed.requiredModules,
          seed.inputSchema,
          seed.outputSchema,
          dbOverride.enabledByDefault, // DB can override default enablement
          seed.supportsChatInvocation,
          seed.supportsManualExecution,
          seed.riskLevel, // Risk level is ALWAYS from seed (safety)
          seed.dataSensitivity, // Sensitivity is ALWAYS from seed (safety)
          seed.unavailabilityReason,
          seed.createdAt,
          dbOverride.updatedAt,
        );
      }
      return seed;
    });

    // Apply filters
    if (filters?.module) {
      definitions = definitions.filter(d => d.moduleId === filters.module);
    }
    if (filters?.category) {
      definitions = definitions.filter(d => d.category === filters.category);
    }
    if (filters?.status) {
      definitions = definitions.filter(d => d.status === filters.status);
    }
    if (filters?.mode) {
      definitions = definitions.filter(d => d.mode === filters.mode);
    }

    return definitions;
  }

  /**
   * Get a single tool definition by name.
   */
  async getCatalogEntry(toolName: string): Promise<AiToolDefinition | null> {
    const seed = getCatalogDefinition(toolName);
    if (!seed) return null;

    // Check DB override
    const dbOverride = await this.catalogRepo.getById(seed.id);
    if (dbOverride) {
      return new AiToolDefinition(
        seed.id,
        seed.name,
        seed.namespace,
        seed.moduleId,
        seed.description,
        seed.category,
        dbOverride.status,
        seed.mode,
        seed.requiredPermissions,
        seed.requiredModules,
        seed.inputSchema,
        seed.outputSchema,
        dbOverride.enabledByDefault,
        seed.supportsChatInvocation,
        seed.supportsManualExecution,
        seed.riskLevel,
        seed.dataSensitivity,
        seed.unavailabilityReason,
        seed.createdAt,
        dbOverride.updatedAt,
      );
    }

    return seed;
  }

  /**
   * Update a tool's status (enable/disable).
   * SAFETY: Write tools and blocked tools can NEVER be enabled.
   */
  async updateToolStatus(
    toolName: string,
    newStatus: 'active' | 'disabled' | 'deprecated',
    updatedBy: string,
  ): Promise<AiToolDefinition> {
    const seed = getCatalogDefinition(toolName);
    if (!seed) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // SAFETY: Write tools and blocked tools can NEVER be enabled
    if (seed.isBlocked && newStatus === 'active') {
      throw new Error(`Cannot enable blocked/write tool: ${toolName}. Write tools are permanently blocked for safety.`);
    }

    const definition = new AiToolDefinition(
      seed.id,
      seed.name,
      seed.namespace,
      seed.moduleId,
      seed.description,
      seed.category,
      newStatus,
      seed.mode,
      seed.requiredPermissions,
      seed.requiredModules,
      seed.inputSchema,
      seed.outputSchema,
      seed.enabledByDefault,
      seed.supportsChatInvocation,
      seed.supportsManualExecution,
      seed.riskLevel,
      seed.dataSensitivity,
      seed.unavailabilityReason,
      seed.createdAt,
      new Date(),
    );

    await this.catalogRepo.save(definition);
    return definition;
  }

  /**
   * Enable a tool globally.
   * SAFETY: Write tools can NEVER be enabled.
   */
  async enableTool(toolName: string, updatedBy: string): Promise<AiToolDefinition> {
    return this.updateToolStatus(toolName, 'active', updatedBy);
  }

  /**
   * Disable a tool globally.
   */
  async disableTool(toolName: string, updatedBy: string): Promise<AiToolDefinition> {
    return this.updateToolStatus(toolName, 'disabled', updatedBy);
  }

  // ─── Enablement Policy Operations ────────────────────────────────────

  /**
   * Get all enablement policies.
   */
  async listEnablementPolicies(): Promise<AiToolEnablementPolicy[]> {
    return this.enablementRepo.list();
  }

  /**
   * Get enablement policy for a specific tool.
   */
  async getEnablementPolicy(toolId: string): Promise<AiToolEnablementPolicy | null> {
    return this.enablementRepo.getByToolId(toolId);
  }

  /**
   * Update an enablement policy.
   * SAFETY: Write tools can NEVER have policy that enables them.
   */
  async updateEnablementPolicy(
    policy: AiToolEnablementPolicy,
    updatedBy: string,
  ): Promise<AiToolEnablementPolicy> {
    // SAFETY: Check that the tool is not a write/blocked tool
    const seed = getCatalogDefinition(policy.toolId);
    if (seed && seed.isBlocked && policy.globallyEnabled) {
      throw new Error(`Cannot enable policy for blocked/write tool: ${policy.toolId}. Write tools are permanently blocked for safety.`);
    }

    await this.enablementRepo.save(policy);
    return policy;
  }

  // ─── Model Tool Policy Operations ───────────────────────────────────

  /**
   * Get all model tool policies.
   */
  async listModelToolPolicies(): Promise<AiModelToolPolicy[]> {
    return this.modelPolicyRepo.list();
  }

  /**
   * Get model tool policy for a specific provider/model.
   */
  async getModelToolPolicy(policyId: string): Promise<AiModelToolPolicy | null> {
    return this.modelPolicyRepo.getById(policyId);
  }

  /**
   * Update a model tool policy.
   * SAFETY: Write tools can NEVER be allowed by model policy.
   */
  async updateModelToolPolicy(
    policy: AiModelToolPolicy,
    updatedBy: string,
  ): Promise<AiModelToolPolicy> {
    // SAFETY: Enforce that write tools are never allowed
    const enforcedPolicy = new AiModelToolPolicy(
      policy.id,
      policy.providerConfigId,
      policy.providerType,
      policy.model,
      policy.defaultToolPolicy,
      policy.allowedTools,
      policy.disabledTools,
      policy.allowReadOnlyTools,
      policy.allowProposalTools,
      false, // allowWriteTools is ALWAYS false
      policy.maxToolCallsPerMessage,
      policy.maxToolResultBytes,
      policy.requireExplicitUserIntent,
      policy.requireDeterministicMapping,
      policy.createdAt,
      new Date(),
    );

    await this.modelPolicyRepo.save(enforcedPolicy);
    return enforcedPolicy;
  }

  /**
   * Get the default model tool policy for a provider/model combination.
   * Returns a default policy if no specific policy exists.
   */
  getDefaultModelToolPolicy(providerType: string, model: string): AiModelToolPolicy {
    return new AiModelToolPolicy(
      `${providerType}:${model}`,
      '',  // No specific config
      providerType,
      model,
      'read-only',  // Default: only read-only tools allowed
      [],  // No explicit allow list = all read-only tools
      [],  // No explicit deny list
      true,  // allowReadOnlyTools
      false, // allowProposalTools
      false, // allowWriteTools — ALWAYS false
      2,     // maxToolCallsPerMessage
      50000, // maxToolResultBytes
      true,  // requireExplicitUserIntent
      true,  // requireDeterministicMapping
    );
  }

  // ─── Seed Sync ──────────────────────────────────────────────────────

  /**
   * Sync the static catalog seed into the DB.
   * This ensures the DB has entries for all tools so Super Admin can override their status.
   * Does NOT overwrite DB overrides — only creates entries that don't exist yet.
   */
  async syncCatalogToDb(): Promise<number> {
    let synced = 0;
    for (const seed of AI_TOOL_CATALOG) {
      const existing = await this.catalogRepo.getById(seed.id);
      if (!existing) {
        await this.catalogRepo.save(seed);
        synced++;
      }
    }
    return synced;
  }
}