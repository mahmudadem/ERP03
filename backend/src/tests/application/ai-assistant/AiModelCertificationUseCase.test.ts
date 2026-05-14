import { AiModelCertificationUseCase } from '../../../application/ai-assistant/use-cases/AiModelCertificationUseCase';
import { AI_DATA_FILTER_POLICY_VERSION, AI_TOOL_CONTRACT_VERSION } from '../../../application/ai-assistant/services/AiModelRoutingGuard';
import { AiModelCertificationResult } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
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
  async list(filters?: any) {
    return this.results.filter(result =>
      (!filters?.scope || result.scope === filters.scope) &&
      (!filters?.tenantId || result.tenantId === filters.tenantId) &&
      (!filters?.category || result.category === filters.category) &&
      (!filters?.moduleId || result.moduleId === filters.moduleId)
    );
  }
  async listByModelProfile(modelProfileId: string) { return this.results.filter(r => r.modelProfileId === modelProfileId); }
  async expireByProfileAndCategory(modelProfileId: string, category: string) {
    const toExpire = this.results.filter(r => r.modelProfileId === modelProfileId && r.category === category && r.status === 'CERTIFIED');
    toExpire.forEach(r => { (r as any).status = 'DEPRECATED'; });
    return toExpire.length;
  }
  async findValidForRouting() { return null; }
  async save(result: AiModelCertificationResult) {
    this.results = this.results.filter(r => r.id !== result.id);
    this.results.push(result);
  }
  async delete(id: string) { this.results = this.results.filter(r => r.id !== id); }
}

const makeProfile = (overrides: Record<string, unknown> = {}) => AiModelProfile.fromJSON({
  id: 'profile-global',
  scope: 'GLOBAL',
  providerId: 'openai',
  provider: 'openai_compatible',
  modelId: 'gpt-4o',
  modelName: 'gpt-4o',
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
  dataFilterPolicyId: 'dfp-v1',
  ...overrides,
});

const manualInput = (profile: AiModelProfile, overrides: Record<string, unknown> = {}) => ({
  scope: 'GLOBAL' as const,
  modelProfileId: profile.id,
  profileHash: profile.profileHash,
  category: 'ACCOUNTING' as const,
  moduleId: 'accounting',
  score: 95,
  maxScore: 100,
  status: 'CERTIFIED' as const,
  testSuiteVersion: 'manual-v1',
  toolContractVersion: AI_TOOL_CONTRACT_VERSION,
  dataFilterPolicyVersion: AI_DATA_FILTER_POLICY_VERSION,
  summary: 'Manual platform approval after review.',
  testedBy: 'super-admin',
  approvedBy: 'super-admin',
  ...overrides,
});

describe('AiModelCertificationUseCase', () => {
  let profileRepo: InMemoryProfileRepo;
  let certRepo: InMemoryCertificationRepo;
  let useCase: AiModelCertificationUseCase;

  beforeEach(() => {
    profileRepo = new InMemoryProfileRepo();
    certRepo = new InMemoryCertificationRepo();
    useCase = new AiModelCertificationUseCase(profileRepo, certRepo);
  });

  it('rejects global certification for stale profileHash', async () => {
    const profile = makeProfile();
    await profileRepo.save(profile);

    await expect(useCase.recordManualCertification(manualInput(profile, {
      profileHash: 'stale-hash',
    }) as any)).rejects.toThrow('profileHash does not match');
  });

  it('requires category and version fields for manual certification', async () => {
    const profile = makeProfile();
    await profileRepo.save(profile);

    await expect(useCase.recordManualCertification(manualInput(profile, {
      testSuiteVersion: '',
    }) as any)).rejects.toThrow('testSuiteVersion is required');
  });

  it('returns global certified profiles but excludes tenant certifications from global recommended query', async () => {
    const globalProfile = makeProfile();
    const tenantProfile = makeProfile({
      id: 'profile-tenant',
      scope: 'TENANT',
      tenantId: 'tenant-1',
    });
    await profileRepo.save(globalProfile);
    await profileRepo.save(tenantProfile);
    await useCase.recordManualCertification(manualInput(globalProfile));
    await useCase.recordManualCertification({
      ...manualInput(tenantProfile),
      scope: 'TENANT',
      tenantId: 'tenant-1',
      modelProfileId: tenantProfile.id,
      profileHash: tenantProfile.profileHash,
    });

    const global = await useCase.listValidCertifiedProfiles({
      scope: 'GLOBAL',
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(global).toHaveLength(1);
    expect((global[0].profile as any).id).toBe(globalProfile.id);
  });

  it('excludes blocked deprecated disabled stale and failed certifications', async () => {
    const blocked = makeProfile({ id: 'blocked', status: 'blocked' });
    const disabled = makeProfile({ id: 'disabled', enabled: false });
    const stale = makeProfile({ id: 'stale' });
    await profileRepo.save(blocked);
    await profileRepo.save(disabled);
    await profileRepo.save(stale);
    await useCase.recordManualCertification(manualInput(blocked, { modelProfileId: blocked.id, profileHash: blocked.profileHash }));
    await useCase.recordManualCertification(manualInput(disabled, { modelProfileId: disabled.id, profileHash: disabled.profileHash }));
    const cert = await useCase.recordManualCertification(manualInput(stale, { modelProfileId: stale.id, profileHash: stale.profileHash }));
    await profileRepo.save(AiModelProfile.fromJSON({ ...stale.toJSON(), profileHash: undefined, temperature: 0.8 }));
    await certRepo.save(AiModelCertificationResult.fromJSON({ ...cert.toJSON(), id: 'failed', status: 'FAILED' }));

    const valid = await useCase.listValidCertifiedProfiles({
      scope: 'GLOBAL',
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(valid).toHaveLength(0);
  });

  it('allows tenant certified profile query only for matching tenant', async () => {
    const tenantProfile = makeProfile({
      id: 'profile-tenant',
      scope: 'TENANT',
      tenantId: 'tenant-1',
    });
    await profileRepo.save(tenantProfile);
    await useCase.recordManualCertification({
      ...manualInput(tenantProfile),
      scope: 'TENANT',
      tenantId: 'tenant-1',
      modelProfileId: tenantProfile.id,
      profileHash: tenantProfile.profileHash,
    });

    const sameTenant = await useCase.listValidCertifiedProfiles({
      scope: 'TENANT',
      tenantId: 'tenant-1',
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });
    const otherTenant = await useCase.listValidCertifiedProfiles({
      scope: 'TENANT',
      tenantId: 'tenant-2',
      category: 'ACCOUNTING',
      moduleId: 'accounting',
    });

    expect(sameTenant).toHaveLength(1);
    expect(otherTenant).toHaveLength(0);
  });
});
