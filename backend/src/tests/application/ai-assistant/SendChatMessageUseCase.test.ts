/**
 * SendChatMessageUseCase Tests
 *
 * Verifies that:
 * 1. Chat works with the mock provider
 * 2. Empty messages are rejected
 * 3. Messages exceeding 10000 chars are rejected
 * 4. Rate limiting works (blocks when dailyRequestCount >= maxRequestsPerDay)
 * 5. Disabled AI returns 403 error
 * 6. Decryption of apiKey works for provider config
 *
 * Note: Rate limiting is now based on dailyRequestCount in AiProviderConfig,
 * NOT on querying stored messages. Deleting conversations does NOT reset the limit.
 */

import { SendChatMessageUseCase } from '../../../application/ai-assistant/use-cases/SendChatMessageUseCase';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IAiChatRepository } from '../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { IAiSettingsRepository } from '../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { IEncryptionService } from '../../../infrastructure/crypto/IEncryptionService';
import { IHttpClient, HttpResponse } from '../../../infrastructure/http/IHttpClient';
import { ApiError } from '../../../api/errors/ApiError';
import { ProviderFactory } from '../../../application/ai-assistant/providers/ProviderFactory';

// Mock encryption service — just passes through for tests
const createMockEncryptionService = (): IEncryptionService => ({
  encrypt: jest.fn((plaintext: string) => `enc:${plaintext}`),
  decrypt: jest.fn((encrypted: string) => encrypted.replace('enc:', '')),
  isAvailable: jest.fn(() => true),
});

// Mock HTTP client — returns empty responses (tests use mock provider, so HTTP is never called)
class MockHttpClient {
  request = jest.fn().mockResolvedValue({
    data: {},
    status: 200,
    headers: {},
  });
}

const createMockHttpClient = (): IHttpClient => new MockHttpClient() as unknown as IHttpClient;

// Mock chat repository — create returns the message passed to it
const createMockChatRepo = (): IAiChatRepository => ({
  create: jest.fn((msg: any) => Promise.resolve(msg)),
  getConversationMessages: jest.fn(() => Promise.resolve([])),
  getRecentConversations: jest.fn(() => Promise.resolve([])),
  deleteConversation: jest.fn(() => Promise.resolve()),
  countToday: jest.fn(() => Promise.resolve(0)),
});

// Mock settings repository — returns config and tracks saves
const createMockSettingsRepo = (config: AiProviderConfig | null = null): IAiSettingsRepository & { savedConfigs: AiProviderConfig[] } => {
  let currentConfig = config;
  const savedConfigs: AiProviderConfig[] = [];
  return {
    getConfig: jest.fn(() => Promise.resolve(currentConfig ? currentConfig : null)),
    saveConfig: jest.fn((c: AiProviderConfig) => {
      currentConfig = c; // Update so subsequent reads see the saved state
      savedConfigs.push(c);
      return Promise.resolve();
    }),
    savedConfigs,
  };
};

