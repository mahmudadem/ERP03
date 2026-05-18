import { ApiError } from '../../../api/errors/ApiError';
import { AiCertificationCategory, isAiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiModelCertificationResult, AiModelCertificationStatus } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { IAiPlatformRuntimeProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiPlatformRuntimeProfileRepository';
import { IAiProviderRepository } from '../../../repository/interfaces/ai-assistant/IAiProviderRepository';
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

import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { ProviderFactory } from '../providers/ProviderFactory';
import { IAiProvider } from '../providers/IAiProvider';

export class AiModelCertificationUseCase {
  constructor(
    private readonly profileRepository: IAiModelProfileRepository,
    private readonly certificationRepository: IAiModelCertificationRepository,
    private readonly settingsRepository: IAiSettingsRepository,
    private readonly encryptionService: IEncryptionService,
    private readonly httpClient: IHttpClient,
    private readonly engine: AiCertificationEngine,
    private readonly runtimeProfileRepository?: IAiPlatformRuntimeProfileRepository,
    private readonly providerRepository?: IAiProviderRepository,
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

    const result = await this.engine.run({
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

    // Graduation Flow: Automatically promote model to 'recommended' when it earns CERTIFIED.
    // Super Admin doesn't manually toggle recommended status — passing the cert IS the badge.
    if (result.status === 'CERTIFIED' && profile.status !== 'recommended') {
      const graduated = profile.withStatus('recommended');
      await this.profileRepository.save(graduated);
    }

    await this.certificationRepository.expireByProfileAndCategory(input.modelProfileId, input.category);
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

    // Load and resolve provider for deep testing.
    // - TENANT scope: use the tenant's own AI settings (BYOK key).
    // - GLOBAL scope: use the platform runtime profile's credential (Super Admin's stored key).
    let provider: IAiProvider | undefined;
    let providerCreationError: string | undefined;
    if (input.tenantId) {
      try {
        let config = await this.settingsRepository.getConfig(input.tenantId);
        if (config) {
          config = this.decryptConfig(config);
          // For diagnostics/certification, we use strict provider creation
          provider = ProviderFactory.getProviderStrict(config, this.httpClient);
        } else {
          providerCreationError = 'No AI settings configured for this tenant. Configure a provider and API key in AI Settings first.';
        }
      } catch (err) {
        providerCreationError = `Could not create provider: ${(err as Error).message}`;
        console.warn(`[Certification] ${providerCreationError}`);
      }
    } else if (input.scope === 'GLOBAL' && this.runtimeProfileRepository) {
      try {
        // Runtime profiles are keyed by (AiProvider.id, modelProfileId). The model profile's
        // providerId is the provider TYPE string ('openai_compatible'), not the AiProvider's
        // actual id — so we match on modelProfileId only and pick the first active one.
        const allRuntimeProfiles = await this.runtimeProfileRepository.list();
        const runtimeProfile = allRuntimeProfiles.find(
          p => p.modelProfileId === profile.id && p.status === 'active' && !!p.encryptedCredential,
        );
        if (runtimeProfile) {
          const plainKey = this.decryptStoredCredential(runtimeProfile.encryptedCredential!);
          // Resolve base URL: model profile's explicit URL takes precedence,
          // fall back to the registered provider's defaultBaseUrl so that
          // providers like OpenRouter (which store their URL on the AiProvider entity,
          // not on each model profile) don't silently fall through to api.openai.com.
          let resolvedBaseUrl = profile.baseUrl;
          if (!resolvedBaseUrl && this.providerRepository) {
            try {
              const providerEntity = await this.providerRepository.getById(runtimeProfile.providerId);
              resolvedBaseUrl = providerEntity?.defaultBaseUrl;
            } catch { /* best-effort — ProviderFactory will fall back to its own default */ }
          }
          const certConfig = new AiProviderConfig(
            'cert-engine-global',
            profile.provider as any,
            profile.modelId,
            plainKey,
            resolvedBaseUrl,
            profile.maxOutputTokens || 1024,
            undefined,
            0,
            undefined,
            true,
            new Date(),
            'balanced',
            true,
            'legacy_unverified',
            profile.providerId,
          );
          provider = ProviderFactory.getProviderStrict(certConfig, this.httpClient);
        } else {
          providerCreationError = `No active platform runtime profile with credential for model "${profile.displayName || profile.modelId}". Configure a platform runtime profile with an API key in Super Admin → Platform Global Providers.`;
          console.warn(`[Certification] ${providerCreationError}`);
        }
      } catch (err) {
        providerCreationError = `Could not create GLOBAL provider: ${(err as Error).message}`;
        console.warn(`[Certification] ${providerCreationError}`);
      }
    } else if (input.scope === 'GLOBAL' && !this.runtimeProfileRepository) {
      providerCreationError = 'Platform runtime profile repository not available. Cannot resolve provider credentials for GLOBAL certification.';
    }

    // ── Pre-flight diagnostic: verify provider connectivity before running full tests ──
    // This catches "No provider available" / "API key invalid" / "network unreachable"
    // early, producing a specific diagnostic reason instead of a generic failure.
    let preflightDiagnostic: { networkOk: boolean; inferenceOk: boolean; detail?: string } | undefined;

    if (provider) {
      try {
        const networkOk = await provider.isAvailable();
        if (!networkOk) {
          preflightDiagnostic = { networkOk: false, inferenceOk: false, detail: 'Provider network check failed — the endpoint is not reachable.' };
          console.warn(`[Certification] Pre-flight diagnostic FAILED: network check failed for ${profile.modelId}`);
          // Clear the provider so the engine doesn't attempt the expensive Deep Probe
          provider = undefined;
        } else {
          // Quick inference test — same safe prompt as CheckProviderHealthUseCase
          try {
            await provider.chat({
              messages: [{ role: 'user', content: 'Reply with only: provider-ok' }],
              maxTokens: 10,
              temperature: 0,
            });
            preflightDiagnostic = { networkOk: true, inferenceOk: true, detail: 'Pre-flight diagnostic passed: provider is reachable and can generate responses.' };
          } catch (inferenceErr) {
            preflightDiagnostic = {
              networkOk: true,
              inferenceOk: false,
              detail: `Provider is reachable but inference failed: ${(inferenceErr as Error).message}. Check your API key and model name.`,
            };
            console.warn(`[Certification] Pre-flight diagnostic FAILED: inference check failed for ${profile.modelId}: ${(inferenceErr as Error).message}`);
            // Clear the provider — no point running Deep Probe if basic inference fails
            provider = undefined;
          }
        }
      } catch (diagErr) {
        preflightDiagnostic = {
          networkOk: false,
          inferenceOk: false,
          detail: `Pre-flight diagnostic error: ${(diagErr as Error).message}`,
        };
        console.warn(`[Certification] Pre-flight diagnostic error for ${profile.modelId}: ${(diagErr as Error).message}`);
        provider = undefined;
      }
    } else {
      // No provider was created — record why
      preflightDiagnostic = {
        networkOk: false,
        inferenceOk: false,
        detail: providerCreationError || 'No provider available. Configure AI provider credentials before running certification.',
      };
    }

    const result = await this.engine.run({
      scope: input.scope,
      tenantId: input.tenantId,
      profile,
      profileHash: input.profileHash,
      category: input.category,
      moduleId: input.moduleId,
      skillId: input.skillId,
      testedBy: input.testedBy,
      approvedBy: input.approvedBy,
    }, provider);

    // Enrich the certification result with pre-flight diagnostic details.
    // Since AiModelCertificationResult fields are readonly, we create a new instance
    // via fromJSON to incorporate the diagnostic metadata and summary override.
    let enrichedResult = result;
    if (preflightDiagnostic) {
      const enrichedData = result.toJSON();
      enrichedData.metadata = {
        ...(enrichedData.metadata as Record<string, unknown> || {}),
        preflightDiagnostic,
      };
      // If provider was unavailable, override the generic summary with the specific reason
      if (!preflightDiagnostic.networkOk || !preflightDiagnostic.inferenceOk) {
        if (result.status !== 'CERTIFIED') {
          enrichedData.summary = `Certification incomplete. Pre-flight diagnostic: ${preflightDiagnostic.detail}`;
        }
      }
      enrichedResult = AiModelCertificationResult.fromJSON(enrichedData);
    }

    // Graduation Flow: Automatically promote model to 'recommended' when it earns CERTIFIED.
    // Super Admin doesn't manually toggle recommended status — passing the cert IS the badge.
    if (enrichedResult.status === 'CERTIFIED' && profile.status !== 'recommended') {
      const graduated = profile.withStatus('recommended');
      await this.profileRepository.save(graduated);
    }

    await this.certificationRepository.expireByProfileAndCategory(input.modelProfileId, input.category);
    await this.certificationRepository.save(enrichedResult);
    return enrichedResult;
  }

  private decryptConfig(config: AiProviderConfig): AiProviderConfig {
    if (!config.apiKey || !this.encryptionService) {
      return config;
    }

    if (config.apiKey.startsWith('plain:')) {
      const plainKey = config.apiKey.substring(6);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: plainKey,
        updatedAt: config.updatedAt.toISOString(),
      });
    }

    try {
      const decrypted = this.encryptionService.decrypt(config.apiKey);
      return AiProviderConfig.fromJSON({
        ...config.toJSON(),
        apiKey: decrypted,
        updatedAt: config.updatedAt.toISOString(),
      });
    } catch (error) {
      return config;
    }
  }

  private decryptStoredCredential(value: string): string {
    if (value.startsWith('plain:')) return value.substring(6);
    if (value.includes(':')) return this.encryptionService.decrypt(value);
    return value;
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
    /**
     * When 'CREDITS', filter to only profiles that have an active platform runtime profile
     * (i.e. the platform has a configured API key + active status for this provider+model).
     * Prevents tenants from picking models the platform can't actually serve.
     */
    runtimeMode?: 'BYOK' | 'CREDITS';
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

    // CREDITS mode: source the list from active platform runtime profiles directly.
    // The Super Admin's act of configuring a runtime profile IS the verification — we
    // don't gate on certifications. Any certifications that DO exist are attached as
    // informational. Tenants see exactly what the platform offers.
    if (input.runtimeMode === 'CREDITS' && this.runtimeProfileRepository) {
      const runtimeProfiles = await this.runtimeProfileRepository.list();
      const activeProfiles = runtimeProfiles.filter(p => p.status === 'active' && !!p.encryptedCredential);

      for (const rp of activeProfiles) {
        const modelProfile = await this.profileRepository.getById(rp.modelProfileId);
        if (!modelProfile) continue;
        if (!modelProfile.enabled || modelProfile.status === 'blocked' || modelProfile.status === 'deprecated') continue;

        const certsForProfile = results.filter(
          r =>
            r.modelProfileId === modelProfile.id &&
            r.profileHash === modelProfile.profileHash &&
            (r.status === 'CERTIFIED' || r.status === 'WARNING') &&
            (r.scope !== 'TENANT' || r.tenantId === input.tenantId),
        );
        grouped.set(modelProfile.id, { profile: modelProfile, certifications: certsForProfile });
      }

      return Array.from(grouped.values()).map(item => ({
        profile: item.profile.toJSON(),
        certifications: item.certifications.map(cert => cert.toJSON()),
      }));
    }

    for (const result of results) {
      if (result.status !== 'CERTIFIED' && result.status !== 'WARNING') continue;
      // Exclude TENANT certifications that don't belong to this tenant
      if (result.scope === 'TENANT' && result.tenantId !== input.tenantId) continue;
      const isGlobalAutoSeed = result.scope === 'GLOBAL' && result.testSuiteVersion?.startsWith('auto-seed');
      if (!isGlobalAutoSeed) {
        if (result.toolContractVersion !== AI_TOOL_CONTRACT_VERSION) continue;
        if (result.dataFilterPolicyVersion !== AI_DATA_FILTER_POLICY_VERSION) continue;
      }

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
