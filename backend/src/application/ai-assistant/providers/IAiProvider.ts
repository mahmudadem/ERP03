/**
 * IAiProvider - Provider Abstraction Interface
 *
 * Clean Architecture boundary: No provider-specific code in controllers or use cases.
 * All AI provider communication goes through this interface.
 *
 * The provider layer is designed to support future strategies:
 * - Mock provider for development
 * - OpenAI-compatible external providers
 * - Local providers (Ollama, etc.)
 * - System-level provider keys
 * - BYOK (Bring Your Own Key) per company
 * - Local endpoint mode
 *
 * AI Safety Rule:
 * The provider MUST NOT directly mutate business records.
 * AI responses are advisory-only: they may answer, explain,
 * validate, summarize, or suggest drafts — but any real
 * business action must go through existing backend use cases
 * with explicit user approval.
 */

export interface AiProviderResponse {
  content: string;
  model: string;
  provider: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface AiProviderRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
}

export interface IAiProvider {
  /** Provider identifier: 'mock', 'openai_compatible', 'ollama' */
  readonly providerId: string;

  /** Human-readable name */
  readonly providerName: string;

  /**
   * Send a chat request to the AI provider.
   * Returns the provider's response.
   *
   * @throws Error if the provider is unavailable or the request fails.
   */
  chat(request: AiProviderRequest): Promise<AiProviderResponse>;

  /**
   * Check if this provider is available and properly configured.
   * Used for health checks and settings validation.
   */
  isAvailable(): Promise<boolean>;
}