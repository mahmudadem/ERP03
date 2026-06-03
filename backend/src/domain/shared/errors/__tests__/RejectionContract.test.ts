import { toRejectionContract, RejectionContract } from '../RejectionContract';
import { createPostingError, ErrorCategory } from '../AppError';
import { PeriodLockedError } from '../../../accounting/errors/PeriodLockedError';
import { PersonaNotAllowedError } from '../../../accounting/errors/PersonaNotAllowedError';
import { CreditLimitExceededError } from '../../../sales/errors/CreditLimitExceededError';
import { BusinessError } from '../../../../errors/AppError';
import { ErrorCode } from '../../../../errors/ErrorCodes';

/**
 * Stage 5 — every guard rejection maps onto the uniform { guard, code, message, fieldHints }
 * contract, attributable to exactly one owning guard.
 */
describe('toRejectionContract', () => {
  const assertShape = (r: RejectionContract | null) => {
    expect(r).not.toBeNull();
    expect(typeof r!.guard).toBe('string');
    expect(typeof r!.code).toBe('string');
    expect(typeof r!.message).toBe('string');
    expect(Array.isArray(r!.fieldHints)).toBe(true);
  };

  it('maps a period-lock rejection to the accounting guard', () => {
    const r = toRejectionContract(
      new PeriodLockedError({ tier: 'HARD', documentDate: '2026-01-01', lockedThroughDate: '2026-03-31' })
    );
    assertShape(r);
    expect(r!.guard).toBe('accounting');
    expect(r!.code).toBe('PERIOD_LOCKED');
    expect(r!.fieldHints).toContain('date');
    expect(r!.policyId).toBe('period-lock');
  });

  it('maps a persona-governance rejection to the originating module guard', () => {
    const sales = toRejectionContract(
      new PersonaNotAllowedError({ companyId: 'c1', module: 'sales', persona: 'WALK_IN' })
    );
    assertShape(sales);
    expect(sales!.guard).toBe('sales');
    expect(sales!.code).toBe('PERSONA_NOT_ALLOWED');

    const purchases = toRejectionContract(
      new PersonaNotAllowedError({ companyId: 'c1', module: 'purchases', persona: 'CASH' })
    );
    expect(purchases!.guard).toBe('purchases');
  });

  it('maps a credit-limit rejection to the sales guard', () => {
    const r = toRejectionContract(
      new CreditLimitExceededError({
        customerId: 'cust-1',
        creditLimit: 1000,
        currentExposure: 900,
        orderAmount: 500,
        projectedExposure: 1400,
      })
    );
    assertShape(r);
    expect(r!.guard).toBe('sales');
    expect(r!.code).toBe('CREDIT_LIMIT_EXCEEDED');
    expect(r!.fieldHints).toContain('creditLimit');
  });

  it('maps a generic accounting policy violation to the accounting guard', () => {
    const r = toRejectionContract(
      createPostingError('APPROVAL_REQUIRED', 'Voucher must be approved', ErrorCategory.POLICY, ['status'], 'approval-required')
    );
    assertShape(r);
    expect(r!.guard).toBe('accounting');
    expect(r!.code).toBe('APPROVAL_REQUIRED');
    expect(r!.fieldHints).toContain('status');
    expect(r!.policyId).toBe('approval-required');
  });

  it('maps a BusinessError via its ErrorCode prefix', () => {
    const r = toRejectionContract(new BusinessError(ErrorCode.VOUCH_UNBALANCED, 'Unbalanced voucher'));
    assertShape(r);
    expect(r!.guard).toBe('accounting'); // VOUCH_* → accounting
    expect(r!.code).toBe('VOUCH_005');
  });

  it('returns null for an unknown / infrastructure error', () => {
    expect(toRejectionContract(new Error('boom'))).toBeNull();
  });
});
