/**
 * AiToolEnablementPolicy - Domain Entity
 *
 * Controls WHICH tools are enabled for WHICH contexts.
 * Super Admin can override enablement at various levels:
 * - Globally enabled/disabled
 * - Per plan (starter, professional, enterprise)
 * - Per company (explicit override)
 * - Per module (only if module is active)
 * - Per provider/model (AI provider restrictions)
 * - Per role (role-based access)
 * - Rate limits per message, day, company, user
 *
 * DENY takes precedence over ALLOW at every level.
 * If a tool is globally disabled, no override can enable it.
 * If a tool is disabled for a specific company, that company cannot use it.
 */

export interface AiToolEnablementPolicyProps {
  toolId: string;                      // Matches AiToolDefinition.id
  globallyEnabled: boolean;             // Global on/off switch
  enabledForPlans: string[];            // Plans where this tool is available
  disabledForPlans: string[];           // Plans where this tool is explicitly denied
  enabledForCompanies: string[];        // Specific companies allowed (whitelist)
  disabledForCompanies: string[];       // Specific companies denied (blacklist)
  enabledForModules: string[];          // Modules where this tool is available
  disabledForModules: string[];         // Modules where this tool is explicitly denied
  enabledForProviders: string[];         // Provider types where available (e.g., 'openai_compatible')
  disabledForProviders: string[];        // Provider types where denied
  enabledForModels: string[];           // Specific models where available (e.g., 'gpt-4o')
  disabledForModels: string[];          // Specific models where denied
  enabledForRoles: string[];            // Roles allowed to use this tool
  disabledForRoles: string[];           // Roles explicitly denied
  allowedPermissions: string[];          // Alternative: instead of requiredPermissions, allow these
  maxCallsPerMessage: number;           // Max times this tool can be called per chat message
  maxCallsPerDayPerCompany: number;     // Max daily calls per company
  maxCallsPerDayPerUser: number;        // Max daily calls per user
}

export class AiToolEnablementPolicy implements AiToolEnablementPolicyProps {
  constructor(
    public toolId: string,
    public globallyEnabled: boolean = true,
    public enabledForPlans: string[] = [],
    public disabledForPlans: string[] = [],
    public enabledForCompanies: string[] = [],
    public disabledForCompanies: string[] = [],
    public enabledForModules: string[] = [],
    public disabledForModules: string[] = [],
    public enabledForProviders: string[] = [],
    public disabledForProviders: string[] = [],
    public enabledForModels: string[] = [],
    public disabledForModels: string[] = [],
    public enabledForRoles: string[] = [],
    public disabledForRoles: string[] = [],
    public allowedPermissions: string[] = [],
    public maxCallsPerMessage: number = 2,
    public maxCallsPerDayPerCompany: number = 100,
    public maxCallsPerDayPerUser: number = 50,
  ) {}

  /**
   * Check if a tool is enabled for a specific context.
   * DENY takes precedence over ALLOW at every level.
   */
  isEnabledForContext(context: {
    plan?: string;
    companyId?: string;
    modules?: string[];
    provider?: string;
    model?: string;
    roles?: string[];
  }): boolean {
    // 1. Global disable = hard block
    if (!this.globallyEnabled) return false;

    // 2. Plan deny takes precedence over plan allow
    if (context.plan) {
      if (this.disabledForPlans.includes(context.plan)) return false;
      if (this.enabledForPlans.length > 0 && !this.enabledForPlans.includes(context.plan)) return false;
    }

    // 3. Company deny takes precedence over company allow
    if (context.companyId) {
      if (this.disabledForCompanies.includes(context.companyId)) return false;
      if (this.enabledForCompanies.length > 0 && !this.enabledForCompanies.includes(context.companyId)) return false;
    }

    // 4. Module deny takes precedence over module allow
    if (context.modules && context.modules.length > 0) {
      if (this.disabledForModules.some(m => context.modules!.includes(m))) return false;
      if (this.enabledForModules.length > 0 && !this.enabledForModules.some(m => context.modules!.includes(m))) return false;
    }

    // 5. Provider deny
    if (context.provider) {
      if (this.disabledForProviders.includes(context.provider)) return false;
      if (this.enabledForProviders.length > 0 && !this.enabledForProviders.includes(context.provider)) return false;
    }

    // 6. Model deny
    if (context.model) {
      if (this.disabledForModels.includes(context.model)) return false;
      if (this.enabledForModels.length > 0 && !this.enabledForModels.includes(context.model)) return false;
    }

    // 7. Role deny
    if (context.roles && context.roles.length > 0) {
      if (this.disabledForRoles.some(r => context.roles!.includes(r))) return false;
      if (this.enabledForRoles.length > 0 && !this.enabledForRoles.some(r => context.roles!.includes(r))) return false;
    }

    return true;
  }

  toJSON(): Record<string, unknown> {
    return {
      toolId: this.toolId,
      globallyEnabled: this.globallyEnabled,
      enabledForPlans: this.enabledForPlans,
      disabledForPlans: this.disabledForPlans,
      enabledForCompanies: this.enabledForCompanies,
      disabledForCompanies: this.disabledForCompanies,
      enabledForModules: this.enabledForModules,
      disabledForModules: this.disabledForModules,
      enabledForProviders: this.enabledForProviders,
      disabledForProviders: this.disabledForProviders,
      enabledForModels: this.enabledForModels,
      disabledForModels: this.disabledForModels,
      enabledForRoles: this.enabledForRoles,
      disabledForRoles: this.disabledForRoles,
      allowedPermissions: this.allowedPermissions,
      maxCallsPerMessage: this.maxCallsPerMessage,
      maxCallsPerDayPerCompany: this.maxCallsPerDayPerCompany,
      maxCallsPerDayPerUser: this.maxCallsPerDayPerUser,
    };
  }

  static fromJSON(data: Record<string, unknown>): AiToolEnablementPolicy {
    return new AiToolEnablementPolicy(
      data.toolId as string,
      data.globallyEnabled as boolean ?? true,
      (data.enabledForPlans as string[]) ?? [],
      (data.disabledForPlans as string[]) ?? [],
      (data.enabledForCompanies as string[]) ?? [],
      (data.disabledForCompanies as string[]) ?? [],
      (data.enabledForModules as string[]) ?? [],
      (data.disabledForModules as string[]) ?? [],
      (data.enabledForProviders as string[]) ?? [],
      (data.disabledForProviders as string[]) ?? [],
      (data.enabledForModels as string[]) ?? [],
      (data.disabledForModels as string[]) ?? [],
      (data.enabledForRoles as string[]) ?? [],
      (data.disabledForRoles as string[]) ?? [],
      (data.allowedPermissions as string[]) ?? [],
      (data.maxCallsPerMessage as number) ?? 2,
      (data.maxCallsPerDayPerCompany as number) ?? 100,
      (data.maxCallsPerDayPerUser as number) ?? 50,
    );
  }
}