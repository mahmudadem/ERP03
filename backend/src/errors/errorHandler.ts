import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { ErrorCode, ErrorSeverity, ApiErrorResponse } from './ErrorCodes';
import { ProviderError } from './ProviderErrors';
import { ApiError as HttpApiError } from '../api/errors/ApiError';
import { PeriodLockedError } from '../domain/accounting/errors/PeriodLockedError';
import { PostingError } from '../domain/shared/errors/AppError';
import { CreditLimitExceededError } from '../domain/sales/errors/CreditLimitExceededError';
import { toRejectionContract } from '../domain/shared/errors/RejectionContract';

function isFirestoreTransactionError(err: Error): boolean {
  const msg = err.message || '';
  return (
    msg.includes('all reads to be executed before all writes') ||
    msg.includes('Firestore transactions require') ||
    (err as any).code === 'INVALID_ARGUMENT' ||
    (err as any).code === 'ABORTED'
  );
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Error Handler]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Law 5: every guard rejection carries a uniform { guard, code, message, fieldHints } contract,
  // surfaced consistently on the response so the caller always sees which guard refused and why.
  const rejection = toRejectionContract(err);

  const maybeApiError = err as Error & { statusCode?: number; code?: string };
  if (
    err instanceof HttpApiError ||
    (maybeApiError.name === 'ApiError' && typeof maybeApiError.statusCode === 'number')
  ) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: (maybeApiError.code || ErrorCode.INFRA_UNKNOWN_ERROR) as ErrorCode,
        message: err.message,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date().toISOString(),
      },
    };

    return res.status(maybeApiError.statusCode || 500).json(response);
  }

  if (err instanceof AppError) {
    // Provider errors have specific HTTP status codes that don't follow the
    // severity mapping (e.g., 503 for unavailable, 429 for rate limit).
    // Handle them with their own status mapping.
    if (err instanceof ProviderError) {
      const statusCode = getProviderErrorStatus(err);
      const response: ApiErrorResponse = {
        success: false,
        error: err.toJSON(),
      };
      return res.status(statusCode).json(response);
    }

    const response: ApiErrorResponse = {
      success: false,
      error: err.toJSON(),
    };
    // Attach the uniform guard attribution (Law 5).
    if (rejection) {
      (response.error as any).guard = rejection.guard;
    }

    const statusCode = getStatusCode(err.severity);
    return res.status(statusCode).json(response);
  }

  // Credit limit (Sales guard) → 422 with the uniform contract.
  if (err instanceof CreditLimitExceededError) {
    return res.status(422).json({
      success: false,
      error: {
        guard: rejection?.guard,
        code: err.code,
        message: err.message,
        fieldHints: rejection?.fieldHints,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date().toISOString(),
        details: {
          companyId: err.companyId,
          customerId: err.customerId,
          customerName: err.customerName,
          creditLimit: err.creditLimit,
          currentExposure: err.currentExposure,
          orderAmount: err.orderAmount,
          projectedExposure: err.projectedExposure,
        },
      },
    });
  }

  // Period-locked posting errors → 422
  if (err instanceof PeriodLockedError) {
    const response = {
      success: false,
      error: {
        guard: rejection?.guard,
        code: 'PERIOD_LOCKED',
        message: err.message,
        fieldHints: rejection?.fieldHints,
        severity: ErrorSeverity.ERROR,
        timestamp: new Date().toISOString(),
        tier: err.tier,
        documentDate: err.documentDate,
        lockedThroughDate: err.lockedThroughDate,
      },
    };
    return res.status(422).json(response);
  }

  if (err instanceof PostingError || err.name === 'PostingError') {
    const json = (err as PostingError).toJSON();
    // Attach the uniform guard attribution alongside the structured posting error.
    if (rejection) {
      (json.error as any).guard = rejection.guard;
    }
    return res.status(400).json(json);
  }

  // Detect Firestore transaction read-after-write violations
  if (isFirestoreTransactionError(err)) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INFRA_TRANSACTION_CONFLICT,
        message: process.env.NODE_ENV === 'production'
          ? 'A transaction conflict occurred. Please retry the operation.'
          : err.message,
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date().toISOString(),
      },
    };
    return res.status(409).json(response);
  }

  // Handle unknown errors
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INFRA_UNKNOWN_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      severity: ErrorSeverity.CRITICAL,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(500).json(response);
}

/**
 * Map error severity to HTTP status code
 */
function getStatusCode(severity: ErrorSeverity): number {
  switch (severity) {
    case ErrorSeverity.INFO:
      return 200;
    case ErrorSeverity.WARNING:
      return 400;
    case ErrorSeverity.ERROR:
      return 400;
    case ErrorSeverity.CRITICAL:
      return 500;
    default:
      return 500;
  }
}

/**
 * Map ProviderError subclasses to correct HTTP status codes.
 * These don't follow the generic severity mapping — each type has a specific status.
 */
function getProviderErrorStatus(err: ProviderError): number {
  switch (err.code) {
    case ErrorCode.AI_PROVIDER_UNAVAILABLE:
      return 503;
    case ErrorCode.AI_PROVIDER_AUTH_ERROR:
      return 401;
    case ErrorCode.AI_PROVIDER_RATE_LIMIT:
      return 429;
    case ErrorCode.AI_PROVIDER_ERROR:
    default:
      return 502;
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
