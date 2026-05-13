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
 * v2 Extension:
 * - Maps provider-agnostic tool contracts (AiProviderToolContract) to
 *   OpenAI's `tools` parameter format for function/tool calling.
 * - Parses OpenAI `message.tool_calls` responses into provider-agnostic
 *   `AiProviderToolCallRequest` objects.
 * - Handles the case where content is null/empty when tool calls are present.
 * - Never exposes API keys, endpoints, or secrets in responses or metadata.
 *
 * HTTP client is injected via IHttpClient interface for testability.
 *
 * Security:
 * - API keys are NEVER included in error messages, logs, or response metadata
 * - Authorization header is omitted for local providers (Ollama uses 'local-no-key' sentinel)
 * - Error messages are sanitized to prevent information leakage
 */

import {
  IAiProvider,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderToolContract,
  AiProviderToolCallRequest,
  AiProviderCapabilities,
  AiProviderRuntimeMeta,
  AiStreamEvent,
} from './IAiProvider';
import { IHttpClient } from '../../../infrastructure/http/IHttpClient';
import { ProviderError } from '../../../errors/ProviderErrors';

export interface OpenAICompatibleConfig {
  apiKey: string;           // Required for OpenAI; for Ollama use 'local-no-key'
  apiEndpoint: string;     // e.g., 'https://api.openai.com/v1' or 'http://localhost:11434/v1'
  model: string;            // e.g., 'gpt-4o', 'gpt-3.5-turbo', 'llama3'
  maxTokens?: number;       // Max tokens per request (default: 4096)
  organization?: string;    // OpenAI org ID (optional)
  timeoutMs?: number;       // Request timeout in milliseconds (default: 120000)
}

