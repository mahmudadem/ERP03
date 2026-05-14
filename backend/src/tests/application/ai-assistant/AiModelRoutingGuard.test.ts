import { AiModelRoutingGuard, AI_DATA_FILTER_POLICY_VERSION, AI_TOOL_CONTRACT_VERSION } from '../../../application/ai-assistant/services/AiModelRoutingGuard';
import { AiModelCertificationResult } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';

class InMemoryProfileRepo implements IAiModelProfileRepository {
  profiles = new Map<string, AiModelProfile>();
  async getById(id: string) { return this.profiles.get(id) ?? null; }
  async getByProviderAndModel(provider: string, modelName: string) {
    return Array.from(this.profiles.values()).find(p => p.provider === provider && p.modelName === modelName) ?? null;
  }
  async list() { return Array.from(this.profiles.values()); }
  async save(profile: AiModelProfile) { this.profiles.set(profile.id, profile); }
  async delete(id: string) { this.profiles.delete(id); }
}

class InMemoryCertificationRepo implements IAiModelCertificationRepository {
  results: AiModelCertificationResult[] = [];
  async getById(id: string) { return this.results.find(r => r.id === id) ?? null; }
  async list() { return this.results; }
  async listByModelProfile(modelProfileId: string) {
    return this.results.filter(r => r.modelProfileId === modelProfileId);
  }
  async expireByProfileAndCategory(modelProfileId: string, category: string) {
    const toExpire = this.results.filter(r => r.modelProfileId === modelProfileId && r.category === category && r.status === 'CERTIFIED');
    toExpire.forEach(r => { (r as any).status = 'DEPRECATED'; });
    return toExpire.length;
  }
  async findValidForRouting(input: any) {
    return this.results.find(result =>
      result.status === 'CERTIFIED' &&
      result.modelProfileId === input.modelProfileId &&
      result.profileHash === input.profileHash &&
      result.category === input.category &&
      result.toolContractVersion === input.toolContractVersion &&
      result.dataFilterPolicyVersion === input.dataFilterPolicyVersion &&
      result.appliesToTenant(input.tenantId) &&
      (!input.moduleId || !result.moduleId || result.moduleId === input.moduleId)
    ) ?? null;
  }
  async save(result: AiModelCertificationResult) { this.results.push(result); }
  async delete(id: string) { this.results = this.results.filter(r => r.id !== id); }
}

const makeProfile = (overrides: Record<string, unknown> = {}) => AiModelProfile.fromJSON({
  id: 'profile-1',
  scope: 'GLOBAL',
  providerId: 'provider-openai',
  provider: 'openai_compatible',
  modelId: 'gpt-4o',
  modelName: 'gpt-4o',
  displayName: 'GPT-4o',
  endpointFingerprint: AiModelProfile.fingerprintEndpoint('https://api.openai.com/v1'),
  temperature: 0.2,
  maxOutputTokens: 4096,
  jsonMode: true,
  toolMode: 'native_tools',
  timeoutMs: 120000,
  retryPolicy: 'default',
  status: 'recommended',
  enabled: true,
  supportsToolCalling: true,
  supportsStructuredJson: true,
  maxContextTokens: 4096,
  ...overrides,
});

