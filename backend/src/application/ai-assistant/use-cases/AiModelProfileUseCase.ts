import {
  AiModelDiagnosticStatus,
  AiModelProfile,
  AiModelRuntimeMode,
  AiModelStatus,
  AiModelWarningLevel,
} from '../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { AiModelCapabilityCatalog, AiModelProfile as RuntimeModelProfile } from '../services/AiModelCapabilityCatalog';
import type { AiAutoSeedCertification } from '../services/AiAutoSeedCertification';

export interface UpsertAiModelProfileInput {
  id?: string;
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
  // Runtime config fields (optional, with sensible defaults)
  scope?: 'GLOBAL' | 'TENANT';
  providerId?: string;
  modelId?: string;
  displayName?: string;
  baseUrl?: string;
  temperature?: number;
  maxOutputTokens?: number;
  toolMode?: 'none' | 'text_plan' | 'native_tools' | 'json_only';
  timeoutMs?: number;
  retryPolicy?: string;
  safetyPolicyId?: string;
  systemPromptPolicyId?: string;
  dataFilterPolicyId?: string;
  enabled?: boolean;
  creditCost?: number;
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
  constructor(
    private readonly modelProfileRepo: IAiModelProfileRepository,
    private readonly autoSeedCertification?: AiAutoSeedCertification,
    private readonly certificationRepository?: IAiModelCertificationRepository,
  ) {}

  /**
   * After saving a GLOBAL profile, re-run the auto-cert seeder so well-known models
   * (gpt-4o, claude-3-5-*, gemini-1.5-*, etc.) get a fresh certification matching
   * the new profileHash. This eliminates the "editing breaks cert" footgun.
   */
  private async maybeRecertify(profile: AiModelProfile): Promise<void> {
    if (!this.autoSeedCertification) return;
    if (profile.scope !== 'GLOBAL') return;
    try {
      await this.autoSeedCertification.seed();
    } catch (err) {
      console.warn(`[AiModelProfileUseCase] auto-recertify failed: ${(err as Error).message}`);
    }
  }

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

  async resolveRuntimeProfile(tenantId: string, provider: string, modelName: string | null | undefined): Promise<RuntimeModelProfile> {
    const model = modelName || '';
    
    // 1. Search for TENANT-scoped profile first
    const tenantProfiles = await this.modelProfileRepo.list({ tenantId, scope: 'TENANT' });
    const tenantProfile = tenantProfiles.find(p => 
      p.provider === provider && 
      p.modelName === model
    );
    
    if (tenantProfile) {
      return this.toRuntimeProfile(tenantProfile);
    }

    // 2. Search for GLOBAL-scoped profile in DB
    const globalProfiles = await this.modelProfileRepo.list({ scope: 'GLOBAL' });
    const dbProfile = globalProfiles.find(p => 
      p.provider === provider && 
      p.modelName === model
    );
    if (dbProfile) {
      return this.toRuntimeProfile(dbProfile);
    }

    // 3. Fallback to Catalog (Should be rare if seeder is used)
    return AiModelCapabilityCatalog.getProfile(provider, model);
  }

