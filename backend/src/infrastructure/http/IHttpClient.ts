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

export interface IHttpClient {
  /**
   * Send an HTTP request and return the response.
   * @throws ProviderUnavailableError if the server cannot be reached
   * @throws ProviderAuthError if authentication fails (401/403)
   * @throws ProviderRateLimitError if rate limited by the provider (429)
   * @throws ProviderError for all other provider errors
   */
  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
}