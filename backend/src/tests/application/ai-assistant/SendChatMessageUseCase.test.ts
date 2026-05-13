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

class SequenceHttpClient {
  request = jest.fn(async (config: any) => {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('No queued HTTP response');
    }
    this.requests.push(config);
    return {
      data: response,
      status: 200,
      headers: {},
    };
  });

  requests: any[] = [];

  constructor(private responses: any[]) {}
}

const createOpenAiConfig = (
  model: string,
  companyId = 'company-1',
) => new AiProviderConfig(
  companyId,
  'openai_compatible',
  model,
  'plain:test-api-key',
  'https://ai.example/v1',
  4096,
  100,
  0,
  undefined,
  true,
);

const createToolContract = (name: string, parameters: Record<string, unknown> = { type: 'object', properties: {} }) => ({
  name: name.replace(/\./g, '_'),
  originalName: name,
  description: `Use ${name}`,
  whenToUse: `Use ${name}`,
  operationType: 'READ',
  moduleId: name.split('.')[0],
  requiredPermissions: ['*'],
  inputSchema: parameters,
  parameters,
  outputSchema: { type: 'object', properties: {} },
  examples: [],
  safetyNotes: ['Read-only tool. No data is modified.'],
  safeForAutoInvoke: true,
});

const createRunContext = () => ({
  aiRunId: 'run-test-1',
  companyId: 'company-1',
  userId: 'user-1',
  conversationId: 'conv-test',
  createdAt: Date.now(),
  expiresAt: Date.now() + 300000,
  maxToolCalls: 5,
  toolCallsUsed: 0,
  allowedToolIds: ['accounting.getTrialBalanceSummary'],
  providerModel: 'openai_compatible/test',
});

