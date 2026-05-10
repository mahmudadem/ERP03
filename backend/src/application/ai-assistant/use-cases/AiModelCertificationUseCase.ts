import { ApiError } from '../../../api/errors/ApiError';
import { AiCertificationCategory, isAiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiModelCertificationResult, AiModelCertificationStatus } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { AiCertificationEngine } from '../services/AiCertificationEngine';
import { AI_DATA_FILTER_POLICY_VERSION, AI_TOOL_CONTRACT_VERSION } from '../services/AiModelRoutingGuard';

export interface ManualCertificationInput {
  scope: 'GLOBAL' | 'TENANT';
  tenantId?: string;
  modelProfileId: string;
  profileHash: string;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
  score: number;
  maxScore: number;
  status: AiModelCertificationStatus;
  testSuiteVersion: string;
  toolContractVersion: string;
  dataFilterPolicyVersion: string;
  summary: string;
  failureReasons?: string[];
  metadata?: Record<string, unknown>;
  testedBy: string;
  approvedBy?: string;
}

export class AiModelCertificationUseCase {
  constructor(
    private readonly profileRepository: IAiModelProfileRepository,
    private readonly certificationRepository: IAiModelCertificationRepository,
    private readonly engine: AiCertificationEngine = new AiCertificationEngine(),
  ) {}

  async listResultsForProfile(modelProfileId: string): Promise<AiModelCertificationResult[]> {
    return this.certificationRepository.listByModelProfile(modelProfileId);
  }

  async recordManualCertification(input: ManualCertificationInput): Promise<AiModelCertificationResult> {
    this.validateManualInput(input);
    const profile = await this.requireProfile(input.modelProfileId);
    this.assertProfileMatchesScope(profile, input.scope, input.tenantId);
    if (profile.profileHash !== input.profileHash) {
      throw ApiError.badRequest('profileHash does not match current model profile hash');
    }

    const result = this.engine.run({
      scope: input.scope,
      tenantId: input.tenantId,
      profile,
      profileHash: input.profileHash,
      category: input.category,
      moduleId: input.moduleId,
      skillId: input.skillId,
      testedBy: input.testedBy,
      approvedBy: input.approvedBy,
      manual: {
        score: input.score,
        maxScore: input.maxScore,
        status: input.status,
        testSuiteVersion: input.testSuiteVersion,
        toolContractVersion: input.toolContractVersion,
        dataFilterPolicyVersion: input.dataFilterPolicyVersion,
        summary: input.summary,
        failureReasons: input.failureReasons,
        metadata: input.metadata,
      },
    });

    await this.certificationRepository.save(result);
    return result;
  }

  async runShellCertification(input: {
    scope: 'GLOBAL' | 'TENANT';
    tenantId?: string;
    modelProfileId: string;
    profileHash: string;
    category: AiCertificationCategory;
    moduleId?: string;
    skillId?: string;
    testedBy: string;
    approvedBy?: string;
  }): Promise<AiModelCertificationResult> {
    if (!isAiCertificationCategory(input.category)) {
      throw ApiError.badRequest('Invalid certification category');
    }
    const profile = await this.requireProfile(input.modelProfileId);
    this.assertProfileMatchesScope(profile, input.scope, input.tenantId);
    if (profile.profileHash !== input.profileHash) {
      throw ApiError.badRequest('profileHash does not match current model profile hash');
    }

    const result = this.engine.run({
      scope: input.scope,
      tenantId: input.tenantId,
      profile,
      profileHash: input.profileHash,
      category: input.category,
      moduleId: input.moduleId,
      skillId: input.skillId,
      testedBy: input.testedBy,
      approvedBy: input.approvedBy,
    });
    await this.certificationRepository.save(result);
    return result;
  }

  async expireCertification(id: string, userId: string): Promise<AiModelCertificationResult> {
    const existing = await this.certificationRepository.getById(id);
    if (!existing) throw ApiError.notFound(`AI certification '${id}' not found`);
    const expired = AiModelCertificationResult.fromJSON({
      ...existing.toJSON(),
      status: 'EXPIRED',
      approvedBy: userId,
      metadata: {
        ...(existing.metadata || {}),
        expiredBy: userId,
        expiredAt: new Date().toISOString(),
      },
    });
    await this.certificationRepository.save(expired);
    return expired;
  }

