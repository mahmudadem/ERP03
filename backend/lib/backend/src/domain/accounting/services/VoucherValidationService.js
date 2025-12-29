"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherValidationService = void 0;
const AppError_1 = require("../../shared/errors/AppError");
/**
 * VoucherValidationService
 *
 * The single validation gate in the backend for all vouchers.
 * Every voucher must pass through validateCore() before posting.
 */
class VoucherValidationService {
    /**
     * Core invariants (Always Enforced)
     *
     * These rules are non-negotiable and protect the fundamental integrity
     * of the accounting system.
     */
    validateCore(voucher, correlationId) {
        // 1. Single Source of Truth check (Lines must exist)
        if (!voucher.lines || voucher.lines.length < 2) {
            throw (0, AppError_1.createPostingError)('INSUFFICIENT_LINES', 'Voucher must have at least 2 lines (debit and credit)', AppError_1.ErrorCategory.CORE_INVARIANT, undefined, undefined, correlationId);
        }
        // 2. Accounting Invariants: Balanced check (Double-check entity logic)
        if (!voucher.isBalanced) {
            throw (0, AppError_1.createPostingError)('UNBALANCED_VOUCHER', `Voucher not balanced: Debit=${voucher.totalDebit}, Credit=${voucher.totalCredit}`, AppError_1.ErrorCategory.CORE_INVARIANT, undefined, undefined, correlationId);
        }
        // 3. Base currency balancing
        const roundingTolerance = 0.01;
        if (Math.abs(voucher.totalDebit - voucher.totalCredit) > roundingTolerance) {
            throw (0, AppError_1.createPostingError)('CURRENCY_IMBALANCE', `Voucher fails base currency balancing (diff: ${Math.abs(voucher.totalDebit - voucher.totalCredit)})`, AppError_1.ErrorCategory.CORE_INVARIANT, undefined, undefined, correlationId);
        }
        // 4. Amount Validity & Required Fields
        for (const line of voucher.lines) {
            if (!line.accountId || line.accountId.trim() === '') {
                throw (0, AppError_1.createPostingError)('MISSING_ACCOUNT', `Line ${line.id}: Account ID is required`, AppError_1.ErrorCategory.CORE_INVARIANT, [`lines[${line.id - 1}].accountId`], undefined, correlationId);
            }
            // Ensure positive amounts (debit vs credit is handled by the 'side' property)
            if (line.amount <= 0 || line.baseAmount <= 0) {
                throw (0, AppError_1.createPostingError)('INVALID_AMOUNT', `Line ${line.id}: Amounts must be positive. Got: ${line.amount}`, AppError_1.ErrorCategory.CORE_INVARIANT, [`lines[${line.id - 1}].amount`], undefined, correlationId);
            }
        }
        // 5. Currency consistency
        const invalidLines = voucher.lines.filter(line => line.currency !== voucher.currency || line.baseCurrency !== voucher.baseCurrency);
        if (invalidLines.length > 0) {
            throw (0, AppError_1.createPostingError)('CURRENCY_MISMATCH', 'All lines must use the same transaction and base currency as the voucher header', AppError_1.ErrorCategory.CORE_INVARIANT, undefined, undefined, correlationId);
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
    async validatePolicies(context, policies, mode = 'FAIL_FAST', correlationId) {
        const violations = [];
        // Run all policies in registry order
        for (const policy of policies) {
            const result = await policy.validate(context);
            if (!result.ok) {
                // Type guard: result is now PolicyError type
                const policyError = result;
                const violation = {
                    code: policyError.error.code,
                    message: policyError.error.message,
                    fieldHints: policyError.error.fieldHints,
                    policyId: policy.id
                };
                if (mode === 'FAIL_FAST') {
                    // Fail immediately on first violation
                    throw (0, AppError_1.createPostingError)(policyError.error.code, policyError.error.message, AppError_1.ErrorCategory.POLICY, policyError.error.fieldHints, policy.id, correlationId);
                }
                else {
                    // Collect violation for later
                    violations.push(violation);
                }
            }
        }
        // If in AGGREGATE mode and violations were collected, throw them all
        if (violations.length > 0) {
            throw (0, AppError_1.createAggregatedPolicyError)(violations, correlationId);
        }
    }
}
exports.VoucherValidationService = VoucherValidationService;
//# sourceMappingURL=VoucherValidationService.js.map