  async upsertProfile(input: UpsertAiModelProfileInput): Promise<AiModelProfile> {
    const now = new Date();
    const provider = input.provider.trim().toLowerCase();
    const modelName = input.modelName.trim();
    // If any runtime config field is provided, use the full constructor
    // to preserve all runtime fields, profileHash, scope, etc.
    const hasRuntimeFields = input.scope || input.providerId || input.modelId
      || input.baseUrl || input.toolMode || input.dataFilterPolicyId
      || input.safetyPolicyId || input.systemPromptPolicyId || input.displayName;

    if (hasRuntimeFields) {
      const scope: 'GLOBAL' | 'TENANT' = input.scope || 'GLOBAL';
      const providerId = input.providerId || provider;
      const modelId = input.modelId || modelName;
      const displayName = input.displayName || input.modelId || modelName;
      const baseUrl = input.baseUrl || undefined;
      const endpointFingerprint = AiModelProfile.fingerprintEndpoint(baseUrl || provider);
      const profileId = input.id || AiModelProfile.makeRuntimeId({ scope, providerId, modelId, endpointFingerprint });
      const existing = await this.modelProfileRepo.getById(profileId);
      const toolMode = input.toolMode || (input.supportsToolCalling ? 'native_tools' : (input.textOnlyMode ? 'none' : 'text_plan'));
      const temperature = input.temperature ?? 0.7;
      const maxOutputTokens = input.maxOutputTokens ?? input.maxContextTokens;
      const jsonMode = input.supportsStructuredJson;
      const profileHash = AiModelProfile.generateProfileHash({
        scope,
        tenantId: scope === 'TENANT' ? undefined : undefined,
        providerId,
        modelId,
        endpointFingerprint,
        temperature,
        maxOutputTokens,
        jsonMode,
        toolMode,
        timeoutMs: input.timeoutMs ?? 120000,
        retryPolicy: input.retryPolicy || 'default',
        safetyPolicyId: input.safetyPolicyId,
        systemPromptPolicyId: input.systemPromptPolicyId,
        dataFilterPolicyId: input.dataFilterPolicyId,
      });
      const profile = new AiModelProfile(
        profileId,
        provider,
        modelName,
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
        scope,
        scope === 'TENANT' ? undefined : undefined,
        providerId,
        modelId,
        displayName,
        baseUrl,
        endpointFingerprint,
        temperature,
        maxOutputTokens,
        jsonMode,
        toolMode,
        input.timeoutMs ?? 120000,
        input.retryPolicy || 'default',
        input.safetyPolicyId,
        input.systemPromptPolicyId,
        input.dataFilterPolicyId,
        profileHash,
        (existing?.revision ?? 0) + 1,
        input.enabled ?? true,
        undefined,
        this.resolveCreditCost(input.creditCost, existing?.creditCost),
      );
      await this.modelProfileRepo.save(profile);
      await this.maybeRecertify(profile);
      return profile;
    }

    // Legacy path: basic profile without runtime config
    const existing = await this.modelProfileRepo.getById(AiModelProfile.makeId(provider, modelName));
    const profile = new AiModelProfile(
      AiModelProfile.makeId(provider, modelName),
      provider,
      modelName,
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
      existing?.scope ?? 'GLOBAL',
      existing?.tenantId,
      existing?.providerId ?? provider,
      existing?.modelId ?? modelName,
      existing?.displayName ?? modelName,
      existing?.baseUrl,
      existing?.endpointFingerprint ?? AiModelProfile.fingerprintEndpoint(existing?.baseUrl || provider),
      existing?.temperature ?? 0.7,
      existing?.maxOutputTokens ?? input.maxContextTokens,
      existing?.jsonMode ?? input.supportsStructuredJson,
      existing?.toolMode ?? (input.supportsToolCalling ? 'native_tools' : (input.textOnlyMode ? 'none' : 'text_plan')),
      existing?.timeoutMs ?? 120000,
      existing?.retryPolicy ?? 'default',
      existing?.safetyPolicyId,
      existing?.systemPromptPolicyId,
      existing?.dataFilterPolicyId,
      existing?.profileHash ?? AiModelProfile.generateProfileHash({
        scope: existing?.scope ?? 'GLOBAL',
        tenantId: existing?.tenantId,
        providerId: existing?.providerId ?? provider,
        modelId: existing?.modelId ?? modelName,
        endpointFingerprint: existing?.endpointFingerprint ?? AiModelProfile.fingerprintEndpoint(provider),
        temperature: existing?.temperature ?? 0.7,
        maxOutputTokens: existing?.maxOutputTokens ?? input.maxContextTokens,
        jsonMode: existing?.jsonMode ?? input.supportsStructuredJson,
        toolMode: existing?.toolMode ?? (input.supportsToolCalling ? 'native_tools' : (input.textOnlyMode ? 'none' : 'text_plan')),
        timeoutMs: existing?.timeoutMs ?? 120000,
        retryPolicy: existing?.retryPolicy ?? 'default',
        safetyPolicyId: existing?.safetyPolicyId,
        systemPromptPolicyId: existing?.systemPromptPolicyId,
        dataFilterPolicyId: existing?.dataFilterPolicyId,
      }),
      (existing?.revision ?? 0) + 1,
      existing?.enabled ?? true,
      existing?.createdBy,
      this.resolveCreditCost(input.creditCost, existing?.creditCost),
    );

    await this.modelProfileRepo.save(profile);
    await this.maybeRecertify(profile);
    return profile;
  }

