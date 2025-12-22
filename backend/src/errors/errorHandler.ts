import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { ErrorCode, ErrorSeverity, ApiErrorResponse } from './ErrorCodes';

/**
 * Global Error Handler Middleware
 * 
 * Catches all errors and formats them into consistent API responses
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error for debugging
  console.error('[Error Handler]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Check if it's our custom AppError
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: err.toJSON(),
    };
    
    const statusCode = getStatusCode(err.severity);
    return res.status(statusCode).json(response);
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
