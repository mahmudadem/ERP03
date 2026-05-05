/**
 * OpenAICompatibleProvider - Provider for OpenAI-compatible APIs
 *
 * This provider supports any OpenAI-compatible endpoint:
 * - OpenAI (api.openai.com)
 * - Azure OpenAI
 * - Local LLM servers (Ollama, LM Studio, etc.)
 *
 * It uses the OpenAI Chat Completions API format (POST /v1/chat/completions)
 * and the Models API for availability checks (GET /v1/models).
 *
 * HTTP client is injected via IHttpClient interface for testability.
 *
 * Security:
 * - API keys are NEVER included in error messages, logs, or response metadata
 * - Authorization header is omitted for local providers (Ollama uses 'local-no-key' sentinel)
 * - Error messages are sanitized to prevent information leakage
 */

import { IAiProvider, AiProviderRequest, AiProviderResponse } from './IAiProvider';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { ProviderError } from '../../../errors/ProviderErrors';

export interface OpenAICompatibleConfig {
  apiKey: string;           // Required for OpenAI; for Ollama use 'local-no-key'
  apiEndpoint: string;     // e.g., 'https://api.openai.com/v1' or 'http://localhost:11434/v1'
  model: string;            // e.g., 'gpt-4o', 'gpt-3.5-turbo', 'llama3'
  maxTokens?: number;       // Max tokens per request (default: 4096)
  organization?: string;    // OpenAI org ID (optional)
  timeoutMs?: number;       // Request timeout in milliseconds (default: 30000)
}

/** Shape of the OpenAI Chat Completions API response */
interface OpenAIChatResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** Shape of the OpenAI Models API response (for health checks) */
interface OpenAIModelsResponse {
  data?: Array<{ id: string; object?: string }>;
}

export class OpenAICompatibleProvider implements IAiProvider {
  readonly providerId = 'openai_compatible';
  readonly providerName = 'OpenAI-Compatible Provider';

  private config: OpenAICompatibleConfig;
  private httpClient: IHttpClient;

  constructor(config: OpenAICompatibleConfig, httpClient: IHttpClient) {
    // Validate required fields
    if (!config.apiEndpoint || typeof config.apiEndpoint !== 'string') {
      throw new Error('API endpoint is required for OpenAI-compatible provider');
    }

    if (!config.model || typeof config.model !== 'string') {
      throw new Error('Model name is required for OpenAI-compatible provider');
    }

    // Validate URL format
    try {
      new URL(config.apiEndpoint);
    } catch {
      throw new Error(`Invalid API endpoint URL`);
    }

    // API key is required for non-local providers
    // 'local-no-key' is a sentinel for local providers like Ollama
    if (!config.apiKey) {
      throw new Error('API key is required for OpenAI-compatible provider');
    }

    this.config = {
      maxTokens: config.maxTokens ?? 4096,
      timeoutMs: config.timeoutMs ?? 30000,
      ...config,
    };

    this.httpClient = httpClient;
  }

  async chat(request: AiProviderRequest): Promise<AiProviderResponse> {
    const url = this.buildUrl('/chat/completions');
    const isLocalProvider = this.config.apiKey === 'local-no-key';

    const headers: Record<string, string> = {};
    if (!isLocalProvider) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const requestBody = {
      model: this.config.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? 0.7,
      stream: false,
    };

    let response: OpenAIChatResponse;

    try {
      const httpResponse = await this.httpClient.request<OpenAIChatResponse>({
        url,
        method: 'POST',
        headers,
        body: requestBody,
        timeoutMs: this.config.timeoutMs,
      });
      response = httpResponse.data;
    } catch (error) {
      // Re-throw ProviderErrors as-is (already classified by IHttpClient)
      if (error instanceof ProviderError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new ProviderError(
        `Unexpected error from AI provider. Please try again later.`
      );
    }

    // Validate response structure
    if (!response.choices || response.choices.length === 0) {
      throw new ProviderError(
        `AI provider returned an empty response. Please try again or check your model configuration.`
      );
    }

    const choice = response.choices[0];
    const content = choice.message?.content;

    if (content === null || content === undefined) {
        // Allow empty string — some models return '' for no-op answers
        throw new ProviderError(
          `AI provider returned an invalid response format. Model: ${this.config.model}.`
        );
      }

    return {
      content,
      model: response.model || this.config.model,
      provider: 'openai_compatible',
      tokenCount: response.usage?.total_tokens,
      metadata: {
        providerId: 'openai_compatible',
        model: response.model || this.config.model,
        finishReason: choice.finish_reason,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        // NOTE: apiKey is NEVER included in metadata
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    const url = this.buildUrl('/models');
    const isLocalProvider = this.config.apiKey === 'local-no-key';

    const headers: Record<string, string> = {};
    if (!isLocalProvider) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await this.httpClient.request<OpenAIModelsResponse>({
        url,
        method: 'GET',
        headers,
        timeoutMs: 5000, // Short timeout for health checks
      });

      // If we got a successful response, the provider is available
      return response.status >= 200 && response.status < 300;
    } catch {
      // If the models endpoint fails, the provider might still be available
      // (some providers don't implement it). Fall back to config check.
      return !!(this.config.apiKey && this.config.apiEndpoint && this.config.model);
    }
  }

  /** Update configuration (e.g., when company changes their BYOK settings) */
  updateConfig(config: Partial<OpenAICompatibleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Build the full URL from the base endpoint and path.
   * Ensures no double slashes.
   */
  private buildUrl(path: string): string {
    const base = this.config.apiEndpoint.replace(/\/+$/, '');
    return `${base}${path}`;
  }
}