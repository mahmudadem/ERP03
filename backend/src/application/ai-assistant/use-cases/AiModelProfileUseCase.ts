import {
  AiModelDiagnosticStatus,
  AiModelProfile,
  AiModelRuntimeMode,
  AiModelStatus,
  AiModelWarningLevel,
} from '../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { AiModelCapabilityCatalog, AiModelProfile as RuntimeModelProfile } from '../services/AiModelCapabilityCatalog';

export interface UpsertAiModelProfileInput {
  provider: string;
  modelName: string;
  status: AiModelStatus;
  supportsToolCalling: boolean;
  supportsStructuredJson: boolean;
  maxContextTokens: number;
  recommendedUseCases?: string[];
  tags?: string[];
  warningLevel?: AiModelWarningLevel;
  textOnlyMode: boolean;
  warningMessage?: string;
}

export interface CreateTenantCustomModelProfileInput {
  tenantId: string;
  providerId: string;
  provider: string;
  modelId: string;
  displayName?: string;
  baseUrl?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  toolMode?: 'none' | 'text_plan' | 'native_tools' | 'json_only';
  timeoutMs?: number;
  retryPolicy?: string;
  safetyPolicyId?: string;
  systemPromptPolicyId?: string;
  dataFilterPolicyId?: string;
  createdBy?: string;
}

export class AiModelProfileUseCase {
  constructor(private readonly modelProfileRepo: IAiModelProfileRepository) {}

  async listProfiles(filters?: { provider?: string; status?: string; tag?: string }): Promise<AiModelProfile[]> {
    let profiles = await this.modelProfileRepo.list();
    if (filters?.provider) {
      profiles = profiles.filter(profile => profile.provider === filters.provider);
    }
    if (filters?.status) {
      profiles = profiles.filter(profile => profile.status === filters.status);
    }
    if (filters?.tag) {
      profiles = profiles.filter(profile => profile.tags.includes(filters.tag!));
    }
    return profiles.sort((a, b) => `${a.provider}:${a.modelName}`.localeCompare(`${b.provider}:${b.modelName}`));
  }

  async getProfileById(id: string): Promise<AiModelProfile | null> {
    return this.modelProfileRepo.getById(id);
  }

  async resolveRuntimeProfile(provider: string, modelName: string | null | undefined): Promise<RuntimeModelProfile> {
    const model = modelName || '';
    const dbProfile = await this.modelProfileRepo.getByProviderAndModel(provider, model);
    if (dbProfile) {
      return this.toRuntimeProfile(dbProfile);
    }
    return AiModelCapabilityCatalog.getProfile(provider, model);
  }

  async upsertProfile(input: UpsertAiModelProfileInput): Promise<AiModelProfile> {
    const now = new Date();
    const id = AiModelProfile.makeId(input.provider, input.modelName);
    const existing = await this.modelProfileRepo.getById(id);
    const profile = new AiModelProfile(
      id,
      input.provider.trim().toLowerCase(),
      input.modelName.trim(),
      input.status,
      input.supportsToolCalling,
      input.supportsStructuredJson,
      input.maxContextTokens,
      this.cleanStringList(input.recommendedUseCases),
      this.cleanStringList(input.tags),
      input.warningLevel ?? 'info',
      input.textOnlyMode,
      input.warningMessage?.trim() ?? '',
      existing?.lastDiagnosticStatus ?? 'never-tested',
      existing?.lastDiagnosticMode,
      existing?.lastDiagnosticAt,
      existing?.lastDiagnosticCompanyId,
      existing?.lastDiagnosticDetail,
      existing?.createdAt ?? now,
      now,
    );

    await this.modelProfileRepo.save(profile);
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    await this.modelProfileRepo.delete(id);
  }

  async syncBuiltInProfiles(): Promise<number> {
    let synced = 0;
    for (const seed of AiModelCapabilityCatalog.getAllKnownProfilesAsEntities()) {
      const existing = await this.modelProfileRepo.getById(seed.id);
      if (!existing) {
        await this.modelProfileRepo.save(seed);
        synced++;
      }
    }
    return synced;
  }

