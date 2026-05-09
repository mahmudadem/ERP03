/**
 * OpenAICompatibleProvider Tests
 *
 * Verifies that:
 * 1. Constructor validates required config fields (apiKey, apiEndpoint, model)
 * 2. Constructor validates URL format
 * 3. chat() makes proper HTTP calls and maps responses
 * 4. chat() handles all error types (auth, rate limit, network, server)
 * 5. isAvailable() checks provider health
 * 6. updateConfig() works
 * 7. No apiKey leaks in responses, errors, or metadata
 * 8. Ollama/local provider skips Authorization header
 */

import { OpenAICompatibleProvider } from '../../../application/ai-assistant/providers/OpenAICompatibleProvider';
import { IHttpClient, HttpRequestConfig, HttpResponse } from '../../../infrastructure/http/IHttpClient';
import {
  ProviderError,
  ProviderUnavailableError,
  ProviderAuthError,
  ProviderRateLimitError,
} from '../../../errors/ProviderErrors';

/**
 * Mock HTTP client for testing.
 * Allows controlling responses and verifying request parameters.
 */
class MockHttpClient implements IHttpClient {
  private mockResponse: HttpResponse<any> = {
    data: {},
    status: 200,
    headers: {},
  };
  private mockError: Error | null = null;
  private lastRequest: HttpRequestConfig | null = null;
  private requestCount = 0;

  async request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    this.lastRequest = config;
    this.requestCount++;

    if (this.mockError) {
      throw this.mockError;
    }

    return this.mockResponse as HttpResponse<T>;
  }

  /** Set the mock response */
  setResponse<T>(data: T, status = 200, headers: Record<string, string> = {}): void {
    this.mockResponse = { data, status, headers };
    this.mockError = null;
  }

  /** Set the mock error to throw */
  setError(error: Error): void {
    this.mockError = error;
    this.mockResponse = { data: {}, status: 500, headers: {} };
  }

  /** Get the last request config that was sent */
  getLastRequest(): HttpRequestConfig | null {
    return this.lastRequest;
  }

  /** Get the number of requests made */
  getRequestCount(): number {
    return this.requestCount;
  }

  /** Reset all mock state */
  reset(): void {
    this.mockResponse = { data: {}, status: 200, headers: {} };
    this.mockError = null;
    this.lastRequest = null;
    this.requestCount = 0;
  }
}

// Helper: Create a standard OpenAI chat response
function createChatResponse(content: string, model = 'gpt-4o', totalTokens = 150): any {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: totalTokens - 50,
      total_tokens: totalTokens,
    },
  };
}

