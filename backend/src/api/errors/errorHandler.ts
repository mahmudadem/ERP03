/**
 * errorHandler.ts
 * Purpose: Catches errors from controllers and formats them as standard JSON.
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from './ApiError';
import { InfrastructureError as InfraError } from '../../infrastructure/errors/InfrastructureError';
import { AppError } from '../../errors/AppError';
import { CreditLimitExceededError } from '../../domain/sales/errors/CreditLimitExceededError';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[API Error] ${(req as any).method} ${(req as any).path}:`, err);

  if (err instanceof ApiError) {
    (res as any).status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Handle credit limit exceeded — return 422 with structured details
  if (err instanceof CreditLimitExceededError) {
    (res as any).status(422).json({
      success: false,
      code: err.code,
      message: err.message,
      details: {
        companyId: err.companyId,
        customerId: err.customerId,
        customerName: err.customerName,
        creditLimit: err.creditLimit,
        currentExposure: err.currentExposure,
        orderAmount: err.orderAmount,
        projectedExposure: err.projectedExposure,
      },
    });
    return;
  }

  // Handle Infrastructure Errors (Database, etc)
  if (err instanceof InfraError) {
    (res as any).status(500).json({
      success: false,
      error: {
        code: 'INFRASTRUCTURE_ERROR',
        message: 'A system error occurred. Please try again later.',
      },
    });
    return;
  }

  // Handle Domain/Business Errors
  if (err instanceof AppError) {
    (res as any).status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        severity: (err as any).severity,
        field: (err as any).field,
        context: (err as any).context
      },
    });
    return;
  }

  // Handle errors with explicit statusCode (e.g., validation conflicts)
  const anyErr = err as any;
  if (anyErr?.statusCode) {
    (res as any).status(anyErr.statusCode).json({
      success: false,
      error: {
        code: anyErr.statusCode === 400 ? 'BAD_REQUEST' : anyErr.statusCode === 409 ? 'CONFLICT' : 'ERROR',
        message: err.message,
      },
    });
    return;
  }

  // Fallback for unhandled errors
  (res as any).status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};
