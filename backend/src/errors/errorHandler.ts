import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { ErrorCode, ErrorSeverity, ApiErrorResponse } from './ErrorCodes';

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

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: err.toJSON(),
    };
    
    const statusCode = getStatusCode(err.severity);
    return res.status(statusCode).json(response);
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
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