  private resolveCreditCost(input: number | undefined, existing: number | undefined): number {
    if (typeof input === 'number' && Number.isFinite(input) && input >= 0) return input;
    if (typeof existing === 'number' && Number.isFinite(existing) && existing >= 0) return existing;
    return 1;
  }

  async deleteProfile(id: string): Promise<void> {
    // Cascade: wipe certification records for this profile first. Otherwise old
    // certs hang around in storage and reattach when a profile with the same
    // hash (provider + model + config) is recreated — leaving the user with
    // "zombie" cert rows they cannot get rid of.
    if (this.certificationRepository) {
      const certs = await this.certificationRepository.listByModelProfile(id);
      for (const cert of certs) {
        await this.certificationRepository.delete(cert.id);
      }
    }
    await this.modelProfileRepo.delete(id);
  }

  /**
   * Wipe all certification records for a model profile WITHOUT deleting the
   * profile itself. Used by the "Reset certification history" admin action so
   * a superadmin can start a clean cert cycle on the same profile.
   */
  async resetCertificationsForProfile(id: string): Promise<number> {
    if (!this.certificationRepository) {
      throw new Error('Certification repository is not wired — cannot reset history');
    }
    const certs = await this.certificationRepository.listByModelProfile(id);
    for (const cert of certs) {
      await this.certificationRepository.delete(cert.id);
    }
    return certs.length;
  }

