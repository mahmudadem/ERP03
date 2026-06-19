import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface PurchaseRuleErrorOptions {
  fieldHints?: string[];
  policyId?: string;
  category?: ErrorCategory;
  context?: Record<string, unknown>;
}

export class PurchaseRuleError extends PostingError {
  constructor(code: string, message: string, options: PurchaseRuleErrorOptions = {}) {
    const violations: ErrorViolation[] = [
      { code, message, fieldHints: options.fieldHints, policyId: options.policyId },
    ];
    super({
      code,
      message,
      category: options.category ?? ErrorCategory.CONFLICT,
      guard: 'purchases',
      details: { violations },
      context: options.context,
    });
    this.name = 'PurchaseRuleError';
  }
}
