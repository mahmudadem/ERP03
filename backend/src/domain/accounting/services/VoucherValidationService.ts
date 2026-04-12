import { VoucherEntity } from '../entities/VoucherEntity';
import { IPostingPolicy } from '../policies/IPostingPolicy';
import { PostingPolicyContext } from '../policies/PostingPolicyTypes';
import { 
  ErrorCategory, 
  ErrorViolation, 
  createPostingError, 
  createAggregatedPolicyError,
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
      
      // Ensure non-negative amounts (debit vs credit is handled by the 'side' property)
      if (line.amount < 0 || line.baseAmount < 0) {
        throw createPostingError(
          'INVALID_AMOUNT',
          `Line ${line.id}: Amounts must be non-negative. Got: ${line.amount}`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].amount`],
          undefined,
          correlationId
        );
      }

      // 4.1 Exchange Rate Sanity Check (The "Bomb" Defuser)
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
    
    this.validateCurrencies(voucher, correlationId);
  }

  /**
   * Currency consistency check
   */
  private validateCurrencies(voucher: VoucherEntity, correlationId?: string): void {
    const isMultiCurrencySupported = 
      voucher.type.toLowerCase() === 'journal_entry' || 
      voucher.type.toLowerCase() === 'journalentry' ||
      voucher.type.toLowerCase() === 'reversal';
    
    if (!isMultiCurrencySupported) {
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
   * Mandatory Account Postability Check (The Financial Shield)
   * Ensures that all accounts in the voucher are POSTING roles and ACTIVE.
   */
  async validateAccounts(
    voucher: VoucherEntity, 
    accountRepository: { getById(companyId: string, id: string): Promise<any> },
    correlationId?: string
  ): Promise<void> {
    for (const line of voucher.lines) {
      const account = await accountRepository.getById(voucher.companyId, line.accountId);
      
      if (!account) {
        throw createPostingError(
          'ACCOUNT_NOT_FOUND',
          `Line ${line.id}: Account ID "${line.accountId}" does not exist for company ${voucher.companyId}`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].accountId`],
          undefined,
          correlationId
        );
      }

      if (account.accountRole !== 'POSTING') {
        throw createPostingError(
          'NON_POSTABLE_ACCOUNT',
          `Line ${line.id}: Account "${account.userCode || account.code} - ${account.name}" is a ${account.accountRole} account. Direct posting to non-POSTING accounts is forbidden.`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].accountId`],
          undefined,
          correlationId
        );
      }

      if (account.status !== 'ACTIVE') {
        throw createPostingError(
          'INACTIVE_ACCOUNT',
          `Line ${line.id}: Account "${account.userCode || account.code} - ${account.name}" is INACTIVE.`,
          ErrorCategory.CORE_INVARIANT,
          [`lines[${line.id - 1}].accountId`],
          undefined,
          correlationId
        );
      }
    }
  }

  /**
   * Optional Policies (Feature-driven)
   */
  async validatePolicies(
    context: PostingPolicyContext,
    policies: IPostingPolicy[],
    mode: 'FAIL_FAST' | 'AGGREGATE' = 'FAIL_FAST',
    correlationId?: string
  ): Promise<void> {
    const violations: ErrorViolation[] = [];

    for (const policy of policies) {
      const result = await policy.validate(context);
      
      if (!result.ok) {
        const policyError = result as { ok: false; error: { code: string; message: string; fieldHints?: string[] } };
        
        const violation: ErrorViolation = {
          code: policyError.error.code,
          message: policyError.error.message,
          fieldHints: policyError.error.fieldHints,
          policyId: policy.id
        };

        if (mode === 'FAIL_FAST') {
          throw createPostingError(
            policyError.error.code,
            policyError.error.message,
            ErrorCategory.POLICY,
            policyError.error.fieldHints,
            policy.id,
            correlationId
          );
        } else {
          violations.push(violation);
        }
      }
    }

    if (violations.length > 0) {
      throw createAggregatedPolicyError(violations, correlationId);
    }
  }
}
