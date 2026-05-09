import { AiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';

export const AI_TOOL_CONTRACT_VERSION = 'ai-tool-contract-v1';
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
}

const ROUTING_ERROR = 'This model profile is not certified for this ERP module/workflow. Please select a certified profile or run company certification.';

export class AiModelRoutingGuard {
  constructor(
    private readonly profileRepository: IAiModelProfileRepository,
    private readonly certificationRepository: IAiModelCertificationRepository,
  ) {}

  async validateSensitiveWorkflow(input: AiRoutingGuardRequest): Promise<AiRoutingGuardDecision> {
    const { tenantId, config } = input;

    if (!config.isEnabled) {
      return this.reject('AI_DISABLED', 'AI Assistant is disabled for this company.');
    }

    if (config.mode !== 'certified_profile') {
      return this.reject('MODEL_PROFILE_NOT_CERTIFIED', ROUTING_ERROR);
    }

    if (!config.selectedModelProfileId || !config.selectedProfileHash) {
      return this.reject('MISSING_SELECTED_PROFILE', ROUTING_ERROR);
    }

    const profile = await this.profileRepository.getById(config.selectedModelProfileId);
    if (!profile) {
      return this.reject('MODEL_PROFILE_NOT_FOUND', ROUTING_ERROR);
    }

    if (!profile.enabled || profile.status === 'blocked' || profile.status === 'deprecated') {
      return this.reject('MODEL_PROFILE_BLOCKED', ROUTING_ERROR, profile.id, profile.profileHash);
    }

    if (profile.scope === 'TENANT' && profile.tenantId !== tenantId) {
      return this.reject('TENANT_PROFILE_SCOPE_MISMATCH', ROUTING_ERROR, profile.id, profile.profileHash);
    }

    if (profile.providerId !== (config.providerId || config.provider)) {
      return this.reject('PROVIDER_PROFILE_MISMATCH', ROUTING_ERROR, profile.id, profile.profileHash);
    }

    if (config.model && profile.modelId !== config.model) {
      return this.reject('MODEL_ID_PROFILE_MISMATCH', ROUTING_ERROR, profile.id, profile.profileHash);
    }

    if (config.selectedProfileHash !== profile.profileHash) {
      return this.reject('STALE_PROFILE_HASH', ROUTING_ERROR, profile.id, profile.profileHash);
    }

    const certification = await this.certificationRepository.findValidForRouting({
      tenantId,
      modelProfileId: profile.id,
      profileHash: profile.profileHash,
      category: input.category,
      moduleId: input.moduleId,
      skillId: input.skillId,
      toolContractVersion: input.toolContractVersion || AI_TOOL_CONTRACT_VERSION,
      dataFilterPolicyVersion: input.dataFilterPolicyVersion || AI_DATA_FILTER_POLICY_VERSION,
    });

    if (!certification) {
      return this.reject('CERTIFICATION_NOT_FOUND', ROUTING_ERROR, profile.id, profile.profileHash);
    }

    return {
      allowed: true,
      modelProfileId: profile.id,
      profileHash: profile.profileHash,
      certificationId: certification.id,
    };
  }

  private reject(
    code: string,
    reason: string,
    modelProfileId?: string,
    profileHash?: string,
  ): AiRoutingGuardDecision {
    return { allowed: false, code, reason, modelProfileId, profileHash };
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