describe('OpenAICompatibleProvider', () => {
  const validConfig = {
    apiKey: 'sk-test-api-key-12345',
    apiEndpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    maxTokens: 4096,
  };
  let mockHttp: MockHttpClient;

  beforeEach(() => {
    mockHttp = new MockHttpClient();
  });

  describe('Constructor validation', () => {
    it('should create provider with valid config and HTTP client', () => {
      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      expect(provider.providerId).toBe('openai_compatible');
      expect(provider.providerName).toBe('OpenAI-Compatible Provider');
    });

    it('should throw Error when apiKey is missing', () => {
      expect(() => new OpenAICompatibleProvider({
        ...validConfig,
        apiKey: '',
      }, mockHttp)).toThrow('API key is required');
    });

    it('should throw Error when apiEndpoint is missing', () => {
      expect(() => new OpenAICompatibleProvider({
        ...validConfig,
        apiEndpoint: '',
      }, mockHttp)).toThrow('API endpoint is required');
    });

    it('should throw Error when model is missing', () => {
      expect(() => new OpenAICompatibleProvider({
        ...validConfig,
        model: '',
      }, mockHttp)).toThrow('Model name is required');
    });

    it('should throw Error when apiEndpoint is invalid URL', () => {
      expect(() => new OpenAICompatibleProvider({
        ...validConfig,
        apiEndpoint: 'not-a-valid-url',
      }, mockHttp)).toThrow('Invalid API endpoint URL');
    });

    it('should accept valid Ollama endpoint', () => {
      const provider = new OpenAICompatibleProvider({
        apiKey: 'local-no-key',
        apiEndpoint: 'http://localhost:11434/v1',
        model: 'llama3',
      }, mockHttp);

      expect(provider.providerId).toBe('openai_compatible');
    });

    it('should accept custom base URL', () => {
      const provider = new OpenAICompatibleProvider({
        ...validConfig,
        apiEndpoint: 'https://custom-api.example.com/v1',
      }, mockHttp);

      expect(provider.providerId).toBe('openai_compatible');
    });

    it('should NOT leak apiKey in validation error messages', () => {
      try {
        new OpenAICompatibleProvider({
          apiKey: 'sk-super-secret-key',
          apiEndpoint: 'not-a-url',
          model: 'gpt-4o',
        }, mockHttp);
        fail('Should have thrown');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain('sk-super-secret-key');
      }
    });
  });

  describe('chat()', () => {
    it('should make POST request to /chat/completions and return mapped response', async () => {
      const chatResponse = createChatResponse('Hello! How can I help you today?');
      mockHttp.setResponse(chatResponse);

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      // Verify response mapping
      expect(response.content).toBe('Hello! How can I help you today?');
      expect(response.model).toBe('gpt-4o');
      expect(response.provider).toBe('openai_compatible');
      expect(response.tokenCount).toBe(150);

      // Verify HTTP request structure
      const req = mockHttp.getLastRequest()!;
      expect(req.method).toBe('POST');
      expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
      expect(req.headers!['Authorization']).toBe('Bearer sk-test-api-key-12345');
      // Note: Content-Type is added by AxiosHttpClient, not by the provider
    });

    it('should append /chat/completions to endpoint URL', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider({
        ...validConfig,
        apiEndpoint: 'https://api.openai.com/v1/',
      }, mockHttp);

      await provider.chat({ messages: [{ role: 'user', content: 'test' }] });

      // Trailing slash should be handled
      const req = mockHttp.getLastRequest()!;
      expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should send messages in correct OpenAI format', async () => {
      mockHttp.setResponse(createChatResponse('response'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      await provider.chat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
        maxTokens: 2048,
        temperature: 0.5,
      });

      const req = mockHttp.getLastRequest()!;
      const body = req.body as any;
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ]);
      expect(body.max_tokens).toBe(2048);
      expect(body.temperature).toBe(0.5);
      expect(body.stream).toBe(false);
    });

    it('should include usage metadata in response', async () => {
      const chatResponse = createChatResponse('test');
      mockHttp.setResponse(chatResponse);

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(response.metadata).toBeDefined();
      expect(response.metadata!.usage).toBeDefined();
      expect((response.metadata!.usage as any).totalTokens).toBe(150);
      expect(response.metadata!.finishReason).toBe('stop');
      // apiKey must NEVER appear in metadata
      expect(JSON.stringify(response.metadata)).not.toContain(validConfig.apiKey);
    });

    it('should send provider tool contracts and parse structured tool calls', async () => {
      mockHttp.setResponse({
        id: 'chatcmpl-tool-call',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call-123',
              type: 'function',
              function: {
                name: 'accounting_getTrialBalanceSummary',
                arguments: '{"asOfDate":"2026-05-06"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
      });

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Show trial balance' }],
        tools: [{
          name: 'accounting_getTrialBalanceSummary',
          originalName: 'accounting.getTrialBalanceSummary',
          description: 'Get trial balance summary',
          whenToUse: 'Use for trial balance report questions',
          operationType: 'READ',
          moduleId: 'accounting',
          requiredPermissions: ['accounting.reports.trialBalance.view'],
          inputSchema: { type: 'object', properties: { asOfDate: { type: 'string' } } },
          parameters: { type: 'object', properties: { asOfDate: { type: 'string' } } },
          outputSchema: { type: 'object' },
          examples: ['Show trial balance'],
          safetyNotes: ['Read-only tool. No data is modified.'],
          safeForAutoInvoke: true,
        }],
      });

      const req = mockHttp.getLastRequest()!;
      const body = req.body as any;
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0].function.name).toBe('accounting_getTrialBalanceSummary');
      expect(response.content).toBeNull();
      expect(response.toolCalls).toEqual([{ id: 'call-123', name: 'accounting_getTrialBalanceSummary', arguments: { asOfDate: '2026-05-06' } }]);
      expect(JSON.stringify(response)).not.toContain(validConfig.apiKey);
    });

    it('should NOT include Authorization header for Ollama (local-no-key)', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider({
        apiKey: 'local-no-key',
        apiEndpoint: 'http://localhost:11434/v1',
        model: 'llama3',
      }, mockHttp);

      await provider.chat({ messages: [{ role: 'user', content: 'test' }] });

      const req = mockHttp.getLastRequest()!;
      expect(req.headers!['Authorization']).toBeUndefined();
      expect(req.url).toBe('http://localhost:11434/v1/chat/completions');
    });

    it('should include OpenAI-Organization header when configured', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider({
        ...validConfig,
        organization: 'org-test-123',
      }, mockHttp);

      await provider.chat({ messages: [{ role: 'user', content: 'test' }] });

      const req = mockHttp.getLastRequest()!;
      expect(req.headers!['OpenAI-Organization']).toBe('org-test-123');
    });

    it('should NOT leak apiKey in response content', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(JSON.stringify(response)).not.toContain(validConfig.apiKey);
    });

    it('should NOT leak apiKey in response metadata', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      });

      if (response.metadata) {
        expect(JSON.stringify(response.metadata)).not.toContain(validConfig.apiKey);
      }
    });

    it('should throw ProviderAuthError on 401 response', async () => {
      mockHttp.setError(new ProviderAuthError('Authentication failed'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      await expect(provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow(ProviderAuthError);
    });

    it('should throw ProviderRateLimitError on 429 response', async () => {
      mockHttp.setError(new ProviderRateLimitError('Rate limit exceeded'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      await expect(provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow(ProviderRateLimitError);
    });

    it('should throw ProviderUnavailableError on network errors', async () => {
      mockHttp.setError(new ProviderUnavailableError('Could not reach provider'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      await expect(provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow(ProviderUnavailableError);
    });

    it('should throw ProviderError on empty response choices', async () => {
      mockHttp.setResponse({
        id: 'chatcmpl-test',
        model: 'gpt-4o',
        choices: [],
        usage: { total_tokens: 0 },
      });

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      await expect(provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      })).rejects.toThrow('empty response');
    });

    it('should use config timeout when making requests', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider({
        ...validConfig,
        timeoutMs: 60000,
      }, mockHttp);

      await provider.chat({ messages: [{ role: 'user', content: 'test' }] });

      const req = mockHttp.getLastRequest()!;
      expect(req.timeoutMs).toBe(60000);
    });

    it('should default chat timeout to 120000ms when not configured', async () => {
      mockHttp.setResponse(createChatResponse('test'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      await provider.chat({ messages: [{ role: 'user', content: 'test' }] });

      const req = mockHttp.getLastRequest()!;
      expect(req.timeoutMs).toBe(120000);
    });

    it('should use fallback model name when response model is missing', async () => {
      mockHttp.setResponse({
        id: 'chatcmpl-test',
        model: '',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop',
        }],
        usage: { total_tokens: 10 },
      });

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(response.model).toBe('gpt-4o'); // Falls back to config model
    });
  });

  describe('isAvailable()', () => {
    it('should return true when provider /models endpoint responds successfully', async () => {
      mockHttp.setResponse({
        data: [{ id: 'gpt-4o', object: 'model' }],
        object: 'list',
      });

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const available = await provider.isAvailable();

      expect(available).toBe(true);

      // Verify it called the models endpoint
      const req = mockHttp.getLastRequest()!;
      expect(req.url).toBe('https://api.openai.com/v1/models');
      expect(req.method).toBe('GET');
    });

    it('should fall back to config check when /models fails', async () => {
      mockHttp.setError(new ProviderUnavailableError('Service unavailable'));

      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);
      const available = await provider.isAvailable();

      // Config is valid, so fallback returns true
      expect(available).toBe(true);
    });

    it('should skip Authorization header for Ollama in health check', async () => {
      mockHttp.setResponse({ data: [{ id: 'llama3' }] });

      const provider = new OpenAICompatibleProvider({
        apiKey: 'local-no-key',
        apiEndpoint: 'http://localhost:11434/v1',
        model: 'llama3',
      }, mockHttp);

      await provider.isAvailable();

      const req = mockHttp.getLastRequest()!;
      expect(req.headers!['Authorization']).toBeUndefined();
      expect(req.url).toBe('http://localhost:11434/v1/models');
    });

    it('should use short timeout for health checks', async () => {
      mockHttp.setResponse({ data: [{ id: 'gpt-4o' }] });

      const provider = new OpenAICompatibleProvider({
        ...validConfig,
        timeoutMs: 60000,
      }, mockHttp);

      await provider.isAvailable();

      const req = mockHttp.getLastRequest()!;
      expect(req.timeoutMs).toBe(5000); // Health check uses short timeout
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration fields', () => {
      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      provider.updateConfig({ model: 'gpt-3.5-turbo', maxTokens: 2048 });

      // Provider should exist and be functional after update
      expect(provider.providerId).toBe('openai_compatible');
    });

    it('should allow updating API key', () => {
      const provider = new OpenAICompatibleProvider(validConfig, mockHttp);

      // Should not throw
      provider.updateConfig({ apiKey: 'sk-new-key' });

      expect(provider.providerId).toBe('openai_compatible');
    });
  });
});
