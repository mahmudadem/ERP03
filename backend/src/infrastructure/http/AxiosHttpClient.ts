/**
 * AxiosHttpClient - HTTP client implementation using axios
 *
 * Handles all HTTP communication with external AI providers.
 * Maps axios errors to domain-specific error types with safe messages
 * (no API key leaks).
 *
 * Features:
 * - Configurable timeout per request (defaults to 30s; AI providers usually pass a longer timeout)
 * - Safe error messages (strips API keys, tokens from URLs)
 * - Proper header management (Authorization, Content-Type)
 * - Network error classification (unreachable, auth, rate limit, server error)
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IHttpClient, HttpRequestConfig, HttpResponse, HttpStreamRequestConfig, SseParsedChunk } from './IHttpClient';
import { ProviderError, ProviderAuthError, ProviderRateLimitError, ProviderUnavailableError } from '../../errors/ProviderErrors';

export class AxiosHttpClient implements IHttpClient {
  async request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      data: config.body,
      timeout: config.timeoutMs ?? 30000,
      validateStatus: () => true, // Don't throw on any status — we handle errors ourselves
    };

    try {
      const response: AxiosResponse<T> = await axios(axiosConfig);

      // Success status codes
      if (response.status >= 200 && response.status < 300) {
        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
        };
      }

      // Error status codes — classify and throw
      throw this.classifyHttpError(response.status, response.data, config.url);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      // Axios/network errors
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
          throw new ProviderUnavailableError(
            `AI provider request timed out after ${config.timeoutMs ?? 30000}ms. ` +
            `Please check your network connection and provider endpoint.`
          );
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ERR_NETWORK') {
          throw new ProviderUnavailableError(
            `Could not reach AI provider at ${this.sanitizeUrl(config.url)}. ` +
            `Please verify the endpoint URL and network connectivity.`
          );
        }

        // Response received but status already handled above — shouldn't normally reach here
        if (error.response) {
          throw this.classifyHttpError(
            error.response.status,
            error.response.data,
            config.url
          );
        }

        throw new ProviderUnavailableError(
          `Network error communicating with AI provider. Please try again later.`
        );
      }

      // Unknown errors
      throw new ProviderUnavailableError(
        `Unexpected error communicating with AI provider. Please try again later.`
      );
    }
  }

  /**
   * Send an HTTP request and return a streaming SSE response.
   *
   * Uses axios with responseType: 'stream' to receive data incrementally.
   * Parses SSE "data:" lines and yields them as parsed chunks.
   * Handles the "data: [DONE]" terminator for OpenAI-compatible streams.
   */
  async *requestStream(config: HttpStreamRequestConfig): AsyncIterable<SseParsedChunk> {
    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...config.headers,
      },
      data: config.body,
      timeout: config.timeoutMs ?? 120000,
      responseType: 'stream',
      validateStatus: () => true, // We handle status ourselves
    };

    let responseStream: NodeJS.ReadableStream;
    let statusCode: number;

    try {
      const response: AxiosResponse = await axios(axiosConfig);
      statusCode = response.status;

      // Non-2xx status: try to accumulate the stream body for error info
      if (statusCode < 200 || statusCode >= 300) {
        let body = '';
        for await (const chunk of response.data as AsyncIterable<Buffer>) {
          body += chunk.toString();
        }

        let errorMessage: string;
        try {
          const parsed = JSON.parse(body);
          if (typeof parsed.error === 'string') {
            errorMessage = parsed.error;
          } else if (typeof parsed.error === 'object' && parsed.error !== null && typeof (parsed.error as any).message === 'string') {
            errorMessage = (parsed.error as any).message;
          } else if (typeof parsed.message === 'string') {
            errorMessage = parsed.message;
          } else {
            errorMessage = `Provider returned status ${statusCode}`;
          }
        } catch {
          errorMessage = `Provider returned status ${statusCode}`;
        }

        throw this.classifyHttpError(statusCode, { error: errorMessage }, config.url);
      }

      responseStream = response.data;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
          throw new ProviderUnavailableError(
            `AI provider request timed out after ${config.timeoutMs ?? 120000}ms. ` +
            `Please check your network connection and provider endpoint.`
          );
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ERR_NETWORK') {
          throw new ProviderUnavailableError(
            `Could not reach AI provider at ${this.sanitizeUrl(config.url)}. ` +
            `Please verify the endpoint URL and network connectivity.`
          );
        }

        throw new ProviderUnavailableError(
          `Network error communicating with AI provider. Please try again later.`
        );
      }

      throw new ProviderUnavailableError(
        `Unexpected error communicating with AI provider. Please try again later.`
      );
    }

    // Parse the SSE stream
    let buffer = '';

    for await (const chunk of responseStream as AsyncIterable<Buffer>) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and SSE comments
        if (trimmed === '' || trimmed.startsWith(':')) {
          continue;
        }

        // Parse SSE event type
        if (trimmed.startsWith('event:')) {
          // Event type lines are handled implicitly by data lines
          continue;
        }

        // Parse SSE data lines
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();

          if (data === '[DONE]') {
            return; // Stream complete
          }

          yield { data, eventType: undefined };
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data:')) {
        const data = trimmed.slice(5).trim();
        if (data !== '[DONE]' && data.length > 0) {
          yield { data, eventType: undefined };
        }
      }
    }
  }

  private classifyHttpError(status: number, data: unknown, url: string): ProviderError {
    let errorMessage: string;
    if (typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      if (typeof d.error === 'string') {
        errorMessage = d.error;
      } else if (typeof d.error === 'object' && d.error !== null && typeof (d.error as Record<string, unknown>).message === 'string') {
        errorMessage = (d.error as Record<string, unknown>).message as string;
      } else if (typeof d.message === 'string') {
        errorMessage = d.message;
      } else {
        errorMessage = `Provider returned status ${status}`;
      }
    } else {
      errorMessage = `Provider returned status ${status}`;
    }

    switch (status) {
      case 401:
        return new ProviderAuthError(
          'Authentication failed. Please check your API key in AI Assistant settings.'
        );
      case 403:
        return new ProviderAuthError(
          'Access denied. Your API key does not have permission to use this model or endpoint.'
        );
      case 429:
        return new ProviderRateLimitError(
          'AI provider rate limit exceeded. Please wait a moment before trying again.'
        );
      default:
        if (status >= 500) {
          return new ProviderUnavailableError(
            `AI provider server error (${status}). Please try again later.`
          );
        }
        return new ProviderError(
          `AI provider error (${status}): ${errorMessage}`
        );
    }
  }

  /**
   * Sanitize URL for error messages — remove any path segments
   * that might reveal internal structure or contain tokens.
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}`;
    } catch {
      return '[invalid-url]';
    }
  }
}
