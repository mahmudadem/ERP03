/**
 * AxiosHttpClient - HTTP client implementation using axios
 *
 * Handles all HTTP communication with external AI providers.
 * Maps axios errors to domain-specific error types with safe messages
 * (no API key leaks).
 *
 * Features:
 * - Configurable timeout per request (defaults to 30s)
 * - Safe error messages (strips API keys, tokens from URLs)
 * - Proper header management (Authorization, Content-Type)
 * - Network error classification (unreachable, auth, rate limit, server error)
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IHttpClient, HttpRequestConfig, HttpResponse } from './IHttpClient';
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