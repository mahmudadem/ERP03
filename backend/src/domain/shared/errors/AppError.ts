/**
 * Standardized Application Error Types
 * 
 * Provides consistent error structure across the application,
 * especially for posting failures (core invariants + policies).
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  CORE_INVARIANT = 'CORE_INVARIANT',
  POLICY = 'POLICY',
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTH',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT'
}

/**
 * Individual violation within an error
 */
export interface ErrorViolation {
  /**
   * Machine-readable error code
   */
  code: string;

  /**
   * Human-readable message
   */
  message: string;

  /**
   * Optional hints about which fields caused the error
   * e.g., ["lines[2].costCenterId"]
   */
  fieldHints?: string[];

  /**
   * Policy ID if this is a policy violation
   * e.g., "approval-required", "period-lock"
   */
  policyId?: string;
}

/**
 * Standardized application error structure
 */
export interface AppError {
  /**
   * Primary error code
   */
  code: string;

  /**
   * Primary error message
   */
  message: string;

  /**
   * Error category for classification
   */
  category: ErrorCategory;

  /**
   * Detailed violation information
   */
  details: {
    violations: ErrorViolation[];
  };

  /**
   * Request correlation ID for tracing
   */
  correlationId?: string;
}

/**
 * PostingError
 * 
 * Exception thrown when posting fails due to core invariants or policies.
 * Contains structured error information for API responses.
 */
export class PostingError extends Error {
  constructor(
    public readonly appError: AppError
  ) {
    super(appError.message);
    this.name = 'PostingError';
  }

  /**
   * Convert to API response format
   */
  toJSON() {
    return {
      success: false,
      error: this.appError
    };
  }
}

/**
 * Helper to create a PostingError from a single violation
 */
export function createPostingError(
  code: string,
  message: string,
  category: ErrorCategory,
  fieldHints?: string[],
  policyId?: string,
  correlationId?: string
): PostingError {
  return new PostingError({
    code,
    message,
    category,
    details: {
      violations: [
        {
          code,
          message,
          fieldHints,
          policyId
        }
      ]
    },
    correlationId
  });
}

/**
 * Helper to create an aggregated policy error
 */
export function createAggregatedPolicyError(
  violations: ErrorViolation[],
  correlationId?: string
): PostingError {
  return new PostingError({
    code: 'POLICY_VIOLATIONS',
    message: `${violations.length} policy violation(s) found`,
    category: ErrorCategory.POLICY,
    details: { violations },
    correlationId
  });
}
