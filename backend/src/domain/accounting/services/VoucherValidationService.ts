import { VoucherEntity } from '../entities/VoucherEntity';
import { IPostingPolicy } from '../policies/IPostingPolicy';
import { PostingPolicyContext } from '../policies/PostingPolicyTypes';
import { 
  ErrorCategory, 
  ErrorViolation, 
  createPostingError, 
  createAggregatedPolicyError,
  PostingError
} from '../../shared/errors/AppError';

/**
 * VoucherValidationService
 * 
 * The single validation gate in the backend for all vouchers.
 * Every voucher must pass through validateCore() before posting.
 */
export class VoucherValidationService {
  /**
   * Core invariants (Always Enforced)
   * 
   * These rules are non-negotiable and protect the fundamental integrity
   * of the accounting system.
   */
  validateCore(voucher: VoucherEntity, correlationId?: string): void {
    // 1. Single Source of Truth check (Lines must exist)
    if (!voucher.lines || voucher.lines.length < 2) {
      throw createPostingError(
        'INSUFFICIENT_LINES',
        'Voucher must have at least 2 lines (debit and credit)',
        ErrorCategory.CORE_INVARIANT,
        undefined,
        undefined,
        correlationId
      );
    }

    // 2. Accounting Invariants: Balanced check (Double-check entity logic)
    if (!voucher.isBalanced) {
      throw createPostingError(
        'UNBALANCED_VOUCHER',
        `Voucher not balanced: Debit=${voucher.totalDebit}, Credit=${voucher.totalCredit}`,
        ErrorCategory.CORE_INVARIANT,
        undefined,
        undefined,
        correlationId
      );
    }

    // 3. Base currency balancing
    const roundingTolerance = 0.01;
    if (Math.abs(voucher.totalDebit - voucher.totalCredit) > roundingTolerance) {
      throw createPostingError(
        'CURRENCY_IMBALANCE',
        `Voucher fails base currency balancing (diff: ${Math.abs(voucher.totalDebit - voucher.totalCredit)})`,
        ErrorCategory.CORE_INVARIANT,
        undefined,
        undefined,
        correlationId
      );
    }

    // 4. Amount Validity & Required Fields
    for (const line of voucher.lines) {
      if (!line.accountId || line.accountId.trim() === '') {
        throw createPostingError(
          'MISSING_ACCOUNT',
          `Line ${line.id}: Account ID is required`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].accountId`],
          undefined,
          correlationId
        );
      }
      
      // Ensure positive amounts (debit vs credit is handled by the 'side' property)
      if (line.amount <= 0 || line.baseAmount <= 0) {
        throw createPostingError(
          'INVALID_AMOUNT',
          `Line ${line.id}: Amounts must be positive. Got: ${line.amount}`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].amount`],
          undefined,
          correlationId
        );
      }
    }
    
    // 5. Currency consistency
    const invalidLines = voucher.lines.filter(
      line => line.currency !== voucher.currency || line.baseCurrency !== voucher.baseCurrency
    );
    if (invalidLines.length > 0) {
      throw createPostingError(
        'CURRENCY_MISMATCH',
        'All lines must use the same transaction and base currency as the voucher header',
        ErrorCategory.CORE_INVARIANT,
        undefined,
        undefined,
        correlationId
      );
    }
  }

  /**
   * Optional Policies (Feature-driven)
   * 
   * These rules depend on company settings, voucher types, or other features.
   * Wiring is handled at the application/infrastructure layer.
   * 
   * Supports two modes:
   * - FAIL_FAST: Return on first policy failure (default)
   * - AGGREGATE: Collect all policy failures before throwing
   * 
   * @param context - Posting context with voucher data
   * @param policies - List of enabled policies to check
   * @param mode - Error handling mode
   * @param correlationId - Request correlation ID
   * @throws PostingError with structured policy error details
   */
  async validatePolicies(
    context: PostingPolicyContext,
    policies: IPostingPolicy[],
    mode: 'FAIL_FAST' | 'AGGREGATE' = 'FAIL_FAST',
    correlationId?: string
  ): Promise<void> {
    const violations: ErrorViolation[] = [];

    // Run all policies in registry order
    for (const policy of policies) {
      const result = await policy.validate(context);
      
      if (!result.ok) {
        // Type guard: result is now PolicyError type
        const policyError = result as { ok: false; error: { code: string; message: string; fieldHints?: string[] } };
        
        const violation: ErrorViolation = {
          code: policyError.error.code,
          message: policyError.error.message,
          fieldHints: policyError.error.fieldHints,
          policyId: policy.id
        };

        if (mode === 'FAIL_FAST') {
          // Fail immediately on first violation
          throw createPostingError(
            policyError.error.code,
            policyError.error.message,
            ErrorCategory.POLICY,
            policyError.error.fieldHints,
            policy.id,
            correlationId
          );
        } else {
          // Collect violation for later
          violations.push(violation);
        }
      }
    }

    // If in AGGREGATE mode and violations were collected, throw them all
    if (violations.length > 0) {
      throw createAggregatedPolicyError(violations, correlationId);
    }
  }
}
