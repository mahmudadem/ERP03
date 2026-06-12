import { AiModelCertificationUseCase } from '../../../application/ai-assistant/use-cases/AiModelCertificationUseCase';
import { AI_DATA_FILTER_POLICY_VERSION, AI_TOOL_CONTRACT_VERSION } from '../../../application/ai-assistant/services/AiModelRoutingGuard';
import { AiModelCertificationResult } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { ProviderFactory } from '../../../application/ai-assistant/providers/ProviderFactory';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';

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
    const mockSettingsRepo = {
      getConfig: jest.fn().mockResolvedValue(null),
      saveConfig: jest.fn(),
    } as any;
    const mockEncryptionService = {
      encrypt: jest.fn((val) => Promise.resolve(val)),
      decrypt: jest.fn((val) => Promise.resolve(val)),
    } as any;
    const mockHttpClient = {
      post: jest.fn(),
      get: jest.fn(),
    } as any;
    let certificationId = 0;
    const mockEngine = {
      run: jest.fn().mockImplementation((input: any, provider?: any) => {
        const base = {
          id: `cert-${++certificationId}`,
          scope: input.scope,
          tenantId: input.tenantId,
          providerId: input.profile?.providerId || 'openai',
          modelProfileId: input.profile?.id || '',
          profileHash: input.profileHash,
          category: input.category,
          moduleId: input.moduleId || '',
          score: provider ? 100 : 40,
          maxScore: 100,
          status: provider ? 'CERTIFIED' : 'FAILED',
          testSuiteVersion: input.manual?.testSuiteVersion || 'manual-v1',
          toolContractVersion: input.manual?.toolContractVersion || AI_TOOL_CONTRACT_VERSION,
          dataFilterPolicyVersion: input.manual?.dataFilterPolicyVersion || AI_DATA_FILTER_POLICY_VERSION,
          testedAt: new Date().toISOString(),
          testedBy: input.testedBy || 'test',
          summary: input.manual?.summary || (provider ? 'Certified' : 'AI Deep Probe skipped'),
          failureReasons: input.manual?.failureReasons || [],
          metadata: input.manual?.metadata || {},
        };
        if (input.manual) {
          base.score = input.manual.score;
          base.maxScore = input.manual.maxScore;
          base.status = input.manual.status;
        }
        return Promise.resolve(AiModelCertificationResult.fromJSON(base));
      }),
    } as any;
    useCase = new AiModelCertificationUseCase(
      profileRepo,
      certRepo,
      mockSettingsRepo,
      mockEncryptionService,
      mockHttpClient,
      mockEngine
    );
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
    // Restore blocked profile status after graduation flow may have changed it
    await profileRepo.save(AiModelProfile.fromJSON({ ...blocked.toJSON(), status: 'blocked' }));
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

  describe('runShellCertification with pre-flight diagnostics', () => {
    let mockProvider: any;

    beforeEach(() => {
      mockProvider = {
        isAvailable: jest.fn(),
        chat: jest.fn(),
      };
      jest.spyOn(ProviderFactory, 'getProviderStrict').mockReturnValue(mockProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('records network check failure when isAvailable returns false', async () => {
      const profile = makeProfile({ scope: 'TENANT', tenantId: 'tenant-1' });
      await profileRepo.save(profile);
      mockProvider.isAvailable.mockResolvedValue(false);

      const mockSettingsRepo = (useCase as any).settingsRepository;
      mockSettingsRepo.getConfig.mockResolvedValue(AiProviderConfig.fromJSON({
        companyId: 'tenant-1',
        isEnabled: true,
        provider: 'openai_compatible',
        model: 'gpt-4o',
        apiKey: 'plain:test-key',
        updatedAt: new Date().toISOString(),
      }));

      const result = await useCase.runShellCertification({
        scope: 'TENANT',
        tenantId: 'tenant-1',
        modelProfileId: profile.id,
        profileHash: profile.profileHash,
        category: 'ACCOUNTING',
        testedBy: 'test-user',
      });

      expect(result.status).toBe('FAILED');
      expect(result.summary).toContain('Provider network check failed');
      expect(result.metadata?.preflightDiagnostic).toMatchObject({
        networkOk: false,
        inferenceOk: false,
      });
    });

    it('records inference failure when chat throws an error', async () => {
      const profile = makeProfile({ scope: 'TENANT', tenantId: 'tenant-1' });
      await profileRepo.save(profile);
      mockProvider.isAvailable.mockResolvedValue(true);
      mockProvider.chat.mockRejectedValue(new Error('Inference limit exceeded'));

      const mockSettingsRepo = (useCase as any).settingsRepository;
      mockSettingsRepo.getConfig.mockResolvedValue(AiProviderConfig.fromJSON({
        companyId: 'tenant-1',
        isEnabled: true,
        provider: 'openai_compatible',
        model: 'gpt-4o',
        apiKey: 'plain:test-key',
        updatedAt: new Date().toISOString(),
      }));

      const result = await useCase.runShellCertification({
        scope: 'TENANT',
        tenantId: 'tenant-1',
        modelProfileId: profile.id,
        profileHash: profile.profileHash,
        category: 'ACCOUNTING',
        testedBy: 'test-user',
      });

      expect(result.status).toBe('FAILED');
      expect(result.summary).toContain('Inference limit exceeded');
      expect(result.metadata?.preflightDiagnostic).toMatchObject({
        networkOk: true,
        inferenceOk: false,
      });
    });

    it('records success and passes the provider when pre-flight succeeds', async () => {
      const profile = makeProfile({ scope: 'TENANT', tenantId: 'tenant-1' });
      await profileRepo.save(profile);
      mockProvider.isAvailable.mockResolvedValue(true);
      mockProvider.chat.mockResolvedValue({ content: 'provider-ok' });

      const mockSettingsRepo = (useCase as any).settingsRepository;
      mockSettingsRepo.getConfig.mockResolvedValue(AiProviderConfig.fromJSON({
        companyId: 'tenant-1',
        isEnabled: true,
        provider: 'openai_compatible',
        model: 'gpt-4o',
        apiKey: 'plain:test-key',
        updatedAt: new Date().toISOString(),
      }));

      const result = await useCase.runShellCertification({
        scope: 'TENANT',
        tenantId: 'tenant-1',
        modelProfileId: profile.id,
        profileHash: profile.profileHash,
        category: 'ACCOUNTING',
        testedBy: 'test-user',
      });

      expect(result.status).toBe('CERTIFIED');
      expect(result.metadata?.preflightDiagnostic).toMatchObject({
        networkOk: true,
        inferenceOk: true,
      });
    });
  });
});
