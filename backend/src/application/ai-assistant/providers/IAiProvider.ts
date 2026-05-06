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
 * v2 Extension:
 * - Provider-agnostic tool call contracts allow the system to expose
 *   tool definitions to providers and receive structured tool call
 *   requests in responses.
 * - Tools are optional; providers that don't support function/tool calling
 *   simply ignore them and respond with text only.
 * - Tool calls in responses are optional; not all provider responses
 *   will include tool calls.
 *
 * AI Safety Rule:
 * The provider MUST NOT directly mutate business records.
 * AI responses are advisory-only: they may answer, explain,
 * validate, summarize, or suggest drafts — but any real
 * business action must go through existing backend use cases
 * with explicit user approval.
 */

import type {
  AiProviderToolCallRequest,
  AiProviderToolContract,
} from '../../../domain/ai-assistant/tools/AiToolContract';

export type {
  AiProviderToolCallRequest,
  AiProviderToolContract,
  AiToolOperationType,
} from '../../../domain/ai-assistant/tools/AiToolContract';

/**
 * Provider capability metadata.
 * Describes what the provider supports so the system can
 * adapt its behavior accordingly.
 */
export interface AiProviderCapabilities {
  /** Whether the provider supports function/tool calling */
  supportsToolCalling: boolean;
  /** Whether the provider can return structured JSON */
  supportsStructuredOutput: boolean;
  /** Maximum number of tool calls per request (0 = unlimited) */
  maxToolCallsPerRequest: number;
  /** Whether content can be null/empty when tool calls are present */
  allowsEmptyContentWithToolCalls: boolean;
}

/**
 * Provider runtime warning/capability metadata included in responses.
 * This helps the system understand what happened during generation
 * without exposing secrets, API keys, or internal details.
 */
export interface AiProviderRuntimeMeta {
  /** Warnings from the provider (e.g., "tool calling not supported, text-only") */
  warnings?: string[];
  /** Provider capabilities used/detected in this request */
  capabilities?: Partial<AiProviderCapabilities>;
  /** Whether the response was truncated due to token limits */
  truncated?: boolean;
  /** Model used for this response (may differ from requested) */
  modelUsed?: string;
}

// ─── Request / Response Types ───────────────────────────────────────────────

export interface AiProviderResponse {
  content: string | null;
  model: string;
  provider: string;
  tokenCount?: number;
  /** Optional tool calls requested by the AI model */
  toolCalls?: AiProviderToolCallRequest[];
  /** Runtime metadata (warnings, capabilities, etc.) — never includes secrets */
  runtimeMeta?: AiProviderRuntimeMeta;
  metadata?: Record<string, unknown>;
}

export interface AiProviderRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Optional tools to expose to the provider for function/tool calling */
  tools?: AiProviderToolContract[];
  maxTokens?: number;
  temperature?: number;
}

export interface IAiProvider {
  /** Provider identifier: 'mock', 'openai_compatible', 'ollama' */
  readonly providerId: string;

  /** Human-readable name */
  readonly providerName: string;

  /**
   * Get the capabilities of this provider.
   * Used by the system to adapt behavior (e.g., skip tool calling
   * if the provider doesn't support it).
   */
  getCapabilities(): AiProviderCapabilities;

  /**
   * Send a chat request to the AI provider.
   * Returns the provider's response.
   *
   * If request.tools is provided and the provider supports tool calling,
   * the response may include toolCalls with structured function call requests.
   *
   * If the provider does not support tool calling, tools are ignored
   * and the response is text-only (content only).
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
