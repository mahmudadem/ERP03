import { describe, it, expect } from '@jest/globals';
import { PeriodLockPolicy } from '../../../../../src/domain/accounting/policies/implementations/PeriodLockPolicy';
import { PostingPolicyContext } from '../../../../../src/domain/accounting/policies/PostingPolicyTypes';
import { VoucherStatus, VoucherType } from '../../../../../src/domain/accounting/types/VoucherTypes';

describe('PeriodLockPolicy', () => {
  const createContext = (voucherDate: string): PostingPolicyContext => ({
    companyId: 'company-001',
    voucherId: 'v-001',
    voucherType: VoucherType.PAYMENT,
    voucherDate,
    voucherNo: 'PAY-001',
    baseCurrency: 'USD',
    totalDebit: 100,
    totalCredit: 100,
    status: VoucherStatus.DRAFT,
    isApproved: false,
    lines: [],
    metadata: {}
  });

  it('should pass when no locked date configured', () => {
    const policy = new PeriodLockPolicy();
    const context = createContext('2025-01-15');
    const result = policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should pass for date after locked period', () => {
    const policy = new PeriodLockPolicy('2024-12-31');
    const context = createContext('2025-01-15');
    const result = policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should fail for date in locked period', () => {
    const policy = new PeriodLockPolicy('2024-12-31');
    const context = createContext('2024-12-15');
    const result = policy.validate(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PERIOD_LOCKED');
      expect(result.error.message).toContain('locked period');
      expect(result.error.fieldHints).toContain('date');
    }
  });

  it('should fail for date equal to locked through date', () => {
    const policy = new PeriodLockPolicy('2024-12-31');
    const context = createContext('2024-12-31');
    const result = policy.validate(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PERIOD_LOCKED');
    }
  });

  it('should handle boundary correctly', () => {
    const policy = new PeriodLockPolicy('2024-12-31');
    
    // Day before lock end - should fail
    const context1 = createContext('2024-12-30');
    expect(context1).toBeDefined();
    const result1 = policy.validate(context1);
    expect(result1.ok).toBe(false);
    
    // Day after lock end - should pass
    const context2 = createContext('2025-01-01');
    const result2 = policy.validate(context2);
    expect(result2.ok).toBe(true);
  });
});
