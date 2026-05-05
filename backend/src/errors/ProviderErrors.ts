/**
 * ProviderErrors - AI provider error types
 *
 * These extend AppError so the global error handler properly converts
 * them to HTTP responses with the correct status codes. They never leak
 * API keys or internal URLs — all messages are safe for end users.
 *
 * Hierarchy:
 *   AppError
 *     └── ProviderError (base, status 502)
 *           ├── ProviderUnavailableError (503 — network/DNS/timeout)
 *           ├── ProviderAuthError (401 — invalid key or forbidden)
 *           └── ProviderRateLimitError (429 — provider rate limit hit)
 */

import { AppError } from './AppError';
import { ErrorCode, ErrorSeverity } from './ErrorCodes';

/**
 * Base error for all AI provider communication failures.
 * Maps to 502 Bad Gateway by default.
 */
export class ProviderError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AI_PROVIDER_ERROR,
  ) {
    super(code, message, ErrorSeverity.ERROR);
    this.name = 'ProviderError';
  }
}

/**
 * Thrown when the AI provider cannot be reached (network errors, timeouts, DNS failures).
 * Maps to 503 Service Unavailable.
 */
export class ProviderUnavailableError extends ProviderError {
  constructor(message: string) {
    super(message, ErrorCode.AI_PROVIDER_UNAVAILABLE);
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Thrown when authentication with the AI provider fails (401/403).
 * Maps to 401 Unauthorized (presented to user as "check your API key").
 */
export class ProviderAuthError extends ProviderError {
  constructor(message: string) {
    super(message, ErrorCode.AI_PROVIDER_AUTH_ERROR);
    this.name = 'ProviderAuthError';
  }
}

/**
 * Thrown when the AI provider rate limits the request (429).
 * Maps to 429 Too Many Requests.
 */
export class ProviderRateLimitError extends ProviderError {
  constructor(message: string) {
    super(message, ErrorCode.AI_PROVIDER_RATE_LIMIT);
    this.name = 'ProviderRateLimitError';
  }
}