const makeConfig = (profile: AiModelProfile, overrides: Record<string, unknown> = {}) => AiProviderConfig.fromJSON({
  companyId: 'tenant-1',
  provider: 'openai_compatible',
  providerId: profile.providerId,
  model: profile.modelId,
  mode: 'certified_profile',
  selectedModelProfileId: profile.id,
  selectedProfileHash: profile.profileHash,
  isEnabled: true,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeCertification = (profile: AiModelProfile, overrides: Record<string, unknown> = {}) => AiModelCertificationResult.fromJSON({
  id: 'cert-1',
  scope: profile.scope,
  tenantId: profile.scope === 'TENANT' ? profile.tenantId : undefined,
  providerId: profile.providerId,
  modelProfileId: profile.id,
  profileHash: profile.profileHash,
  category: 'ACCOUNTING',
  moduleId: 'accounting',
  score: 95,
  maxScore: 100,
  status: 'CERTIFIED',
  testSuiteVersion: 'suite-v1',
  toolContractVersion: AI_TOOL_CONTRACT_VERSION,
  dataFilterPolicyVersion: AI_DATA_FILTER_POLICY_VERSION,
  testedAt: new Date().toISOString(),
  testedBy: 'tester',
  summary: 'Certified',
  ...overrides,
});

describe('AiModelRoutingGuard', () => {
  let profileRepo: InMemoryProfileRepo;
  let certRepo: InMemoryCertificationRepo;
  let guard: AiModelRoutingGuard;

  beforeEach(() => {
    profileRepo = new InMemoryProfileRepo();
    certRepo = new InMemoryCertificationRepo();
    guard = new AiModelRoutingGuard(profileRepo, certRepo);
  });

  it('allows a selected profile only when exact profileHash certification exists', async () => {
    const profile = makeProfile();
    await profileRepo.save(profile);
    await certRepo.save(makeCertification(profile));

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-1',
      config: makeConfig(profile),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.certificationId).toBe('cert-1');
  });

  it('rejects same modelId with a different providerId', async () => {
    const profile = makeProfile();
    await profileRepo.save(profile);
    await certRepo.save(makeCertification(profile));

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-1',
      config: makeConfig(profile, { providerId: 'provider-openrouter' }),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('PROVIDER_PROFILE_MISMATCH');
  });

  it('rejects same modelId with a different endpoint/profile hash', async () => {
    const profile = makeProfile();
    const differentEndpointProfile = makeProfile({
      id: 'profile-2',
      endpointFingerprint: AiModelProfile.fingerprintEndpoint('https://gateway.example.com/v1'),
      profileHash: undefined,
    });
    await profileRepo.save(differentEndpointProfile);
    await certRepo.save(makeCertification(profile, { modelProfileId: differentEndpointProfile.id }));

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-1',
      config: makeConfig(differentEndpointProfile),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('CERTIFICATION_NOT_FOUND');
  });

  it('rejects stale selectedProfileHash', async () => {
    const profile = makeProfile();
    await profileRepo.save(profile);
    await certRepo.save(makeCertification(profile));

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-1',
      config: makeConfig(profile, { selectedProfileHash: 'stale-hash' }),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('STALE_PROFILE_HASH');
  });

  it('rejects diagnostics-passed profiles without certification', async () => {
    const profile = makeProfile({
      lastDiagnosticStatus: 'passed',
      lastDiagnosticMode: 'native-tool-calling',
    });
    await profileRepo.save(profile);

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-1',
      config: makeConfig(profile),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('CERTIFICATION_NOT_FOUND');
  });

  it('rejects manual model-name spoofing without selected profile identity', async () => {
    const profile = makeProfile();
    await profileRepo.save(profile);
    await certRepo.save(makeCertification(profile));

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-1',
      config: makeConfig(profile, {
        mode: 'legacy_unverified',
        selectedModelProfileId: undefined,
        selectedProfileHash: undefined,
      }),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('MODEL_PROFILE_NOT_CERTIFIED');
  });

  it('rejects custom_uncertified and legacy_unverified settings for accounting tools', async () => {
    const profile = makeProfile();

    for (const mode of ['custom_uncertified', 'legacy_unverified'] as const) {
      const decision = await guard.validateSensitiveWorkflow({
        tenantId: 'tenant-1',
        config: makeConfig(profile, { mode }),
        category: 'ACCOUNTING',
        moduleId: 'accounting',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('MODEL_PROFILE_NOT_CERTIFIED');
    }
  });

  it('does not allow tenant certification to be used by another tenant', async () => {
    const profile = makeProfile({
      id: 'tenant-profile-1',
      scope: 'TENANT',
      tenantId: 'tenant-1',
    });
    await profileRepo.save(profile);
    await certRepo.save(makeCertification(profile));

    const decision = await guard.validateSensitiveWorkflow({
      tenantId: 'tenant-2',
      config: makeConfig(profile),
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('TENANT_PROFILE_SCOPE_MISMATCH');
  });
});
