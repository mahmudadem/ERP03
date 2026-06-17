import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface SalesRuleErrorOptions {
  /** Fields the user should look at (e.g. ['status'], ['settlementTotal']). */
  fieldHints?: string[];
  /** The policy that produced this rejection, when applicable. */
  policyId?: string;
  /** Classification of the rejection. Defaults to CONFLICT (invalid state). */
  category?: ErrorCategory;
  /** Optional structured context for the frontend to interpolate. */
  context?: Record<string, unknown>;
}

/**
 * Thrown when a Sales business rule rejects an operation — an invalid lifecycle
 * transition (e.g. confirming a non-DRAFT order), an over-payment, or a
 * settlement-rule breach.
 *
 * Extends {@link PostingError} so the global error handler returns a structured
 * 4xx (400) carrying a meaningful domain `code` and the uniform Law 5 guard
 * attribution, instead of mapping a generic `Error` to INFRA_999 / HTTP 500.
 * This mirrors how {@link PersonaNotAllowedError} (also a PostingError) is
 * already surfaced.
 */
export class SalesRuleError extends PostingError {
  constructor(code: string, message: string, options: SalesRuleErrorOptions = {}) {
    const violations: ErrorViolation[] = [
      {
        code,
        message,
        fieldHints: options.fieldHints,
        policyId: options.policyId,
      },
    ];
    super({
      code,
      message,
      category: options.category ?? ErrorCategory.CONFLICT,
      // Sales rules are owned by the Sales guard (Law 5).
      guard: 'sales',
      details: { violations },
      context: options.context,
    });
    this.name = 'SalesRuleError';
  }
}
