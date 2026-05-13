/**
 * IHttpClient - HTTP client abstraction for external API calls
 *
 * Clean Architecture boundary: The application layer depends on this interface,
 * not on any specific HTTP library. This keeps transport details
 * in the infrastructure layer where they belong.
 *
 * Primary use: AI provider HTTP calls (OpenAI, Ollama, etc.)
 */

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Configuration for a streaming HTTP request.
 * Used for SSE (Server-Sent Events) connections where data arrives incrementally.
 */
export interface HttpStreamRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Parsed SSE line from a streaming response.
 * OpenAI SSE format sends lines like:
 *   data: {"id":"...","choices":[{"delta":{"content":"..."}}]}
 * terminated by:
 *   data: [DONE]
 */
export interface SseParsedChunk {
  /** The raw data payload (JSON string after "data: " prefix, or "[DONE]") */
  data: string;
  /** Optional event type (from "event:" line, e.g. "message", "error") */
  eventType?: string;
}

export interface IHttpClient {
  /**
   * Send an HTTP request and return the response.
   * @throws ProviderUnavailableError if the server cannot be reached
   * @throws ProviderAuthError if authentication fails (401/403)
   * @throws ProviderRateLimitError if rate limited by the provider (429)
   * @throws ProviderError for all other provider errors
   */
  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;

  /**
   * Send an HTTP request and return a streaming response as an AsyncIterable.
   *
   * Each yielded item is a parsed SSE chunk containing the data field.
   * The implementation handles SSE line parsing and终止 detection.
   *
   * If the server returns a non-streaming response (e.g., error JSON),
   * the implementation should yield the raw response body as a single chunk
   * so the caller can detect and handle errors.
   *
   * @throws ProviderUnavailableError if the server cannot be reached
   * @throws ProviderAuthError if authentication fails (401/403)
   * @throws ProviderRateLimitError if rate limited by the provider (429)
   * @throws ProviderError for all other provider errors
   */
  requestStream?(config: HttpStreamRequestConfig): AsyncIterable<SseParsedChunk>;
}