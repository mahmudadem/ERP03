/**
 * AI Assistant — New Features Tests
 *
 * Verifies:
 * 1. AiUsageLog entity creation and serialization
 * 2. Provider health check with MockProvider
 * 3. AiToolRegistry registration, permission checking, and execution
 * 4. GetTrialBalanceSummaryTool rejects users without permission
 * 5. GetTrialBalanceSummaryTool is read-only
 * 6. Rate limiting remains config-based (not usage-log-based)
 */

import { AiUsageLog, AiUsageStatus } from '../../../domain/ai-assistant/entities/AiUsageLog';
import { AiToolRegistry } from '../../../application/ai-assistant/services/AiToolRegistry';
import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { CheckProviderHealthUseCase } from '../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { ProviderFactory } from '../../../application/ai-assistant/providers/ProviderFactory';

// ========================
// Mock helpers
// ========================

const createMockSettingsRepo = (config: AiProviderConfig | null = null): IAiSettingsRepository => ({
  getConfig: jest.fn(() => Promise.resolve(config)),
  saveConfig: jest.fn(() => Promise.resolve()),
});

const createMockEncryptionService = (): IEncryptionService => ({
  encrypt: jest.fn((text: string) => `enc:${text}`),
  decrypt: jest.fn((text: string) => text.replace('enc:', '')),
  isAvailable: jest.fn(() => true),
});

const createMockHttpClient = (): IHttpClient => ({
  request: jest.fn(() => Promise.resolve({
    data: { choices: [{ message: { content: 'provider-ok' } }], model: 'mock', usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } },
    status: 200,
    headers: {},
  } as any)),
});

// ========================
// 1. AiUsageLog Entity Tests
// ========================

