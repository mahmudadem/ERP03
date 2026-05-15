import { CheckProviderHealthUseCase } from '../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase';
import { ProviderFactory } from '../../../application/ai-assistant/providers/ProviderFactory';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { HttpRequestConfig, HttpResponse, IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
import { AiModelProfileUseCase } from '../../../application/ai-assistant/use-cases/AiModelProfileUseCase';

const createEncryptionService = (): IEncryptionService => ({
  encrypt: jest.fn((plaintext: string) => `enc:${plaintext}`),
  decrypt: jest.fn((encrypted: string) => encrypted.replace('enc:', '')),
  isAvailable: jest.fn(() => true),
});

const createSettingsRepository = (config: AiProviderConfig | null): IAiSettingsRepository => ({
  getConfig: jest.fn(() => Promise.resolve(config)),
  saveConfig: jest.fn(() => Promise.resolve()),
});

type NativeMode = 'tool-call' | 'text-only';

class DiagnosticHttpClient implements IHttpClient {
  readonly requests: HttpRequestConfig[] = [];

  constructor(
    private nativeMode: NativeMode,
    private textPlanContent: string,
  ) {}

  async request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    this.requests.push(config);

    if (config.method === 'GET' && config.url.endsWith('/models')) {
      return {
        data: { data: [{ id: 'gpt-4o' }] } as T,
        status: 200,
        headers: {},
      };
    }

    const body = config.body as any;
    if (Array.isArray(body?.tools) && body.tools.length > 0) {
      return {
        data: this.createNativeDiagnosticResponse() as T,
        status: 200,
        headers: {},
      };
    }

    const userMessage = this.getLastUserMessage(body?.messages);
    if (String(userMessage).includes('[ERP_TOOL_PLAN]')) {
      return {
        data: this.createChatResponse(this.textPlanContent) as T,
        status: 200,
        headers: {},
      };
    }

    return {
      data: this.createChatResponse('provider-ok') as T,
      status: 200,
      headers: {},
    };
  }

  private createNativeDiagnosticResponse(): unknown {
    if (this.nativeMode === 'tool-call') {
      return {
        id: 'chatcmpl-tool-diagnostic',
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call-diagnostic',
              type: 'function',
              function: {
                name: 'diagnostics_ping',
                arguments: '{"probe":"native-tool-call-ok"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { total_tokens: 12 },
      };
    }

    return this.createChatResponse('I cannot call tools.');
  }

  private getLastUserMessage(messages: unknown): string {
    if (!Array.isArray(messages)) {
      return '';
    }

    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index] as any;
      if (message?.role === 'user') {
        return String(message.content ?? '');
      }
    }

    return '';
  }

  private createChatResponse(content: string): unknown {
    return {
      id: 'chatcmpl-diagnostic',
      model: 'gpt-4o',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      }],
      usage: { total_tokens: 10 },
    };
  }
}

class InMemoryModelProfileRepository implements IAiModelProfileRepository {
  readonly profiles = new Map<string, AiModelProfile>();

  async getById(id: string): Promise<AiModelProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async getByProviderAndModel(provider: string, modelName: string): Promise<AiModelProfile | null> {
    return this.getById(AiModelProfile.makeId(provider, modelName));
  }

  async list(): Promise<AiModelProfile[]> {
    return Array.from(this.profiles.values());
  }

  async save(profile: AiModelProfile): Promise<void> {
    this.profiles.set(profile.id, profile);
  }

  async delete(id: string): Promise<void> {
    this.profiles.delete(id);
  }
}

const createOpenAiConfig = (model = 'gpt-4o'): AiProviderConfig => new AiProviderConfig(
  'company-1',
  'openai_compatible',
  model,
  'plain:test-key',
  'https://api.example.test/v1',
  4096,
  100,
  0,
  undefined,
  true,
  new Date(),
);

