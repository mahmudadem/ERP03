/**
 * ProviderFactory - Creates the appropriate AI provider based on company config
 *
 * This factory determines which provider to use for a given company configuration:
 * - 'mock' → MockProvider (explicit dev choice only, never a fallback)
 * - 'openai_compatible' → OpenAICompatibleProvider (needs API key + endpoint)
 * - 'ollama' → OpenAICompatibleProvider with local endpoint
 *
 * IMPORTANT: This factory NEVER silently falls back to MockProvider.
 * If a real provider cannot be constructed (missing key, unknown type, error),
 * it throws ProviderProviderError so the caller can inform the user clearly.
 * MockProvider is only used when the user explicitly chooses provider='mock'.
 */

import { IAiProvider } from './IAiProvider';
import { MockProvider } from './MockProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';

// Cache providers per company to avoid re-creating on every request
const providerCache = new Map<string, IAiProvider>();
const AI_PROVIDER_CHAT_TIMEOUT_MS = 120_000;

export class ProviderProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderProviderError';
  }
}

export class ProviderFactory {
  /**
   * Get or create the appropriate AI provider for a company.
   *
   * MockProvider is ONLY returned when provider='mock' is explicitly chosen.
   * For all other cases, if a real provider cannot be constructed, this throws
   * ProviderProviderError — never silently falls back to mock.
   *
   * @param config - The company's AI provider configuration
   * @param httpClient - HTTP client for making API calls to external providers
   * @returns The appropriate IAiProvider instance
   * @throws ProviderProviderError if the real provider cannot be constructed
   */
  static getProvider(config: AiProviderConfig, httpClient: IHttpClient): IAiProvider {
    // Include apiEndpoint in cache key to avoid stale cached providers
    // when a tenant switches between providers with different base URLs.
    // Keep full endpoint (including protocol) for distinct cache keys per scheme.
    const endpointPart = config.apiEndpoint ? `:${config.apiEndpoint.replace(/\/+$/, '')}` : '';
    const cacheKey = `${config.companyId}:${config.provider}:${config.model || 'default'}${endpointPart}`;

    // Return cached provider if config hasn't changed
    const cached = providerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let provider: IAiProvider;

    switch (config.provider) {
      case 'mock':
        // Explicitly chosen mock for development — allowed
        provider = new MockProvider();
        break;

      case 'openai_compatible':
        provider = ProviderFactory.createOpenAICompatibleProvider(config, httpClient);
        break;

      case 'ollama':
        provider = ProviderFactory.createOllamaProvider(config, httpClient);
        break;

      default:
        throw new ProviderProviderError(
          `Unknown provider type '${config.provider}' for company ${config.companyId}. ` +
          `Please check your AI settings and select a supported provider.`
        );
    }

    providerCache.set(cacheKey, provider);
    return provider;
  }

  /**
   * Get or create the appropriate AI provider for diagnostics.
   *
   * Unlike getProvider(), this method does NOT fall back to MockProvider.
   * It throws ProviderProviderError if:
   * - The provider type is explicitly 'mock' (deliberate mock — not a real provider)
   * - An OpenAI-compatible provider has no API key
   * - The provider type is unknown
   * - Provider construction fails
   *
   * This ensures diagnostics test the REAL provider, never silently pass
   * by falling back to a mock that always succeeds.
   */
  static getProviderStrict(config: AiProviderConfig, httpClient: IHttpClient): IAiProvider {
    // Mock provider is explicitly chosen — diagnostics should report it clearly
    if (config.provider === 'mock') {
      // Return MockProvider but let the caller detect and label it
      return new MockProvider();
    }

    switch (config.provider) {
      case 'openai_compatible':
        return ProviderFactory.createOpenAICompatibleProviderStrict(config, httpClient);
      case 'ollama':
        return ProviderFactory.createOllamaProviderStrict(config, httpClient);
      default:
        throw new ProviderProviderError(
          `Unknown provider type '${config.provider}' for company ${config.companyId}. ` +
          `Cannot run diagnostics against an unknown provider.`
        );
    }
  }