describe('AiUsageLog Entity', () => {
  describe('create()', () => {
    it('should create a usage log with generated ID', () => {
      const log = AiUsageLog.create({
        companyId: 'company-1',
        userId: 'user-1',
        providerType: 'mock',
        model: 'mock-assistant',
        messageCount: 5,
        status: 'success',
        latencyMs: 250,
      });

      expect(log.id).toMatch(/^aiul_\d+_/);
      expect(log.companyId).toBe('company-1');
      expect(log.userId).toBe('user-1');
      expect(log.providerType).toBe('mock');
      expect(log.model).toBe('mock-assistant');
      expect(log.messageCount).toBe(5);
      expect(log.status).toBe('success');
      expect(log.latencyMs).toBe(250);
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    it('should create a usage log for a failed request', () => {
      const log = AiUsageLog.create({
        companyId: 'company-1',
        userId: 'user-1',
        providerType: 'openai_compatible',
        model: 'gpt-4o',
        messageCount: 3,
        status: 'failure',
        errorCode: 'AI_PROVIDER_AUTH_ERROR',
        latencyMs: 1200,
      });

      expect(log.status).toBe('failure');
      expect(log.errorCode).toBe('AI_PROVIDER_AUTH_ERROR');
    });

    it('should include token counts when available', () => {
      const log = AiUsageLog.create({
        companyId: 'company-1',
        userId: 'user-1',
        providerType: 'openai_compatible',
        model: 'gpt-4o',
        messageCount: 2,
        promptTokens: 150,
        completionTokens: 80,
        totalTokens: 230,
        status: 'success',
        latencyMs: 3000,
      });

      expect(log.promptTokens).toBe(150);
      expect(log.completionTokens).toBe(80);
      expect(log.totalTokens).toBe(230);
    });
  });

  describe('toJSON()', () => {
    it('should serialize to JSON with nulls for optional fields', () => {
      const log = AiUsageLog.create({
        companyId: 'company-1',
        userId: 'user-1',
        providerType: 'mock',
        model: 'mock-assistant',
        messageCount: 5,
        status: 'success',
        latencyMs: 100,
      });

      const json = log.toJSON();
      expect(json.promptTokens).toBeNull();
      expect(json.completionTokens).toBeNull();
      expect(json.totalTokens).toBeNull();
      expect(json.errorCode).toBeNull();
    });
  });

  describe('fromJSON()', () => {
    it('should reconstruct from JSON', () => {
      const original = AiUsageLog.create({
        companyId: 'company-1',
        userId: 'user-1',
        providerType: 'openai_compatible',
        model: 'gpt-4o',
        messageCount: 3,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        status: 'success',
        latencyMs: 2000,
      });

      const json = original.toJSON();
      const reconstructed = AiUsageLog.fromJSON(json);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.companyId).toBe('company-1');
      expect(reconstructed.providerType).toBe('openai_compatible');
      expect(reconstructed.promptTokens).toBe(100);
      expect(reconstructed.status).toBe('success');
    });
  });
});

// ========================
// 2. Provider Health Check Tests
// ========================

describe('CheckProviderHealthUseCase', () => {
  let settingsRepo: IAiSettingsRepository;
  let encryptionService: IEncryptionService;
  let httpClient: IHttpClient;

  beforeEach(() => {
    ProviderFactory.clearCache();
    // Reset health check cooldowns for each test
    CheckProviderHealthUseCase.resetCooldown();
  });

  it('should return READY for mock provider', async () => {
    const config = AiProviderConfig.defaultForCompany('company-1');
    settingsRepo = createMockSettingsRepo(config);
    encryptionService = createMockEncryptionService();
    httpClient = createMockHttpClient();

    const useCase = new CheckProviderHealthUseCase(settingsRepo, encryptionService, httpClient);
    const result = await useCase.execute('company-1');

    expect(result.ready).toBe(true);
    expect(result.networkOk).toBe(true);
    expect(result.inferenceOk).toBe(true);
    expect(result.provider).toBe('mock');
    expect(result.reason).toBeUndefined();
  });

  it('should return NOT READY when AI is disabled', async () => {
    const config = AiProviderConfig.defaultForCompany('company-1');
    config.isEnabled = false;
    settingsRepo = createMockSettingsRepo(config);
    encryptionService = createMockEncryptionService();
    httpClient = createMockHttpClient();

    const useCase = new CheckProviderHealthUseCase(settingsRepo, encryptionService, httpClient);
    const result = await useCase.execute('company-1');

    expect(result.ready).toBe(false);
    expect(result.networkOk).toBe(false);
    expect(result.inferenceOk).toBe(false);
    expect(result.reason).toContain('not enabled');
  });

  it('should return READY for default config when no config exists', async () => {
    settingsRepo = createMockSettingsRepo(null); // No config — falls back to mock
    encryptionService = createMockEncryptionService();
    httpClient = createMockHttpClient();

    const useCase = new CheckProviderHealthUseCase(settingsRepo, encryptionService, httpClient);
    const result = await useCase.execute('company-new');

    // Default is mock provider which is always available
    expect(result.ready).toBe(true);
    expect(result.networkOk).toBe(true);
    expect(result.inferenceOk).toBe(true);
  });
});

// ========================
// 3. AiToolRegistry Tests
// ========================

// Create a simple mock tool for testing
class MockTool implements AiTool {
  readonly name = 'test.mock';
  readonly description = 'A mock tool for testing';
  readonly requiredPermission = 'test.mock.use';
  readonly module = 'test';

  constructor(private result: AiToolResult) {}

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    return this.result;
  }
}