/** Shape of an OpenAI function/tool definition in the request */
interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Shape of an OpenAI tool call in the response */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
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
      content: string | null;
      tool_calls?: OpenAIToolCall[];
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

  private static readonly DEFAULT_CHAT_TIMEOUT_MS = 120_000;

  private static readonly SUPPORTED_CAPABILITIES: AiProviderCapabilities = {
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    maxToolCallsPerRequest: 0, // unlimited
    allowsEmptyContentWithToolCalls: true,
  };

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
      timeoutMs: config.timeoutMs ?? OpenAICompatibleProvider.DEFAULT_CHAT_TIMEOUT_MS,
      ...config,
    };

    this.httpClient = httpClient;
  }

  getCapabilities(): AiProviderCapabilities {
    return { ...OpenAICompatibleProvider.SUPPORTED_CAPABILITIES };
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

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? 0.7,
      stream: false,
    };

    // Map provider-agnostic tool contracts to OpenAI tools format
    if (request.tools && request.tools.length > 0) {
      requestBody.tools = this.mapToolsToOpenAIFormat(request.tools);
    }

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
      // Wrap unexpected errors — NEVER include API keys or endpoint URLs
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
    const message = choice.message;

    // Parse tool calls from OpenAI response format
    const toolCalls = this.parseToolCallsFromResponse(message?.tool_calls);

    // Content may be null/empty when tool calls are present — allow this safely
    const content = message?.content ?? null;

    // If both content and tool calls are absent, this is invalid
    if (content === null && (!toolCalls || toolCalls.length === 0)) {
      throw new ProviderError(
        `AI provider returned an invalid response format. Model: ${this.config.model}.`
      );
    }

    // Build runtime metadata (no secrets or API keys)
    const runtimeMeta: AiProviderRuntimeMeta = {
      modelUsed: response.model || this.config.model,
      capabilities: {
        supportsToolCalling: true,
        allowsEmptyContentWithToolCalls: true,
      },
    };

    if (toolCalls && toolCalls.length > 0) {
      runtimeMeta.warnings = [];
    }

    if (choice.finish_reason === 'length') {
      runtimeMeta.truncated = true;
    }

    return {
      content,
      model: response.model || this.config.model,
      provider: 'openai_compatible',
      tokenCount: response.usage?.total_tokens,
      toolCalls,
      runtimeMeta,
      metadata: {
        providerId: 'openai_compatible',
        model: response.model || this.config.model,
        finishReason: choice.finish_reason,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        // NOTE: apiKey, apiEndpoint NEVER included in metadata
      },
    };
  }

  /**
   * Stream a chat request using the OpenAI streaming API.
   * Yields events as they arrive from the provider.
   *
   * Uses the IHttpClient.requestStream() method which handles SSE parsing.
   * Token deltas are yielded immediately.
   * Tool calls are accumulated across chunks and yielded as complete
   * tool_call events once all argument fragments have arrived.
   * A 'done' event with usage metadata is yielded at the end.
   *
   * If requestStream is not available on the HTTP client, falls back to
   * calling chat() and yielding the full response as a single token.
   */
  async *chatStream(request: AiProviderRequest): AsyncGenerator<AiStreamEvent> {
    // Check if the HTTP client supports streaming
    if (!this.httpClient.requestStream) {
      // Fallback: call chat() and yield the full response as a single token
      let response: AiProviderResponse;
      try {
        response = await this.chat(request);
      } catch (error) {
        yield {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to get AI response.',
        };
        return;
      }

      if (response.content) {
        yield { type: 'token', content: response.content };
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          yield {
            type: 'tool_call',
            toolName: tc.name,
            toolCallId: tc.id,
            toolArgs: tc.arguments,
          };
        }
      }

      yield {
        type: 'done',
        metadata: {
          provider: response.provider || 'openai_compatible',
          model: response.model || this.config.model,
          usage: response.metadata?.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
        },
      };
      return;
    }

    // Streaming path
    const url = this.buildUrl('/chat/completions');
    const isLocalProvider = this.config.apiKey === 'local-no-key';

    const headers: Record<string, string> = {};
    if (!isLocalProvider) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    // Map provider-agnostic tool contracts to OpenAI tools format
    if (request.tools && request.tools.length > 0) {
      requestBody.tools = this.mapToolsToOpenAIFormat(request.tools);
    }

    // Track state across chunks
    const toolCallAccumulators = new Map<number, { id: string; name: string; argumentsChunks: string[] }>();
    let responseModel = this.config.model;
    let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

    try {
      const stream = this.httpClient.requestStream({
        url,
        method: 'POST',
        headers,
        body: requestBody,
        timeoutMs: this.config.timeoutMs ?? OpenAICompatibleProvider.DEFAULT_CHAT_TIMEOUT_MS,
      });

      for await (const chunk of stream) {
        // Each chunk is a parsed SSE data field (JSON string or "[DONE]")
        if (chunk.data === '[DONE]') {
          break;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(chunk.data);
        } catch {
          // Skip unparseable chunks (keep-alive, comments, etc.)
          continue;
        }

        if (parsed.model) {
          responseModel = parsed.model;
        }

        // Usage may appear in the final chunk or a dedicated usage chunk
        if (parsed.usage) {
          usageData = parsed.usage;
        }

        const choices = parsed.choices;
        if (!choices || choices.length === 0) continue;

        const delta = choices[0].delta;

        // Handle tool call deltas — accumulate arguments across chunks
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx: number = tc.index ?? 0;
            if (!toolCallAccumulators.has(idx)) {
              toolCallAccumulators.set(idx, {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                argumentsChunks: [],
              });
            }
            const acc = toolCallAccumulators.get(idx)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.argumentsChunks.push(tc.function.arguments);
          }
        }

        // Yield content token deltas immediately
        if (delta?.content) {
          yield { type: 'token', content: delta.content };
        }
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        yield { type: 'error', message: error.message };
        return;
      }
      yield { type: 'error', message: 'Unexpected error from AI provider. Please try again later.' };
      return;
    }

    // Yield accumulated tool calls now that all chunks have arrived
    for (const [idx, acc] of toolCallAccumulators) {
      const rawArgs = acc.argumentsChunks.join('');
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(rawArgs);
      } catch {
        console.warn(
          `[AI Assistant Stream] Failed to parse tool call arguments for '${acc.name}'. Arguments omitted.`
        );
      }

      yield {
        type: 'tool_call',
        toolName: acc.name,
        toolCallId: acc.id,
        toolArgs: parsedArgs,
      };
    }

    // Yield done event with metadata
    yield {
      type: 'done',
      metadata: {
        provider: 'openai_compatible',
        model: responseModel,
        usage: usageData
          ? {
              promptTokens: usageData.prompt_tokens,
              completionTokens: usageData.completion_tokens,
              totalTokens: usageData.total_tokens,
            }
          : undefined,
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
   * Map provider-agnostic tool contracts to OpenAI function/tool calling format.
   *
   * OpenAI format:
   * {
   *   type: 'function',
   *   function: {
   *     name: string,
   *     description: string,
   *     parameters: { ... JSON Schema ... }
   *   }
   * }
   *
   * Note: We include moduleId in the description prefix so the model
   * can make better routing decisions, but we never include
   * requiredPermissions or internal implementation details.
   */
  private mapToolsToOpenAIFormat(tools: AiProviderToolContract[]): OpenAIToolDefinition[] {
    return tools.map(tool => {
      // Prefix description with operation type context for better model routing
      const enrichedDescription = this.buildToolDescription(tool);

      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: enrichedDescription,
          parameters: tool.parameters,
        },
      };
    });
  }

  /**
   * Build an enriched tool description that includes safety context
   * without exposing internal implementation details.
   */
  private buildToolDescription(tool: AiProviderToolContract): string {
    const parts: string[] = [];

    // Module context
    parts.push(`[${tool.moduleId}]`);

    // Operation type context — helps the model understand what this tool does
    if (tool.operationType === 'READ') {
      parts.push('Read-only data retrieval.');
    } else if (tool.operationType === 'PROPOSAL') {
      parts.push('Creates a reviewable proposal. No data is changed.');
    } else if (tool.operationType === 'DRAFT') {
      parts.push('Creates a draft for human review. No data is changed.');
    } else {
      // CREATE/UPDATE/DELETE/POST/APPROVE — these should never be exposed
      // to AI in production, but if they are, clearly mark them as blocked.
      parts.push('BLOCKED: This operation requires human approval and cannot be performed by AI.');
    }

    parts.push(tool.description);

    // Required permissions hint (without exposing internal permission strings)
    if (tool.requiredPermissions.length > 0) {
      parts.push(`Requires ${tool.requiredPermissions.length} permission(s).`);
    }

    return parts.join(' ');
  }

  /**
   * Parse OpenAI tool calls from the response into provider-agnostic format.
   *
   * OpenAI returns tool_calls as:
   * [
   *   {
   *     id: 'call_abc123',
   *     type: 'function',
   *     function: {
   *       name: 'function_name',
   *       arguments: '{"arg1": "value1"}' // JSON string
   *     }
   *   }
   * ]
   *
   * We parse the arguments JSON string into a proper object.
   * If parsing fails, we skip the tool call and log a warning.
   */
  private parseToolCallsFromResponse(toolCalls?: OpenAIToolCall[]): AiProviderToolCallRequest[] | undefined {
    if (!toolCalls || toolCalls.length === 0) {
      return undefined;
    }

    const parsed: AiProviderToolCallRequest[] = [];

    for (const tc of toolCalls) {
      try {
        const args = JSON.parse(tc.function.arguments);
        parsed.push({
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        });
      } catch {
        // If arguments can't be parsed, include with empty object
        // rather than dropping the tool call entirely
        console.warn(
          `[AI Assistant] Failed to parse tool call arguments for '${tc.function.name}'. Arguments omitted from logs for safety.`
        );
        parsed.push({
          id: tc.id,
          name: tc.function.name,
          arguments: {},
        });
      }
    }

    return parsed.length > 0 ? parsed : undefined;
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