describe('SendChatMessageUseCase', () => {
  let chatRepo: IAiChatRepository;
  let settingsRepo: ReturnType<typeof createMockSettingsRepo>;
  let encryptionService: IEncryptionService;

  beforeEach(() => {
    // Clear provider cache before each test
    ProviderFactory.clearCache();
    chatRepo = createMockChatRepo();
    encryptionService = createMockEncryptionService();
  });

  describe('with mock provider', () => {
    it('should successfully send a message and get a response', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello, AI Assistant!',
      });

      expect(result).toBeDefined();
      expect(result.userMessage).toBeDefined();
      expect(result.assistantMessage).toBeDefined();
      expect(result.userMessage.content).toBe('Hello, AI Assistant!');
      expect(result.assistantMessage.content).toBeDefined();
      expect(typeof result.assistantMessage.content).toBe('string');
      expect(result.provider).toBe('mock');
    });

    it('should save both user and assistant messages', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'What is an invoice?',
      });

      // Should call create twice — once for user message, once for assistant response
      expect(chatRepo.create).toHaveBeenCalledTimes(2);
    });

    it('should generate conversation ID if not provided', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
      });

      expect(result.userMessage.conversationId).toMatch(/^conv_\d+_/);
    });

    it('should use provided conversation ID', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
        conversationId: 'conv-existing-123',
      });

      expect(result.userMessage.conversationId).toBe('conv-existing-123');
    });

    it('should increment the rate limit count on successful request', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
      });

      // Rate limiter should have saved the config with incremented count
      expect(settingsRepo.savedConfigs.length).toBeGreaterThan(0);
      const savedConfig = settingsRepo.savedConfigs[0];
      expect(savedConfig.dailyRequestCount).toBe(1);
      expect(savedConfig.dailyRequestDate).toBe(AiProviderConfig.getTodayDateString());
    });

    it('should persist toolResults in assistant message metadata', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const mockOrchestrator = {
        detectAndExecute: jest.fn().mockResolvedValue([
          {
            toolName: 'accounting.getTrialBalanceSummary',
            result: {
              success: true,
              data: {
                totalDebit: 100,
                totalCredit: 100,
                isBalanced: true,
              },
            },
          },
        ]),
        formatToolResultsForContext: jest.fn().mockReturnValue('[TOOL RESULT MOCK]'),
        getToolDescriptionsForPrompt: jest.fn().mockReturnValue('Available tools: ...'),
      } as any;

      const useCase = new SendChatMessageUseCase(
        chatRepo,
        settingsRepo,
        encryptionService,
        createMockHttpClient(),
        undefined,
        mockOrchestrator,
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'show me trial balance',
      });

      expect(mockOrchestrator.detectAndExecute).toHaveBeenCalled();
      expect((result.assistantMessage.metadata as any)?.toolResults).toBeDefined();
      expect((result.assistantMessage.metadata as any)?.toolResults).toHaveLength(1);
      // Keep provider metadata too (from MockProvider)
      expect((result.assistantMessage.metadata as any)?.isMock).toBe(true);
    });

    it('should prefer one sufficient deterministic tool result over multiple matches', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const firstToolResult = {
        toolName: 'accounting.getTrialBalanceSummary',
        result: { success: true, data: { totalDebit: 100, totalCredit: 100 } },
      };
      const secondToolResult = {
        toolName: 'accounting.getBalanceSheet',
        result: { success: true, data: { totalAssets: 100 } },
      };
      const mockOrchestrator = {
        buildAllowedToolContracts: jest.fn().mockResolvedValue({ contracts: [], nameMapping: new Map(), allowedToolIds: [] }),
        detectAndExecute: jest.fn().mockResolvedValue([firstToolResult, secondToolResult]),
        formatToolResultsForContext: jest.fn().mockReturnValue('[ONE TOOL RESULT]'),
        getToolDescriptionsForPrompt: jest.fn().mockReturnValue('Available tools: ...'),
      } as any;

      const useCase = new SendChatMessageUseCase(
        chatRepo,
        settingsRepo,
        encryptionService,
        createMockHttpClient(),
        undefined,
        mockOrchestrator,
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'show trial balance and balance sheet',
      });

      expect(mockOrchestrator.formatToolResultsForContext).toHaveBeenCalledWith([firstToolResult]);
      expect((result.assistantMessage.metadata as any)?.toolResults).toHaveLength(1);
      expect((result.assistantMessage.metadata as any)?.toolResults[0].toolName).toBe('accounting.getTrialBalanceSummary');
    });

    it('should include custom untested model warning metadata', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      mockConfig.model = 'unknown-custom-model';
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
      });

      const metadata = result.assistantMessage.metadata as any;
      expect(metadata.modelProfile.status).toBe('custom');
      expect(metadata.modelProfile.warningLevel).toBe('danger');
      expect(metadata.runtimeWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('input validation', () => {
    it('should reject empty messages with ApiError 400', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      await expect(useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: '',
      })).rejects.toThrow();

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: '' });
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(400);
      }
    });

    it('should reject whitespace-only messages', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      await expect(useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: '   ',
      })).rejects.toThrow();
    });

    it('should reject messages exceeding 10000 characters', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      await expect(useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'x'.repeat(10001),
      })).rejects.toThrow();

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'x'.repeat(10001) });
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(400);
      }
    });
  });

  describe('disabled AI', () => {
    it('should reject requests when AI is disabled with ApiError 403', async () => {
      const config = new AiProviderConfig(
        'company-1',
        'mock',
        'mock-assistant',
        undefined,
        undefined,
        4096,
        100,
        0,              // dailyRequestCount
        undefined,      // dailyRequestDate
        false           // disabled
      );
      settingsRepo = createMockSettingsRepo(config);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      try {
        await useCase.execute({
          companyId: 'company-1',
          userId: 'user-1',
          message: 'Hello',
        });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(403);
      }
    });
  });

  describe('rate limiting', () => {
    it('should allow requests when within the daily limit', async () => {
      const config = AiProviderConfig.defaultForCompany('company-1');
      config.dailyRequestCount = 5;
      config.dailyRequestDate = AiProviderConfig.getTodayDateString();
      settingsRepo = createMockSettingsRepo(config);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      // Should not throw — 5 < 100 (default limit)
      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
      });

      expect(result).toBeDefined();
    });

    it('should block requests when daily limit is exceeded with ApiError 429', async () => {
      const config = AiProviderConfig.defaultForCompany('company-1');
      config.updateConfig({ maxRequestsPerDay: 100 });
      config.dailyRequestCount = 100; // Already at limit
      config.dailyRequestDate = AiProviderConfig.getTodayDateString();
      settingsRepo = createMockSettingsRepo(config);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      try {
        await useCase.execute({
          companyId: 'company-1',
          userId: 'user-1',
          message: 'Hello',
        });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(429);
        expect((error as ApiError).code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should reset the count when the day changes', async () => {
      const config = AiProviderConfig.defaultForCompany('company-1');
      config.updateConfig({ maxRequestsPerDay: 5 });
      config.dailyRequestCount = 5; // Used all 5 yesterday
      config.dailyRequestDate = '2020-01-01'; // Old date → new day
      settingsRepo = createMockSettingsRepo(config);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      // Should not throw — it's a new day, so count resets to 0 then increments to 1
      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
      });

      expect(result).toBeDefined();
    });
  });
});