  async listValidCertifiedProfiles(input: {
    scope?: 'GLOBAL' | 'TENANT' | 'ALL';
    tenantId?: string;
    category?: AiCertificationCategory;
    moduleId?: string;
  }): Promise<Array<{
    profile: Record<string, unknown>;
    certifications: Record<string, unknown>[];
  }>> {
    // When scope=ALL, don't filter by scope at the repository level
    const repoFilters: { scope?: 'GLOBAL' | 'TENANT'; tenantId?: string; category?: AiCertificationCategory; moduleId?: string } = {};
    if (input.scope === 'GLOBAL') repoFilters.scope = 'GLOBAL';
    else if (input.scope === 'TENANT') repoFilters.scope = 'TENANT';
    // scope=ALL or undefined: no scope filter — fetch both GLOBAL and TENANT

    if (input.category) repoFilters.category = input.category;
    if (input.moduleId) repoFilters.moduleId = input.moduleId;

    const results = await this.certificationRepository.list(repoFilters);
    const grouped = new Map<string, { profile: AiModelProfile; certifications: AiModelCertificationResult[] }>();

    for (const result of results) {
      if (result.status !== 'CERTIFIED') continue;
      // Exclude TENANT certifications that don't belong to this tenant
      if (result.scope === 'TENANT' && result.tenantId !== input.tenantId) continue;
      if (result.toolContractVersion !== AI_TOOL_CONTRACT_VERSION) continue;
      if (result.dataFilterPolicyVersion !== AI_DATA_FILTER_POLICY_VERSION) continue;

      const profile = await this.profileRepository.getById(result.modelProfileId);
      if (!profile) continue;
      if (!profile.enabled || profile.status === 'blocked' || profile.status === 'deprecated') continue;
      if (profile.profileHash !== result.profileHash) continue;
      if (profile.scope === 'TENANT' && profile.tenantId !== input.tenantId) continue;

      const existing = grouped.get(profile.id);
      if (existing) {
        existing.certifications.push(result);
      } else {
        grouped.set(profile.id, { profile, certifications: [result] });
      }
    }

    return Array.from(grouped.values()).map(item => ({
      profile: item.profile.toJSON(),
      certifications: item.certifications.map(cert => cert.toJSON()),
    }));
  }

  private async requireProfile(modelProfileId: string): Promise<AiModelProfile> {
    const profile = await this.profileRepository.getById(modelProfileId);
    if (!profile) throw ApiError.notFound(`AI model profile '${modelProfileId}' not found`);
    return profile;
  }

  private assertProfileMatchesScope(profile: AiModelProfile, scope: 'GLOBAL' | 'TENANT', tenantId?: string): void {
    if (profile.scope !== scope) throw ApiError.badRequest(`Model profile scope is ${profile.scope}, not ${scope}`);
    if (scope === 'TENANT' && profile.tenantId !== tenantId) {
      throw ApiError.forbidden('Tenant model profile does not belong to the current company');
    }
  }

  private validateManualInput(input: ManualCertificationInput): void {
    if (!input.modelProfileId) throw ApiError.badRequest('modelProfileId is required');
    if (!input.profileHash) throw ApiError.badRequest('profileHash is required');
    if (!isAiCertificationCategory(input.category)) throw ApiError.badRequest('category is required and must be valid');
    if (!Number.isFinite(Number(input.score))) throw ApiError.badRequest('score is required');
    if (!Number.isFinite(Number(input.maxScore)) || input.maxScore <= 0) throw ApiError.badRequest('maxScore must be positive');
    if (!['CERTIFIED', 'WARNING', 'FAILED', 'EXPIRED'].includes(input.status)) {
      throw ApiError.badRequest('status must be one of: CERTIFIED, WARNING, FAILED, EXPIRED');
    }
    if (!input.testSuiteVersion) throw ApiError.badRequest('testSuiteVersion is required');
    if (!input.toolContractVersion) throw ApiError.badRequest('toolContractVersion is required');
    if (!input.dataFilterPolicyVersion) throw ApiError.badRequest('dataFilterPolicyVersion is required');
    if (!input.summary) throw ApiError.badRequest('summary is required');
    if (input.scope === 'TENANT' && !input.tenantId) throw ApiError.badRequest('tenantId is required for TENANT certification');
  }
}