// Mock chat repository — create returns the message passed to it
const createMockChatRepo = (): IAiChatRepository => ({
  create: jest.fn((msg: any) => Promise.resolve(msg)),
  getById: jest.fn(() => Promise.resolve(null)),
  updateFeedback: jest.fn((companyId: string, messageId: string, feedback: any) => {
    throw new Error('updateFeedback not implemented in mock');
  }),
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
    // Clear static deduplication locks to prevent test pollution
    (SendChatMessageUseCase as any).activeLocks.clear();
  });

  afterEach(() => {
    // Clear static deduplication locks after each test
    (SendChatMessageUseCase as any).activeLocks.clear();
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

    it('should not auto-execute keyword matches before the model requests a tool', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const mockOrchestrator = {
        detectAndExecute: jest.fn(),
        buildAllowedToolContracts: jest.fn().mockResolvedValue({ contracts: [], nameMapping: new Map(), allowedToolIds: [] }),
        getKeywordHints: jest.fn().mockReturnValue([]),
        buildToolPlanningContext: jest.fn().mockReturnValue(''),
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

      expect(mockOrchestrator.detectAndExecute).not.toHaveBeenCalled();
      expect((result.assistantMessage.metadata as any)?.toolResults).toEqual([]);
      expect(Object.prototype.hasOwnProperty.call(result.assistantMessage.metadata || {}, 'toolCallResults')).toBe(false);
      expect((result.assistantMessage.metadata as any)?.isMock).toBe(true);
    });

    it('should execute guarded ERP_TOOL_PLAN calls for unknown/text-only models', async () => {
      const config = createOpenAiConfig('openai/gpt-oss-120b:free');
      settingsRepo = createMockSettingsRepo(config);
      const httpClient = new SequenceHttpClient([
        {
          model: 'openai/gpt-oss-120b:free',
          choices: [{
            message: {
              role: 'assistant',
              content: '[ERP_TOOL_PLAN]{"calls":[{"tool":"accounting_getTrialBalanceSummary","arguments":{"asOfDate":"2026-05-08"},"reason":"trial balance requested"}]}[/ERP_TOOL_PLAN]',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        },
        {
          model: 'openai/gpt-oss-120b:free',
          choices: [{
            message: {
              role: 'assistant',
              content: 'The trial balance is balanced. Total debit and total credit are both 100.',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
        },
      ]);

      const mockOrchestrator = {
        buildAllowedToolContracts: jest.fn().mockResolvedValue({
          contracts: [createToolContract('accounting.getTrialBalanceSummary', { type: 'object', properties: { asOfDate: { type: 'string' } } })],
          nameMapping: new Map([['accounting_getTrialBalanceSummary', 'accounting.getTrialBalanceSummary']]),
          allowedToolIds: ['accounting.getTrialBalanceSummary'],
        }),
        getKeywordHints: jest.fn().mockReturnValue([{ toolName: 'accounting.getTrialBalanceSummary', matchedKeywords: ['trial balance'] }]),
        buildToolPlanningContext: jest.fn().mockReturnValue('[ERP TOOL PLANNING CONTEXT]'),
        executeStructuredToolCalls: jest.fn().mockResolvedValue([{
          toolName: 'accounting.getTrialBalanceSummary',
          toolCallId: 'text_plan_call_1',
          approved: true,
          result: { success: true, data: { totalDebit: 100, totalCredit: 100, isBalanced: true } },
        }]),
        formatStructuredResultsForProviderContext: jest.fn().mockReturnValue('[TOOL RESULT: accounting.getTrialBalanceSummary]'),
      } as any;

      const runtimeGuard = {
        createRun: jest.fn(() => createRunContext()),
      } as any;

      const useCase = new SendChatMessageUseCase(
        chatRepo,
        settingsRepo,
        encryptionService,
        httpClient as unknown as IHttpClient,
        undefined,
        mockOrchestrator,
        undefined,
        undefined,
        runtimeGuard,
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'show me trial balance',
      });

      expect(httpClient.requests).toHaveLength(2);
      expect((httpClient.requests[0].body as any).tools).toBeUndefined();
      expect(mockOrchestrator.executeStructuredToolCalls).toHaveBeenCalledWith(
        'run-test-1',
        [{ id: 'text_plan_call_1', name: 'accounting_getTrialBalanceSummary', arguments: { asOfDate: '2026-05-08' } }],
        expect.any(Map),
        'company-1',
        'user-1',
      );
      expect((result.assistantMessage.metadata as any).toolCallsRequested).toEqual(['accounting_getTrialBalanceSummary']);
      expect((result.assistantMessage.metadata as any).toolResults).toHaveLength(1);
      expect(result.assistantMessage.content).toContain('trial balance is balanced');
    });

    it('should allow native tool-capable models to chain multiple guarded tool calls', async () => {
      const config = createOpenAiConfig('gpt-4o');
      settingsRepo = createMockSettingsRepo(config);
      const httpClient = new SequenceHttpClient([
        {
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call-1',
                type: 'function',
                function: { name: 'accounting_getChartOfAccountsSummary', arguments: '{}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 },
        },
        {
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call-2',
                type: 'function',
                function: { name: 'accounting_getAccountStatementSummary', arguments: '{"accountCode":"1000"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 120, completion_tokens: 5, total_tokens: 125 },
        },
        {
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: 'Cash account 1000 has a closing balance of 250.',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 },
        },
      ]);

      const mockOrchestrator = {
        buildAllowedToolContracts: jest.fn().mockResolvedValue({
          contracts: [
            createToolContract('accounting.getChartOfAccountsSummary'),
            createToolContract('accounting.getAccountStatementSummary', { type: 'object', properties: { accountCode: { type: 'string' } } }),
          ],
          nameMapping: new Map([
            ['accounting_getChartOfAccountsSummary', 'accounting.getChartOfAccountsSummary'],
            ['accounting_getAccountStatementSummary', 'accounting.getAccountStatementSummary'],
          ]),
          allowedToolIds: ['accounting.getChartOfAccountsSummary', 'accounting.getAccountStatementSummary'],
        }),
        getKeywordHints: jest.fn().mockReturnValue([{ toolName: 'accounting.getAccountStatementSummary', matchedKeywords: ['account statement'] }]),
        buildToolPlanningContext: jest.fn().mockReturnValue('[ERP TOOL PLANNING CONTEXT]'),
        executeStructuredToolCalls: jest.fn()
          .mockResolvedValueOnce([{
            toolName: 'accounting.getChartOfAccountsSummary',
            toolCallId: 'call-1',
            approved: true,
            result: { success: true, data: { topAccounts: [{ code: '1000', name: 'Cash' }] } },
          }])
          .mockResolvedValueOnce([{
            toolName: 'accounting.getAccountStatementSummary',
            toolCallId: 'call-2',
            approved: true,
            result: { success: true, data: { accountCode: '1000', closingBalance: 250 } },
          }]),
        formatStructuredResultsForProviderContext: jest.fn()
          .mockReturnValueOnce('[TOOL RESULT: accounting.getChartOfAccountsSummary]')
          .mockReturnValueOnce('[TOOL RESULT: accounting.getAccountStatementSummary]'),
      } as any;

      const runtimeGuard = {
        createRun: jest.fn(() => ({ ...createRunContext(), allowedToolIds: ['accounting.getChartOfAccountsSummary', 'accounting.getAccountStatementSummary'] })),
      } as any;

      const useCase = new SendChatMessageUseCase(
        chatRepo,
        settingsRepo,
        encryptionService,
        httpClient as unknown as IHttpClient,
        undefined,
        mockOrchestrator,
        undefined,
        undefined,
        runtimeGuard,
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'show account statement for Cash',
      });

      expect(httpClient.requests).toHaveLength(3);
      expect((httpClient.requests[0].body as any).tools).toHaveLength(2);
      expect(mockOrchestrator.executeStructuredToolCalls).toHaveBeenCalledTimes(2);
      expect((result.assistantMessage.metadata as any).toolCallsRequested).toEqual([
        'accounting_getChartOfAccountsSummary',
        'accounting_getAccountStatementSummary',
      ]);
      expect((result.assistantMessage.metadata as any).toolResults).toHaveLength(2);
      expect(result.assistantMessage.content).toContain('closing balance of 250');
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

    it('should inject recent tool result metadata so follow-up messages keep conversation context', async () => {
      const config = createOpenAiConfig('gpt-4o-mini');
      settingsRepo = createMockSettingsRepo(config);
      const httpClient = new SequenceHttpClient([
        {
          model: 'gpt-4o-mini',
          choices: [{
            message: {
              role: 'assistant',
              content: 'cash syp1 has a credit-side balance based on the previous trial balance data.',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 140, completion_tokens: 20, total_tokens: 160 },
        },
      ]);

      const chatRepoWithHistory: IAiChatRepository = {
        ...createMockChatRepo(),
        getConversationMessages: jest.fn(() => Promise.resolve([
          {
            role: 'user',
            content: 'Show me the trial balance summary',
          } as any,
          {
            role: 'assistant',
            content: 'Here is the trial balance summary.',
            metadata: {
              toolResults: [{
                toolName: 'accounting.getTrialBalanceSummary',
                result: {
                  success: true,
                  data: {
                    totalDebit: 668837,
                    totalCredit: 668837,
                    accounts: [
                      { code: '10301', name: 'cash syp1', balance: -15934 },
                    ],
                  },
                },
              }],
            },
          } as any,
        ])),
      };

      const useCase = new SendChatMessageUseCase(
        chatRepoWithHistory,
        settingsRepo,
        encryptionService,
        httpClient as unknown as IHttpClient,
      );

      await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-existing',
        message: 'اشرح cash syp1',
      });

      const sentMessages = (httpClient.requests[0].body as any).messages;
      const systemPrompt = sentMessages[0].content;

      expect(systemPrompt).toContain('Treat every user message as part of one ongoing conversation');
      expect(systemPrompt).toContain('RECENT ERP DATA FROM THIS CONVERSATION');
      expect(systemPrompt).toContain('accounting.getTrialBalanceSummary');
      expect(systemPrompt).toContain('cash syp1');
      expect(systemPrompt).toContain('10301');
      expect(systemPrompt).toContain('Ask the user a short clarification question only when');
      expect(sentMessages.map((m: any) => m.content)).toContain('Here is the trial balance summary.');
    });

    it('should respect settings that disable previous tool result context injection', async () => {
      const config = createOpenAiConfig('gpt-4o-mini');
      config.updateConfig({ includePreviousToolResults: false });
      settingsRepo = createMockSettingsRepo(config);
      const httpClient = new SequenceHttpClient([
        {
          model: 'gpt-4o-mini',
          choices: [{
            message: {
              role: 'assistant',
              content: 'I need more detail to answer that.',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        },
      ]);

      const chatRepoWithHistory: IAiChatRepository = {
        ...createMockChatRepo(),
        getConversationMessages: jest.fn(() => Promise.resolve([
          {
            role: 'assistant',
            content: 'Here is the trial balance summary.',
            metadata: {
              toolResults: [{
                toolName: 'accounting.getTrialBalanceSummary',
                result: {
                  success: true,
                  data: { accounts: [{ code: '10301', name: 'cash syp1', balance: -15934 }] },
                },
              }],
            },
          } as any,
        ])),
      };

      const useCase = new SendChatMessageUseCase(
        chatRepoWithHistory,
        settingsRepo,
        encryptionService,
        httpClient as unknown as IHttpClient,
      );

      await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        conversationId: 'conv-existing',
        message: 'اشرح cash syp1',
      });

      const sentMessages = (httpClient.requests[0].body as any).messages;
      const systemPrompt = sentMessages[0].content;

      expect(systemPrompt).not.toContain('RECENT ERP DATA FROM THIS CONVERSATION');
      expect(systemPrompt).not.toContain('10301');
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

  describe('runtimeMode credential resolution', () => {
    let mockProviderRepo: any;

    beforeEach(() => {
      mockProviderRepo = {
        getById: jest.fn(),
        list: jest.fn().mockResolvedValue([]),
        save: jest.fn(),
        delete: jest.fn(),
      };
    });

    const createConfig = (runtimeMode: string, apiKey?: string) => {
      const config = AiProviderConfig.defaultForCompany('company-1');
      config.runtimeMode = runtimeMode as any;
      config.apiKey = apiKey;
      config.provider = 'openai_compatible'; // Non-mock so credential resolution is exercised
      return config;
    };

    it('should reject with clear error when runtimeMode is DISABLED', async () => {
      const config = createConfig('DISABLED');
      settingsRepo = createMockSettingsRepo(config);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toContain('disabled');
      }
    });

    it('should reject with clear error when runtimeMode is BYOK and no apiKey', async () => {
      const config = createConfig('BYOK', undefined);
      settingsRepo = createMockSettingsRepo(config);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toContain('No API key configured');
      }
    });

    it('should allow BYOK when tenant has apiKey', async () => {
      const config = createConfig('BYOK', 'test-key');
      settingsRepo = createMockSettingsRepo(config);

      const httpClient = new SequenceHttpClient([{
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      }]);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, httpClient as any);

      const result = await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
      expect(result).toBeDefined();
    });

    it('should reject CREDITS when no providerRepository is wired (credit system not configured)', async () => {
      const config = createConfig('CREDITS', undefined);
      settingsRepo = createMockSettingsRepo(config);

      // Without providerRepository, CREDITS should fail with "Credit system is not configured"
      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(500);
        expect((error as ApiError).message).toContain('not configured');
      }
    });

    it('should reject CREDITS when provider has no platformRuntimeCredential', async () => {
      const config = createConfig('CREDITS', undefined);
      settingsRepo = createMockSettingsRepo(config);

      // Create a mock credit ledger repo that returns a ledger with credits
      const mockCreditLedgerRepo = {
        getByCompanyId: jest.fn().mockResolvedValue({ balance: 100, hasCredits: () => true }),
        save: jest.fn(),
      };

      mockProviderRepo.list.mockResolvedValue([
        { id: 'openai:openai', type: 'openai_compatible', platformRuntimeCredential: undefined },
      ]);

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, createMockHttpClient(),
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockProviderRepo,
        mockCreditLedgerRepo as any,
      );

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toContain('No platform runtime credential');
      }
    });

    it('should use platform credential when CREDITS and provider has credential', async () => {
      const config = createConfig('CREDITS', undefined);
      settingsRepo = createMockSettingsRepo(config);

      // Create a mock credit ledger repo that returns a ledger with credits
      const mockLedger = { balance: 100, hasCredits: () => true, debit: jest.fn(), companyId: 'company-1' };
      const mockCreditLedgerRepo = {
        getByCompanyId: jest.fn().mockResolvedValue(mockLedger),
        save: jest.fn().mockResolvedValue({}),
      };

      mockProviderRepo.list.mockResolvedValue([
        { id: 'openai:openai', type: 'openai_compatible', platformRuntimeCredential: 'enc:platform-key' },
      ]);

      const httpClient = new SequenceHttpClient([{
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      }]);

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, httpClient as any,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockProviderRepo,
        mockCreditLedgerRepo as any,
      );

      const result = await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
      expect(result).toBeDefined();
      // Verify the provider key was decrypted from platform credential
      expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:platform-key');
      // Verify credit ledger was fetched, debited, and saved after successful response
      expect(mockCreditLedgerRepo.getByCompanyId).toHaveBeenCalledWith('company-1');
      expect(mockLedger.debit).toHaveBeenCalledWith(1, expect.stringContaining('chat_request_'));
      expect(mockCreditLedgerRepo.save).toHaveBeenCalled();
    });

    it('should NOT fall back to platform credential when runtimeMode is BYOK even if provider has credential', async () => {
      const config = createConfig('BYOK', undefined);
      settingsRepo = createMockSettingsRepo(config);
      mockProviderRepo.list.mockResolvedValue([
        { id: 'openai:openai', type: 'openai_compatible', platformRuntimeCredential: 'enc:platform-key' },
      ]);

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, createMockHttpClient(),
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockProviderRepo,
      );

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        // BYOK must reject even when platform credential exists
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toContain('No API key configured');
        // Platform credential should NEVER be checked for BYOK mode
        expect(encryptionService.decrypt).not.toHaveBeenCalled();
      }
    });

    it('should reject CREDITS with 403 BEFORE provider/HTTP call when no ledger exists', async () => {
      const config = createConfig('CREDITS', undefined);
      settingsRepo = createMockSettingsRepo(config);

      // Mock credit ledger repo that returns null (no ledger)
      const mockCreditLedgerRepo = {
        getByCompanyId: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue({}),
      };

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, createMockHttpClient(),
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockProviderRepo,
        mockCreditLedgerRepo as any,
      );

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toContain('No AI credits remaining');
        // Credit check happens before provider call — no debit or save should occur
        expect(mockCreditLedgerRepo.getByCompanyId).toHaveBeenCalledWith('company-1');
        expect(mockCreditLedgerRepo.save).not.toHaveBeenCalled();
      }
    });

    it('should reject CREDITS with 403 BEFORE provider/HTTP call when ledger hasCredits() is false', async () => {
      const config = createConfig('CREDITS', undefined);
      settingsRepo = createMockSettingsRepo(config);

      // Mock credit ledger repo that returns a ledger with zero credits
      const mockCreditLedgerRepo = {
        getByCompanyId: jest.fn().mockResolvedValue({ balance: 0, hasCredits: () => false, debit: jest.fn(), companyId: 'company-1' }),
        save: jest.fn().mockResolvedValue({}),
      };

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, createMockHttpClient(),
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockProviderRepo,
        mockCreditLedgerRepo as any,
      );

      try {
        await useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toContain('No AI credits remaining');
        // Should NOT debit or save — rejection is before provider call
        expect(mockCreditLedgerRepo.getByCompanyId).toHaveBeenCalledWith('company-1');
        expect(mockCreditLedgerRepo.save).not.toHaveBeenCalled();
      }
    });

    it('should NOT debit credits or save ledger when CREDITS provider call fails', async () => {
      const config = createConfig('CREDITS', undefined);
      settingsRepo = createMockSettingsRepo(config);

      const mockLedger = { balance: 100, hasCredits: () => true, debit: jest.fn(), companyId: 'company-1' };
      const mockCreditLedgerRepo = {
        getByCompanyId: jest.fn().mockResolvedValue(mockLedger),
        save: jest.fn().mockResolvedValue({}),
      };

      mockProviderRepo.list.mockResolvedValue([
        { id: 'openai:openai', type: 'openai_compatible', platformRuntimeCredential: 'enc:platform-key' },
      ]);

      // Use an HTTP client that throws to simulate provider call failure
      const failingHttpClient = {
        request: jest.fn().mockRejectedValue(new Error('Provider connection failed')),
      } as unknown as IHttpClient;

      // Also need a rate-limiter-safe config that won't block on rate limits
      const usageLogRepo = {
        create: jest.fn().mockResolvedValue({}),
      };

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, failingHttpClient,
        usageLogRepo as any,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockProviderRepo,
        mockCreditLedgerRepo as any,
      );

      await expect(
        useCase.execute({ companyId: 'company-1', userId: 'user-1', message: 'Hello' }),
      ).rejects.toThrow();

      // Credit check (in resolveRuntimeCredential) happened, but post-response debit should NOT have occurred
      // because the provider call failed, jumping to the catch block before debit logic
      expect(mockLedger.debit).not.toHaveBeenCalled();
      expect(mockCreditLedgerRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('concurrent request deduplication', () => {
    it('should reject with 409 when same company/user/conversation is already being processed', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      // Manually add a lock to simulate an in-progress request
      const lockKey = 'company-1:user-1:conv-dedupe-test';
      (SendChatMessageUseCase as any).activeLocks.add(lockKey);

      try {
        await useCase.execute({
          companyId: 'company-1',
          userId: 'user-1',
          message: 'Hello',
          conversationId: 'conv-dedupe-test',
        });
        fail('Should have thrown');
      } catch (error) {
        expect((error as ApiError).statusCode).toBe(409);
        expect((error as ApiError).message).toContain('already being processed');
      } finally {
        (SendChatMessageUseCase as any).activeLocks.delete(lockKey);
      }
    });

    it('should allow different conversations from the same user while one is locked', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      // Lock conversation A
      (SendChatMessageUseCase as any).activeLocks.add('company-1:user-1:conv-A');

      // Conversation B should still succeed
      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello from conversation B',
        conversationId: 'conv-B',
      });

      expect(result).toBeDefined();
      expect(result.userMessage.conversationId).toBe('conv-B');

      // Cleanup
      (SendChatMessageUseCase as any).activeLocks.delete('company-1:user-1:conv-A');
    });

    it('should release lock after successful execution', async () => {
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(chatRepo, settingsRepo, encryptionService, createMockHttpClient());

      // Execute once — should succeed and release lock
      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
        conversationId: 'conv-lock-release',
      });

      expect(result).toBeDefined();

      // Lock should be released — same conversation should work again
      const result2 = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello again',
        conversationId: 'conv-lock-release',
      });

      expect(result2).toBeDefined();
    });

    it('should release lock after provider error', async () => {
      const config = createOpenAiConfig('gpt-4o');
      settingsRepo = createMockSettingsRepo(config);

      // Use an HTTP client that will cause a provider error after config resolution
      const failingProviderRepo = {
        getById: jest.fn(),
        list: jest.fn().mockResolvedValue([
          { id: 'openai:openai', type: 'openai_compatible', platformRuntimeCredential: 'plain:test-key' },
        ]),
        save: jest.fn(),
        delete: jest.fn(),
      };

      // A mock HTTP client that throws on request to simulate provider failure
      const failingHttpClient = {
        request: jest.fn().mockRejectedValue(new Error('Provider connection failed')),
      } as unknown as IHttpClient;

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, failingHttpClient,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        failingProviderRepo as any,
      );

      // This should throw but release the lock
      const lockKeyBefore = 'company-1:user-1:conv-error-release';
      try {
        await useCase.execute({
          companyId: 'company-1',
          userId: 'user-1',
          message: 'This will fail',
          conversationId: 'conv-error-release',
        });
        fail('Should have thrown');
      } catch (error) {
        // Expected error from provider
        expect(error).toBeDefined();
      }

      // After the error, the lock must be released — a new request for the same conversation should not get 409
      // We can check directly that the lock was removed
      expect((SendChatMessageUseCase as any).activeLocks.has(lockKeyBefore)).toBe(false);
    });
  });

  describe('context window overflow guard', () => {
    /** Helper: creates a mock modelProfileUseCase that returns a profile with the given maxContextTokens. */
    const createMockModelProfileUseCase = (maxContextTokens: number) => ({
      resolveRuntimeProfile: jest.fn().mockResolvedValue({
        provider: 'mock',
        modelName: 'mock-assistant',
        status: 'recommended',
        supportsToolCalling: false,
        supportsStructuredJson: false,
        maxContextTokens,
        recommendedUseCases: ['development', 'testing'],
        warningLevel: 'none',
        textOnlyMode: false,
        warningMessage: '',
      }),
    });

    /** Helper: creates a chat repository that returns messages with specified content length. */
    const createChatRepoWithHistory = (messageCount: number, charsPerMessage: number): IAiChatRepository => {
      const longContent = 'x'.repeat(charsPerMessage);
      const messages: any[] = [];
      for (let i = 0; i < messageCount; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: longContent,
          metadata: {},
          companyId: 'company-1',
          userId: 'user-1',
          conversationId: 'conv-overflow-test',
        });
      }
      return {
        create: jest.fn((msg: any) => Promise.resolve(msg)),
        getById: jest.fn(() => Promise.resolve(null)),
        updateFeedback: jest.fn(() => Promise.resolve(null as any)),
        getConversationMessages: jest.fn(() => Promise.resolve(messages)),
        getRecentConversations: jest.fn(() => Promise.resolve([])),
        deleteConversation: jest.fn(() => Promise.resolve()),
        countToday: jest.fn(() => Promise.resolve(0)),
      };
    };

    it('should add overflow warning and still return a response when context exceeds model limit', async () => {
      // Use a small maxContextTokens so the system prompt alone exceeds 90% threshold.
      const mockModelProfileUseCase = createMockModelProfileUseCase(500);
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const chatRepoWithHistory = createChatRepoWithHistory(4, 900);

      const useCase = new SendChatMessageUseCase(
        chatRepoWithHistory, settingsRepo, encryptionService, createMockHttpClient(),
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockModelProfileUseCase as any,
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Tell me about sales',
        conversationId: 'conv-overflow-test',
      });

      // Response should still succeed
      expect(result).toBeDefined();
      expect(result.assistantMessage).toBeDefined();
      expect(result.assistantMessage.content).toBeDefined();

      // Overflow warning should be present
      expect(result.runtimeMeta).toBeDefined();
      const overflowWarning = result.runtimeMeta!.runtimeWarnings.find(
        w => w.includes("approaching the model's limit"),
      );
      expect(overflowWarning).toBeDefined();
      expect(overflowWarning).toContain('500');
    });

    it('should preserve system prompt and current user message after trimming', async () => {
      // Use a small maxContextTokens to force trimming of history messages.
      const mockModelProfileUseCase = createMockModelProfileUseCase(500);
      const config = createOpenAiConfig('gpt-4o-mini');
      settingsRepo = createMockSettingsRepo(config);

      const httpClient = new SequenceHttpClient([{
        model: 'gpt-4o-mini',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Here is a summary of recent activity.',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 200, completion_tokens: 50, total_tokens: 250 },
      }]);

      const chatRepoWithHistory = createChatRepoWithHistory(4, 900);

      const useCase = new SendChatMessageUseCase(
        chatRepoWithHistory, settingsRepo, encryptionService, httpClient as unknown as IHttpClient,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        mockModelProfileUseCase as any,
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'What is our sales total?',
        conversationId: 'conv-trim-test',
      });

      expect(result).toBeDefined();

      // Inspect the messages sent to the provider
      const sentMessages = (httpClient.requests[0].body as any).messages as Array<{ role: string; content: string }>;
      expect(sentMessages.length).toBeGreaterThan(0);

      // System prompt must be the first message
      expect(sentMessages[0].role).toBe('system');
      expect(sentMessages[0].content.length).toBeGreaterThan(100);

      // Current user message must be the last message
      const lastMessage = sentMessages[sentMessages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toContain('What is our sales total?');

      // History messages should have been trimmed: fewer messages than
      // system(1) + 4_history + user(1) = 6 total
      expect(sentMessages.length).toBeLessThan(6);

      // Overflow warning should be present
      const overflowWarning = result.runtimeMeta!.runtimeWarnings.find(
        w => w.includes("approaching the model's limit"),
      );
      expect(overflowWarning).toBeDefined();
    });

    it('should not add overflow warning for short context within model limits', async () => {
      // Default mock config has maxContextTokens: 4096 (fallback for unknown models).
      // A short message with no history should be well within limits.
      const mockConfig = AiProviderConfig.defaultForCompany('company-1');
      settingsRepo = createMockSettingsRepo(mockConfig);

      const useCase = new SendChatMessageUseCase(
        chatRepo, settingsRepo, encryptionService, createMockHttpClient(),
      );

      const result = await useCase.execute({
        companyId: 'company-1',
        userId: 'user-1',
        message: 'Hello',
      });

      expect(result).toBeDefined();
      expect(result.runtimeMeta).toBeDefined();

      // No overflow warning should be present for a short message
      const overflowWarning = result.runtimeMeta!.runtimeWarnings.find(
        w => w.includes("approaching the model's limit"),
      );
      expect(overflowWarning).toBeUndefined();
    });
  });
});
