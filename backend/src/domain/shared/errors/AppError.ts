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
 * The guards that can refuse a transaction (Law 5: every guard signs its refusal). A rejection is
 * always attributable to exactly one owning guard. See docs/architecture/posting-authority.md.
 */
export type GuardName = 'accounting' | 'sales' | 'purchases' | 'inventory' | 'system';

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
   * The guard that refused (Law 5). Optional for backward compatibility; `toRejectionContract`
   * infers a sensible default when absent.
   */
  guard?: GuardName;

  /**
   * Detailed violation information
   */
  details: {
    violations: ErrorViolation[];
  };

  /**
   * Optional structured, human-readable context for the frontend to interpolate
   * into a translated message (e.g. readable item/warehouse labels and quantities).
   */
  context?: Record<string, unknown>;

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
  correlationId?: string,
  guard: GuardName = 'accounting'
): PostingError {
  return new PostingError({
    code,
    message,
    category,
    guard,
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