describe('CheckProviderHealthUseCase', () => {
  beforeEach(() => {
    ProviderFactory.clearCache();
    CheckProviderHealthUseCase.resetCooldown();
  });

  it('reports native OpenAI-style tool calling when the model returns tool_calls', async () => {
    const httpClient = new DiagnosticHttpClient(
      'tool-call',
      '[ERP_TOOL_PLAN]{"calls":[]}[/ERP_TOOL_PLAN]',
    );
    const mockModelProfileUseCase = {
      resolveRuntimeProfile: jest.fn().mockResolvedValue({
        provider: 'openai_compatible',
        modelName: 'gpt-4o',
        status: 'recommended',
        supportsToolCalling: true,
        supportsStructuredJson: true,
        textOnlyMode: false,
        warningLevel: 'info',
        warningMessage: '',
        recommendedUseCases: ['accounting'],
      }),
      upsertProfile: jest.fn(),
      syncBuiltInProfiles: jest.fn(),
      recordDiagnostics: jest.fn(),
    } as any;
    const useCase = new CheckProviderHealthUseCase(
      createSettingsRepository(createOpenAiConfig()),
      createEncryptionService(),
      httpClient,
      mockModelProfileUseCase,
    );

    const result = await useCase.execute('company-1');

    expect(result.ready).toBe(true);
    expect(result.toolDiagnostics.erpToolsReady).toBe(true);
    expect(result.toolDiagnostics.recommendedMode).toBe('native-tool-calling');
    expect(result.toolDiagnostics.nativeToolCalling).toMatchObject({
      attempted: true,
      ok: true,
      supportedByProvider: true,
      expectedByCatalog: true,
    });
    expect(result.toolDiagnostics.textPlan).toMatchObject({
      attempted: false,
      ok: false,
    });
    expect(result.checks.find(check => check.id === 'nativeToolCalling')?.status).toBe('passed');
  });

  it('reports guarded text-plan readiness when native tool calling is not returned', async () => {
    const httpClient = new DiagnosticHttpClient(
      'text-only',
      '[ERP_TOOL_PLAN]{"calls":[{"tool":"diagnostics_ping","arguments":{"probe":"text-plan-ok"},"reason":"diagnostic"}]}[/ERP_TOOL_PLAN]',
    );
    const mockModelProfileUseCase = {
      resolveRuntimeProfile: jest.fn().mockResolvedValue({
        provider: 'openai_compatible',
        modelName: 'openai/gpt-oss-20b:free',
        status: 'experimental',
        supportsToolCalling: false,
        supportsStructuredJson: false,
        textOnlyMode: true,
        warningLevel: 'warning',
        warningMessage: '',
        recommendedUseCases: [],
      }),
      upsertProfile: jest.fn(),
      syncBuiltInProfiles: jest.fn(),
      recordDiagnostics: jest.fn(),
    } as any;
    const useCase = new CheckProviderHealthUseCase(
      createSettingsRepository(createOpenAiConfig('openai/gpt-oss-20b:free')),
      createEncryptionService(),
      httpClient,
      mockModelProfileUseCase,
    );

    const result = await useCase.execute('company-1');

    expect(result.ready).toBe(true);
    expect(result.modelProfile.status).toBe('experimental');
    expect(result.modelProfile.textOnlyMode).toBe(true);
    expect(result.toolDiagnostics.erpToolsReady).toBe(true);
    expect(result.toolDiagnostics.recommendedMode).toBe('text-plan');
    expect(result.toolDiagnostics.nativeToolCalling).toMatchObject({
      attempted: true,
      ok: false,
      supportedByProvider: true,
      expectedByCatalog: false,
    });
    expect(result.toolDiagnostics.textPlan).toMatchObject({
      attempted: true,
      ok: true,
    });
    expect(result.checks.find(check => check.id === 'textPlan')?.status).toBe('passed');
  });

  it('skips all diagnostics when AI Assistant is disabled', async () => {
    const config = createOpenAiConfig();
    config.updateConfig({ isEnabled: false });

    const mockModelProfileUseCase = {
      resolveRuntimeProfile: jest.fn().mockResolvedValue({
        provider: 'openai_compatible',
        modelName: 'gpt-4o',
        status: 'recommended',
        supportsToolCalling: true,
        supportsStructuredJson: true,
        textOnlyMode: false,
        warningLevel: 'info',
        warningMessage: '',
        recommendedUseCases: ['accounting'],
      }),
      upsertProfile: jest.fn(),
      syncBuiltInProfiles: jest.fn(),
      recordDiagnostics: jest.fn(),
    } as any;
    const useCase = new CheckProviderHealthUseCase(
      createSettingsRepository(config),
      createEncryptionService(),
      new DiagnosticHttpClient('tool-call', ''),
      mockModelProfileUseCase,
    );

    const result = await useCase.execute('company-1');

    expect(result.ready).toBe(false);
    expect(result.toolDiagnostics.erpToolsReady).toBe(false);
    expect(result.toolDiagnostics.recommendedMode).toBe('unavailable');
    expect(result.checks.every(check => check.status === 'skipped')).toBe(true);
  });

  it('uses editable model profiles and stores diagnostic results', async () => {
    const profileRepo = new InMemoryModelProfileRepository();
    const profileUseCase = new AiModelProfileUseCase(profileRepo);
    await profileUseCase.upsertProfile({
      provider: 'openai_compatible',
      modelName: 'qwen/qwen3.5-flash-20260224',
      status: 'tested',
      supportsToolCalling: true,
      supportsStructuredJson: true,
      maxContextTokens: 32768,
      recommendedUseCases: ['accounting'],
      tags: ['diagnostics-passed'],
      warningLevel: 'info',
      textOnlyMode: false,
      warningMessage: '',
    });

    const useCase = new CheckProviderHealthUseCase(
      createSettingsRepository(createOpenAiConfig('qwen/qwen3.5-flash-20260224')),
      createEncryptionService(),
      new DiagnosticHttpClient('tool-call', ''),
      profileUseCase,
    );

    const result = await useCase.execute('company-1');
    const saved = await profileRepo.getByProviderAndModel('openai_compatible', 'qwen/qwen3.5-flash-20260224');

    expect(result.modelProfile.status).toBe('tested');
    expect(result.modelProfile.textOnlyMode).toBe(false);
    expect(result.toolDiagnostics.recommendedMode).toBe('native-tool-calling');
    expect(saved?.lastDiagnosticStatus).toBe('passed');
    expect(saved?.lastDiagnosticMode).toBe('native-tool-calling');
  });

  it('can run diagnostics for a platform-selected model profile using company credentials', async () => {
    const profileRepo = new InMemoryModelProfileRepository();
    const profileUseCase = new AiModelProfileUseCase(profileRepo);
    await profileUseCase.upsertProfile({
      provider: 'openai_compatible',
      modelName: 'google/gemma-4-31b-it:free',
      status: 'custom',
      supportsToolCalling: true,
      supportsStructuredJson: true,
      maxContextTokens: 4096,
      recommendedUseCases: ['diagnostics'],
      tags: ['free'],
      warningLevel: 'warning',
      textOnlyMode: false,
      warningMessage: '',
    });

    const httpClient = new DiagnosticHttpClient('tool-call', '');
    const useCase = new CheckProviderHealthUseCase(
      createSettingsRepository(createOpenAiConfig('gpt-4o')),
      createEncryptionService(),
      httpClient,
      profileUseCase,
    );

    const result = await useCase.execute({
      companyId: 'company-1',
      providerOverride: 'openai_compatible',
      modelOverride: 'google/gemma-4-31b-it:free',
    });
    const saved = await profileRepo.getByProviderAndModel('openai_compatible', 'google/gemma-4-31b-it:free');

    expect(result.model).toBe('google/gemma-4-31b-it:free');
    expect(saved?.lastDiagnosticStatus).toBe('passed');
    expect(httpClient.requests.some(request => (request.body as any)?.model === 'google/gemma-4-31b-it:free')).toBe(true);
  });
});