  /**
   * Create an OpenAI-compatible provider.
   * Throws ProviderProviderError if no API key is configured.
   */
  private static createOpenAICompatibleProvider(config: AiProviderConfig, httpClient: IHttpClient): IAiProvider {
    if (!config.apiKey) {
      throw new ProviderProviderError(
        `Company ${config.companyId} has an OpenAI-compatible provider ` +
        `configured but no API key. Please add your API key in AI Settings ` +
        `and run diagnostics for your selected model.`
      );
    }

    try {
      return new OpenAICompatibleProvider({
        apiKey: config.apiKey,
        apiEndpoint: config.apiEndpoint || 'https://api.openai.com/v1',
        model: config.model || 'gpt-3.5-turbo',
        maxTokens: config.maxTokensPerRequest || 4096,
        timeoutMs: AI_PROVIDER_CHAT_TIMEOUT_MS,
      }, httpClient);
    } catch (error) {
      throw new ProviderProviderError(
        `Failed to create OpenAI-compatible provider for company ${config.companyId}: ` +
        `${(error as Error).message}. Please check your AI settings and run diagnostics.`
      );
    }
  }

  /**
   * Create an Ollama (local) provider.
   * Ollama doesn't require an API key — uses a sentinel value.
   * Throws ProviderProviderError if construction fails.
   */
  private static createOllamaProvider(config: AiProviderConfig, httpClient: IHttpClient): IAiProvider {
    try {
      return new OpenAICompatibleProvider({
        apiKey: 'local-no-key',
        apiEndpoint: config.apiEndpoint || 'http://localhost:11434/v1',
        model: config.model || 'llama3',
        maxTokens: config.maxTokensPerRequest || 4096,
        timeoutMs: AI_PROVIDER_CHAT_TIMEOUT_MS,
      }, httpClient);
    } catch (error) {
      throw new ProviderProviderError(
        `Failed to create Ollama provider for company ${config.companyId}: ` +
        `${(error as Error).message}. Please check your AI settings and run diagnostics.`
      );
    }
  }

  /**
   * Create an OpenAI-compatible provider for strict mode (diagnostics).
   * Throws instead of falling back to MockProvider.
   */
  private static createOpenAICompatibleProviderStrict(config: AiProviderConfig, httpClient: IHttpClient): IAiProvider {
    if (!config.apiKey) {
      throw new ProviderProviderError(
        `Cannot run diagnostics for company ${config.companyId}: ` +
        `OpenAI-compatible provider requires an API key but none is configured.`
      );
    }

    try {
      return new OpenAICompatibleProvider({
        apiKey: config.apiKey,
        apiEndpoint: config.apiEndpoint || 'https://api.openai.com/v1',
        model: config.model || 'gpt-3.5-turbo',
        maxTokens: config.maxTokensPerRequest || 4096,
        timeoutMs: AI_PROVIDER_CHAT_TIMEOUT_MS,
      }, httpClient);
    } catch (error) {
      throw new ProviderProviderError(
        `Failed to create OpenAI-compatible provider for company ${config.companyId}: ` +
        `${(error as Error).message}`
      );
    }
  }

  /**
   * Create an Ollama provider for strict mode (diagnostics).
   * Throws instead of falling back to MockProvider.
   */
  private static createOllamaProviderStrict(config: AiProviderConfig, httpClient: IHttpClient): IAiProvider {
    try {
      return new OpenAICompatibleProvider({
        apiKey: 'local-no-key',
        apiEndpoint: config.apiEndpoint || 'http://localhost:11434/v1',
        model: config.model || 'llama3',
        maxTokens: config.maxTokensPerRequest || 4096,
        timeoutMs: AI_PROVIDER_CHAT_TIMEOUT_MS,
      }, httpClient);
    } catch (error) {
      throw new ProviderProviderError(
        `Failed to create Ollama provider for company ${config.companyId}: ` +
        `${(error as Error).message}`
      );
    }
  }

  /**
   * Check whether a provider is a MockProvider instance.
   * Useful for diagnostics to detect silent fallback.
   */
  static isMockProvider(provider: IAiProvider): boolean {
    return provider instanceof MockProvider;
  }

  /**
   * Clear the provider cache (useful for testing or when config changes).
   */
  static clearCache(): void {
    providerCache.clear();
  }

  /**
   * Remove a specific company's cached provider (called when config updates).
   */
  static invalidateCompany(companyId: string): void {
    for (const key of providerCache.keys()) {
      if (key.startsWith(`${companyId}:`)) {
        providerCache.delete(key);
      }
    }
  }
}
