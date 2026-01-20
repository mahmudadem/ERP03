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

      // 4.1 Exchange Rate Sanity Check (The "Bomb" Defuser)
      // If currency is different from base currency, exchange rate should not be exactly 1.0
      // unless clearly intended. This catches cases where the rate was defaulted to 1.
      if (line.currency !== line.baseCurrency && line.exchangeRate === 1) {
        throw createPostingError(
          'SUSPICIOUS_EXCHANGE_RATE',
          `Line ${line.id}: Exchange rate between ${line.currency} and ${line.baseCurrency} cannot be exactly 1.0. Please provide a valid rate.`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].exchangeRate`],
          undefined,
          correlationId
        );
      }
    }
    
    // 5. Currency consistency (skip for journal entries and reversals which support multi-currency lines)
    // Journal entries allow different transaction currencies per line, but base currency must balance
    // Reversals MUST mirror the original voucher structure, so they must support whatever the original supported.
    const isMultiCurrencySupported = 
      voucher.type.toLowerCase() === 'journal_entry' || 
      voucher.type.toLowerCase() === 'journalentry' ||
      voucher.type.toLowerCase() === 'reversal';
    
    if (!isMultiCurrencySupported) {
      // For other voucher types, enforce same currency as header
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
    } else {
      // For journal entries: only check that base currency matches across all lines
      const invalidBaseLines = voucher.lines.filter(
        line => line.baseCurrency !== voucher.baseCurrency
      );
      if (invalidBaseLines.length > 0) {
        throw createPostingError(
          'BASE_CURRENCY_MISMATCH',
          'All lines in a journal entry must use the same base currency for ledger posting',
          ErrorCategory.CORE_INVARIANT,
          undefined,
          undefined,
          correlationId
        );
      }
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