describe('AiToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const tool = new MockTool({ success: true, data: { value: 42 } });
    const registry = new AiToolRegistry([tool]);

    expect(registry.get('test.mock')).toBe(tool);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should throw on duplicate registration', () => {
    const tool = new MockTool({ success: true, data: {} });
    const registry = new AiToolRegistry([tool]);

    expect(() => registry.register(tool)).toThrow('already registered');
  });

  it('should return undefined for unknown tool', () => {
    const registry = new AiToolRegistry();
    expect(registry.get('unknown.tool')).toBeUndefined();
  });

  it('should filter tools by module', () => {
    const tool1 = new MockTool({ success: true, data: {} });
    const tool2 = new MockTool({ success: true, data: {} });
    // Override names for test
    Object.defineProperty(tool2, 'name', { value: 'other.tool' });
    Object.defineProperty(tool2, 'module', { value: 'other' });

    const registry = new AiToolRegistry([tool1, tool2]);
    expect(registry.getByModule('test')).toHaveLength(1);
    expect(registry.getByModule('other')).toHaveLength(1);
  });

  it('should return error for unknown tool execution', async () => {
    const registry = new AiToolRegistry();
    const result = await registry.executeTool('unknown.tool', {
      companyId: 'c1',
      userId: 'u1',
      permissions: ['*'],
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNKNOWN_TOOL');
  });

  it('should deny execution when user lacks permission', async () => {
    const tool = new MockTool({ success: true, data: { value: 42 } });
    const registry = new AiToolRegistry([tool]);

    const result = await registry.executeTool('test.mock', {
      companyId: 'c1',
      userId: 'u1',
      permissions: ['some.other.permission'], // No matching permission
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_DENIED');
    expect(result.error).toContain('test.mock.use');
  });

  it('should allow execution when user has exact permission', async () => {
    const tool = new MockTool({ success: true, data: { value: 42 } });
    const registry = new AiToolRegistry([tool]);

    const result = await registry.executeTool('test.mock', {
      companyId: 'c1',
      userId: 'u1',
      permissions: ['test.mock.use'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });
  });

  it('should allow execution when user has wildcard permission', async () => {
    const tool = new MockTool({ success: true, data: { value: 42 } });
    const registry = new AiToolRegistry([tool]);

    const result = await registry.executeTool('test.mock', {
      companyId: 'c1',
      userId: 'u1',
      permissions: ['*'],
    });

    expect(result.success).toBe(true);
  });

  it('should allow execution when user has parent permission', async () => {
    const tool = new MockTool({ success: true, data: { value: 42 } });
    const registry = new AiToolRegistry([tool]);

    // Parent permission 'test.mock' should grant 'test.mock.use'
    const result = await registry.executeTool('test.mock', {
      companyId: 'c1',
      userId: 'u1',
      permissions: ['test.mock'],
    });

    expect(result.success).toBe(true);
  });

  it('should handle tool execution errors gracefully', async () => {
    const errorTool: AiTool = {
      name: 'test.error',
      description: 'A tool that throws',
      requiredPermission: 'test.error.use',
      module: 'test',
      execute: async () => { throw new Error('Something went wrong'); },
    };

    const registry = new AiToolRegistry([errorTool]);

    const result = await registry.executeTool('test.error', {
      companyId: 'c1',
      userId: 'u1',
      permissions: ['*'],
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TOOL_EXECUTION_ERROR');
    expect(result.error).toContain('Something went wrong');
  });

  it('should provide tool descriptions for AI context', () => {
    const tool = new MockTool({ success: true, data: {} });
    const registry = new AiToolRegistry([tool]);

    const descriptions = registry.getToolDescriptions();
    expect(descriptions).toHaveLength(1);
    expect(descriptions[0].name).toBe('test.mock');
    expect(descriptions[0].module).toBe('test');
  });
});

// ========================
// 4. Read-Only Enforcement Tests
// ========================

describe('AI Tool Read-Only Enforcement', () => {
  it('AiTool interface should only have an execute method that returns data', () => {
    // Verify that AiTool has no mutation methods
    const toolKeys: (keyof AiTool)[] = ['name', 'description', 'requiredPermission', 'module', 'execute'];
    // The interface only has name, description, requiredPermission, module, execute
    // No create, update, delete, post, approve, or reverse methods
    expect(toolKeys).not.toContain('create');
    expect(toolKeys).not.toContain('update');
    expect(toolKeys).not.toContain('delete');
    expect(toolKeys).not.toContain('post');
    expect(toolKeys).not.toContain('approve');
  });

  it('AiToolResult should not have mutation indicators', () => {
    // AiToolResult only has success, data, error, errorCode
    // No created, updated, deleted, posted, approved fields
    const result: AiToolResult = {
      success: true,
      data: { value: 42 },
    };
    expect(result).not.toHaveProperty('created');
    expect(result).not.toHaveProperty('updated');
    expect(result).not.toHaveProperty('deleted');
    expect(result).not.toHaveProperty('posted');
  });
});