  async recordDiagnostics(input: {
    provider: string;
    modelName: string;
    status: AiModelDiagnosticStatus;
    mode: AiModelRuntimeMode;
    companyId: string;
    detail?: string;
  }): Promise<AiModelProfile> {
    const existing = await this.modelProfileRepo.getByProviderAndModel(input.provider, input.modelName);
    const base = existing ?? AiModelProfile.fromJSON({
      ...AiModelCapabilityCatalog.getProfile(input.provider, input.modelName),
      id: AiModelProfile.makeId(input.provider, input.modelName),
      provider: input.provider.trim().toLowerCase(),
      modelName: input.modelName,
      tags: [],
      lastDiagnosticStatus: 'never-tested',
    });
    const updated = base.withDiagnostics(input);
    await this.modelProfileRepo.save(updated);
    return updated;
  }

  async createTenantCustomProfile(input: CreateTenantCustomModelProfileInput): Promise<AiModelProfile> {
    const now = new Date();
    const endpointFingerprint = AiModelProfile.fingerprintEndpoint(input.baseUrl || input.provider);
    const toolMode = input.toolMode || 'none';
    const supportsToolCalling = toolMode === 'native_tools';
    const supportsStructuredJson = input.jsonMode === true || toolMode === 'json_only' || toolMode === 'native_tools';
    const profileHash = AiModelProfile.generateProfileHash({
      scope: 'TENANT',
      tenantId: input.tenantId,
      providerId: input.providerId,
      modelId: input.modelId,
      endpointFingerprint,
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxOutputTokens ?? 4096,
      jsonMode: supportsStructuredJson,
      toolMode,
      timeoutMs: input.timeoutMs ?? 120000,
      retryPolicy: input.retryPolicy || 'default',
      safetyPolicyId: input.safetyPolicyId,
      systemPromptPolicyId: input.systemPromptPolicyId,
      dataFilterPolicyId: input.dataFilterPolicyId,
    });
    const id = AiModelProfile.makeRuntimeId({
      scope: 'TENANT',
      tenantId: input.tenantId,
      providerId: input.providerId,
      modelId: input.modelId,
      endpointFingerprint,
    });
    const existing = await this.modelProfileRepo.getById(id);
    const profile = new AiModelProfile(
      id,
      input.provider.trim().toLowerCase(),
      input.modelId.trim(),
      'custom',
      supportsToolCalling,
      supportsStructuredJson,
      input.maxOutputTokens ?? 4096,
      [],
      ['tenant-custom'],
      'warning',
      toolMode === 'none',
      'Tenant custom model is not trusted for sensitive ERP workflows until company certification exists.',
      existing?.lastDiagnosticStatus ?? 'never-tested',
      existing?.lastDiagnosticMode,
      existing?.lastDiagnosticAt,
      existing?.lastDiagnosticCompanyId,
      existing?.lastDiagnosticDetail,
      existing?.createdAt ?? now,
      now,
      'TENANT',
      input.tenantId,
      input.providerId,
      input.modelId,
      input.displayName || input.modelId,
      input.baseUrl,
      endpointFingerprint,
      input.temperature ?? 0.7,
      input.maxOutputTokens ?? 4096,
      supportsStructuredJson,
      toolMode,
      input.timeoutMs ?? 120000,
      input.retryPolicy || 'default',
      input.safetyPolicyId,
      input.systemPromptPolicyId,
      input.dataFilterPolicyId,
      profileHash,
      (existing?.revision ?? 0) + 1,
      true,
      input.createdBy,
    );
    await this.modelProfileRepo.save(profile);
    return profile;
  }

  private toRuntimeProfile(profile: AiModelProfile): RuntimeModelProfile {
    return {
      provider: profile.provider,
      modelName: profile.modelName,
      status: profile.status,
      supportsToolCalling: profile.supportsToolCalling,
      supportsStructuredJson: profile.supportsStructuredJson,
      maxContextTokens: profile.maxContextTokens,
      recommendedUseCases: profile.recommendedUseCases,
      warningLevel: profile.warningLevel,
      textOnlyMode: profile.textOnlyMode,
      warningMessage: profile.warningMessage,
    };
  }

  private cleanStringList(values?: string[]): string[] {
    return Array.from(new Set((values ?? []).map(value => value.trim()).filter(Boolean)));
  }
}
