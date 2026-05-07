"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderRateLimitError = exports.ProviderAuthError = exports.ProviderUnavailableError = exports.ProviderError = void 0;
const AppError_1 = require("./AppError");
const ErrorCodes_1 = require("./ErrorCodes");
/**
 * Base error for all AI provider communication failures.
 * Maps to 502 Bad Gateway by default.
 */
class ProviderError extends AppError_1.AppError {
    constructor(message, code = ErrorCodes_1.ErrorCode.AI_PROVIDER_ERROR) {
        super(code, message, ErrorCodes_1.ErrorSeverity.ERROR);
        this.name = 'ProviderError';
    }
}
exports.ProviderError = ProviderError;
/**
 * Thrown when the AI provider cannot be reached (network errors, timeouts, DNS failures).
 * Maps to 503 Service Unavailable.
 */
class ProviderUnavailableError extends ProviderError {
    constructor(message) {
        super(message, ErrorCodes_1.ErrorCode.AI_PROVIDER_UNAVAILABLE);
        this.name = 'ProviderUnavailableError';
    }
}
exports.ProviderUnavailableError = ProviderUnavailableError;
/**
 * Thrown when authentication with the AI provider fails (401/403).
 * Maps to 401 Unauthorized (presented to user as "check your API key").
 */
class ProviderAuthError extends ProviderError {
    constructor(message) {
        super(message, ErrorCodes_1.ErrorCode.AI_PROVIDER_AUTH_ERROR);
        this.name = 'ProviderAuthError';
    }
}
exports.ProviderAuthError = ProviderAuthError;
/**
 * Thrown when the AI provider rate limits the request (429).
 * Maps to 429 Too Many Requests.
 */
class ProviderRateLimitError extends ProviderError {
    constructor(message) {
        super(message, ErrorCodes_1.ErrorCode.AI_PROVIDER_RATE_LIMIT);
        this.name = 'ProviderRateLimitError';
    }
}
exports.ProviderRateLimitError = ProviderRateLimitError;
//# sourceMappingURL=ProviderErrors.js.map