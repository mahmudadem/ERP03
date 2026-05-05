/**
 * Re-export from canonical location.
 * ProviderErrors now live in the errors/ directory alongside other AppError types,
 * so the error handler can catch them via `instanceof AppError`.
 */
export { ProviderError, ProviderUnavailableError, ProviderAuthError, ProviderRateLimitError } from '../../errors/ProviderErrors';