  async syncBuiltInProfiles(force: boolean = false): Promise<number> {
    if (!force) {
      const existingProfiles = await this.modelProfileRepo.list();
      // If there are already any profiles in the database, we skip auto-syncing
      // at startup to allow admins to permanently delete built-in profiles.
      if (existingProfiles.length > 0) {
        return 0;
      }
    }

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
    profileId?: string;
  }): Promise<AiModelProfile> {
    // Try to find an existing profile by its known ID first (most reliable),
    // then fall back to provider+model search.
    let existing: AiModelProfile | null = null;

    if (input.profileId) {
      existing = await this.modelProfileRepo.getById(input.profileId);
    }

    if (!existing) {
      existing = await this.modelProfileRepo.getByProviderAndModel(input.provider, input.modelName, input.companyId);
    }

    if (!existing) {
      existing = await this.modelProfileRepo.getByProviderAndModel(input.provider, input.modelName);
    }

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
      existing?.creditCost ?? 1,
    );
    await this.modelProfileRepo.save(profile);
    return profile;
  }

  /**
   * Update a tenant custom model profile's configuration.
   * Regenerates profileHash and increments revision (invalidates existing certifications).
   */
  async updateTenantProfile(profileId: string, tenantId: string, updates: {
    toolMode?: 'none' | 'text_plan' | 'native_tools' | 'json_only';
    temperature?: number;
    maxOutputTokens?: number;
    dataFilterPolicyId?: string;
    safetyPolicyId?: string;
    systemPromptPolicyId?: string;
    displayName?: string;
    baseUrl?: string;
  }): Promise<AiModelProfile> {
    const existing = await this.modelProfileRepo.getById(profileId);
    if (!existing) throw new Error(`Profile ${profileId} not found`);
    if (existing.scope !== 'TENANT' || existing.tenantId !== tenantId) {
      throw new Error('Profile does not belong to this tenant');
    }

    const now = new Date();
    const toolMode = updates.toolMode ?? existing.toolMode;
    const temperature = updates.temperature ?? existing.temperature;
    const maxOutputTokens = updates.maxOutputTokens ?? existing.maxOutputTokens;
    const dataFilterPolicyId = updates.dataFilterPolicyId ?? existing.dataFilterPolicyId;
    const safetyPolicyId = updates.safetyPolicyId ?? existing.safetyPolicyId;
    const systemPromptPolicyId = updates.systemPromptPolicyId ?? existing.systemPromptPolicyId;
    const displayName = updates.displayName ?? existing.displayName;
    const baseUrl = updates.baseUrl ?? existing.baseUrl;

    const supportsToolCalling = toolMode === 'native_tools';
    const supportsStructuredJson = toolMode === 'json_only' || toolMode === 'native_tools';
    const endpointFingerprint = baseUrl
      ? AiModelProfile.fingerprintEndpoint(baseUrl)
      : existing.endpointFingerprint;

    const profileHash = AiModelProfile.generateProfileHash({
      scope: 'TENANT',
      tenantId: existing.tenantId,
      providerId: existing.providerId,
      modelId: existing.modelId,
      endpointFingerprint,
      temperature,
      maxOutputTokens,
      jsonMode: supportsStructuredJson,
      toolMode,
      timeoutMs: existing.timeoutMs,
      retryPolicy: existing.retryPolicy,
      safetyPolicyId,
      systemPromptPolicyId,
      dataFilterPolicyId,
    });

    const updated = new AiModelProfile(
      existing.id,
      existing.provider,
      existing.modelName,
      existing.status,
      supportsToolCalling,
      supportsStructuredJson,
      maxOutputTokens,
      existing.recommendedUseCases,
      existing.tags,
      existing.warningLevel,
      toolMode === 'none',
      existing.warningMessage,
      existing.lastDiagnosticStatus,
      existing.lastDiagnosticMode,
      existing.lastDiagnosticAt,
      existing.lastDiagnosticCompanyId,
      existing.lastDiagnosticDetail,
      existing.createdAt,
      now,
      'TENANT',
      existing.tenantId,
      existing.providerId,
      existing.modelId,
      displayName,
      baseUrl,
      endpointFingerprint,
      temperature,
      maxOutputTokens,
      supportsStructuredJson,
      toolMode,
      existing.timeoutMs,
      existing.retryPolicy,
      safetyPolicyId,
      systemPromptPolicyId,
      dataFilterPolicyId,
      profileHash,
      existing.revision + 1,
      existing.enabled,
      existing.createdBy,
      existing.creditCost,
    );
    await this.modelProfileRepo.save(updated);
    return updated;
  }

  /**
   * Deprecate a tenant custom model profile (soft-delete).
   * Sets status to 'deprecated' and disables the profile.
   * Does NOT actually delete the document — preserves audit trail.
   * The caller (controller) is responsible for clearing the tenant's
   * selectedModelProfileId/selectedProfileHash if this was the active profile.
   */
  async deprecateTenantProfile(profileId: string, tenantId: string): Promise<AiModelProfile> {
    const existing = await this.modelProfileRepo.getById(profileId);
    if (!existing) throw new Error(`Profile ${profileId} not found`);
    if (existing.scope !== 'TENANT' || existing.tenantId !== tenantId) {
      throw new Error('Profile does not belong to this tenant');
    }
    if (existing.status === 'deprecated') {
      throw new Error('Profile is already deprecated');
    }

    const now = new Date();
    const deprecated = new AiModelProfile(
      existing.id,
      existing.provider,
      existing.modelName,
      'deprecated', // status
      existing.supportsToolCalling,
      existing.supportsStructuredJson,
      existing.maxContextTokens,
      existing.recommendedUseCases,
      existing.tags,
      existing.warningLevel,
      existing.textOnlyMode,
      'This model profile has been deprecated by your company admin.',
      existing.lastDiagnosticStatus,
      existing.lastDiagnosticMode,
      existing.lastDiagnosticAt,
      existing.lastDiagnosticCompanyId,
      existing.lastDiagnosticDetail,
      existing.createdAt,
      now,
      existing.scope,
      existing.tenantId,
      existing.providerId,
      existing.modelId,
      existing.displayName,
      existing.baseUrl,
      existing.endpointFingerprint,
      existing.temperature,
      existing.maxOutputTokens,
      existing.supportsStructuredJson,
      existing.toolMode,
      existing.timeoutMs,
      existing.retryPolicy,
      existing.safetyPolicyId,
      existing.systemPromptPolicyId,
      existing.dataFilterPolicyId,
      existing.profileHash,
      existing.revision + 1,
      false, // enabled = false
      existing.createdBy,
      existing.creditCost,
    );
    await this.modelProfileRepo.save(deprecated);
    return deprecated;
  }

  toRuntimeProfile(profile: AiModelProfile): RuntimeModelProfile {
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
