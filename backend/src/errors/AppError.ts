import { ErrorCode, ErrorSeverity } from './ErrorCodes';

/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public severity: ErrorSeverity = ErrorSeverity.ERROR,
    public field?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      field: this.field,
      context: this.context,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string, context?: Record<string, any>) {
    super(
      ErrorCode.VAL_REQUIRED_FIELD,
      message,
      ErrorSeverity.WARNING,
      field,
      context
    );
    this.name = 'ValidationError';
  }
}

/**
 * Business Logic Error
 */
export class BusinessError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, any>
  ) {
    super(code, message, ErrorSeverity.ERROR, undefined, context);
    this.name = 'BusinessError';
  }
}

/**
 * Authentication Error
 */
export class AuthError extends AppError {
  constructor(code: ErrorCode, message: string, context?: Record<string, any>) {
    super(code, message, ErrorSeverity.ERROR, undefined, context);
    this.name = 'AuthError';
  }
}

/**
 * Infrastructure Error
 */
export class InfrastructureError extends AppError {
  constructor(message: string, originalError?: any) {
    super(
      ErrorCode.INFRA_DATABASE_ERROR,
      message,
      ErrorSeverity.CRITICAL,
      undefined,
      { originalError: originalError?.message }
    );
    this.name = 'InfrastructureError';
  }
}
