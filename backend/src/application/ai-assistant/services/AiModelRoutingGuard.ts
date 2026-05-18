import { AiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';

export const AI_TOOL_CONTRACT_VERSION = 'ai-tool-contract-v2';
export const AI_DATA_FILTER_POLICY_VERSION = 'ai-data-filter-v1';

export interface AiRoutingGuardRequest {
  tenantId: string;
  config: AiProviderConfig;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
  toolContractVersion?: string;
  dataFilterPolicyVersion?: string;
}

export interface AiRoutingGuardDecision {
  allowed: boolean;
  reason?: string;
  code?: string;
  modelProfileId?: string;
  profileHash?: string;
  certificationId?: string;
  warning?: string; // Set when allowed but the cert is WARNING / unverified
}

// Generic fallback. Specific codes get their own per-code messages below so the
// chat UI can show the user what is actually wrong (stale cert, missing cert,
// platform-managed model needs re-cert, etc.).
const ROUTING_ERROR = 'This model profile is not certified for this ERP module/workflow. Please select a certified profile or run company certification.';

const REASON_BY_CODE: Record<string, string> = {
  AI_DISABLED: 'AI Assistant is disabled for this company.',
  MODEL_PROFILE_NOT_CERTIFIED: 'Tenant settings are not pointing at a certified profile. Open AI Settings and pick a model.',
  MISSING_SELECTED_PROFILE: 'No model is currently selected. Open AI Settings and pick a certified model.',
  MODEL_PROFILE_NOT_FOUND: 'The selected model no longer exists. Open AI Settings and pick a different model.',
  MODEL_PROFILE_BLOCKED: 'The selected model has been disabled or deprecated by the platform. Open AI Settings and pick a different model.',
  TENANT_PROFILE_SCOPE_MISMATCH: 'The selected model belongs to another company. Open AI Settings and pick a model that belongs to this company.',
  PROVIDER_PROFILE_MISMATCH: 'Your AI provider does not match the selected model. Open AI Settings and re-pick the model.',
  MODEL_ID_PROFILE_MISMATCH: 'Your selected model id does not match the saved profile. Open AI Settings and re-pick the model.',
  STALE_PROFILE_HASH: 'Your model configuration has changed since it was certified. Re-run certification before using tools.',
  PLATFORM_PROFILE_NEEDS_RECERT: 'This platform model was updated and needs to be re-certified by the platform team before tools can be used. Tools are disabled until then.',
  CERTIFICATION_NOT_FOUND: 'No valid certification exists for this model in this ERP module yet. Run certification before using tools.',
  CERTIFICATION_STALE: 'Certification for this model is out of date (tool contract / data filter version changed). It must be re-run before tools are enabled.',
};

function reasonFor(code: keyof typeof REASON_BY_CODE | string): string {
  return REASON_BY_CODE[code] ?? ROUTING_ERROR;
}

export class AiModelRoutingGuard {
  constructor(
    private readonly profileRepository: IAiModelProfileRepository,
    private readonly certificationRepository: IAiModelCertificationRepository,
  ) {}

  async validateSensitiveWorkflow(input: AiRoutingGuardRequest): Promise<AiRoutingGuardDecision> {
    const { tenantId, config } = input;

    if (!config.isEnabled) {
      return this.reject('AI_DISABLED');
    }

    if (config.mode !== 'certified_profile') {
      return this.reject('MODEL_PROFILE_NOT_CERTIFIED');
    }

    if (!config.selectedModelProfileId) {
      return this.reject('MISSING_SELECTED_PROFILE');
    }

    const profile = await this.profileRepository.getById(config.selectedModelProfileId);
    if (!profile) {
      return this.reject('MODEL_PROFILE_NOT_FOUND');
    }

    if (!profile.enabled || profile.status === 'blocked' || profile.status === 'deprecated') {
      return this.reject('MODEL_PROFILE_BLOCKED', profile.id, profile.profileHash);
    }

    if (profile.scope === 'TENANT' && profile.tenantId !== tenantId) {
      return this.reject('TENANT_PROFILE_SCOPE_MISMATCH', profile.id, profile.profileHash);
    }

    if (profile.providerId !== (config.providerId || config.provider)) {
      return this.reject('PROVIDER_PROFILE_MISMATCH', profile.id, profile.profileHash);
    }

    if (config.model && profile.modelId !== config.model) {
      return this.reject('MODEL_ID_PROFILE_MISMATCH', profile.id, profile.profileHash);
    }

    // Platform-managed profile (CREDITS mode + GLOBAL scope): the tenant did
    // not author this profile, so they should NOT be punished when the
    // platform team edits it. The tenant's stored `selectedProfileHash` is
    // ignored on this path; certification is looked up against the profile's
    // CURRENT hash, and any version drift becomes a platform-team problem
    // (CERTIFICATION_STALE), not a tenant problem.
    //
    // For BYOK or TENANT-scope profiles the tenant owns the configuration and
    // the hash works as a tamper seal — keep enforcing it.
    const runtimeMode = config.runtimeMode || 'BYOK';
    const platformManaged = runtimeMode === 'CREDITS' && profile.scope === 'GLOBAL';

    if (!platformManaged) {
      if (!config.selectedProfileHash) {
        return this.reject('MISSING_SELECTED_PROFILE', profile.id, profile.profileHash);
      }
      if (config.selectedProfileHash !== profile.profileHash) {
        return this.reject('STALE_PROFILE_HASH', profile.id, profile.profileHash);
      }
    }

    const certification = await this.certificationRepository.findValidForRouting({
      tenantId,
      modelProfileId: profile.id,
      profileHash: profile.profileHash, // Always look up against the CURRENT profile hash
      category: input.category,
      moduleId: input.moduleId,
      skillId: input.skillId,
      toolContractVersion: input.toolContractVersion || AI_TOOL_CONTRACT_VERSION,
      dataFilterPolicyVersion: input.dataFilterPolicyVersion || AI_DATA_FILTER_POLICY_VERSION,
    });

    if (!certification) {
      // Hybrid escape hatch — only honored when the tenant has explicitly opted
      // in to unverified models AND the profile is not platform-managed.
      // We never let a tenant flip this for a GLOBAL profile in CREDITS mode,
      // because that would let one tenant turn off the platform's safety bar.
      if (config.allowUnverifiedModels && !platformManaged) {
        return {
          allowed: true,
          modelProfileId: profile.id,
          profileHash: profile.profileHash,
          warning: 'MODEL_NOT_CERTIFIED',
          reason: 'This model is not certified for this module. Using in unverified mode.',
        };
      }

      // Distinguish "never tested" vs "tested but stale" to give superadmin /
      // company admin a useful next step.
      const hasAnyForProfileCategory = await this.hasAnyCertificationForProfileCategory(profile.id, input.category);
      const code = platformManaged
        ? 'PLATFORM_PROFILE_NEEDS_RECERT'
        : hasAnyForProfileCategory
          ? 'CERTIFICATION_STALE'
          : 'CERTIFICATION_NOT_FOUND';
      return this.reject(code, profile.id, profile.profileHash);
    }

    return {
      allowed: true,
      modelProfileId: profile.id,
      profileHash: profile.profileHash,
      certificationId: certification.id,
      warning: certification.status === 'WARNING' ? 'MODEL_CERTIFICATION_WARNING' : undefined,
    };
  }

  /**
   * True when at least one cert record exists for this profile + category,
   * regardless of hash or version. Used to distinguish "never certified" from
   * "certified but the profile / contract has drifted since".
   */
  private async hasAnyCertificationForProfileCategory(
    modelProfileId: string,
    category: AiCertificationCategory,
  ): Promise<boolean> {
    try {
      const all = await this.certificationRepository.listByModelProfile(modelProfileId);
      return all.some(c => c.category === category);
    } catch {
      return false;
    }
  }

  private reject(
    code: keyof typeof REASON_BY_CODE | string,
    modelProfileId?: string,
    profileHash?: string,
  ): AiRoutingGuardDecision {
    return {
      allowed: false,
      code: String(code),
      reason: reasonFor(code),
      modelProfileId,
      profileHash,
    };
  }
}

export function certificationCategoryForModule(moduleId?: string): AiCertificationCategory {
  switch ((moduleId || '').toLowerCase()) {
    case 'accounting':
      return 'ACCOUNTING';
    case 'reports':
      return 'FINANCE_REPORTING';
    case 'sales':
      return 'SALES';
    case 'purchase':
    case 'purchases':
      return 'PURCHASES';
    case 'inventory':
      return 'INVENTORY';
    case 'hr':
      return 'HR';
    case 'crm':
      return 'CRM';
    default:
      return 'TOOL_CALLING';
  }
}
