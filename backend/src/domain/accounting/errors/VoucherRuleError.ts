import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface VoucherRuleErrorOptions {
  fieldHints?: string[];
  policyId?: string;
  category?: ErrorCategory;
  context?: Record<string, unknown>;
}

export class VoucherRuleError extends PostingError {
  constructor(code: string, message: string, options: VoucherRuleErrorOptions = {}) {
    const violations: ErrorViolation[] = [
      { code, message, fieldHints: options.fieldHints, policyId: options.policyId },
    ];
    super({
      code,
      message,
      category: options.category ?? ErrorCategory.CONFLICT,
      guard: 'accounting',
      details: { violations },
      context: options.context,
    });
    this.name = 'VoucherRuleError';
  }
}
