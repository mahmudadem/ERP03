import { describe, it, expect } from '@jest/globals';
import { ApprovalRequiredPolicy } from '../../../../domain/accounting/policies/implementations/ApprovalRequiredPolicy';
import { PostingPolicyContext, PolicyResult } from '../../../../domain/accounting/policies/PostingPolicyTypes';
import { VoucherStatus, VoucherType } from '../../../../domain/accounting/types/VoucherTypes';

describe('ApprovalRequiredPolicy', () => {
  const policy = new ApprovalRequiredPolicy();

  const createContext = (status: VoucherStatus): PostingPolicyContext => ({
    companyId: 'company-001',
    voucherId: 'v-001',
    userId: 'user-1',
    voucherType: VoucherType.PAYMENT,
    voucherDate: '2025-01-15',
    voucherNo: 'PAY-001',
    baseCurrency: 'USD',
    totalDebit: 100,
    totalCredit: 100,
    status,
    isApproved: status === VoucherStatus.APPROVED,
    lines: [],
    metadata: {}
  });

  it('should pass for approved voucher', () => {
    const context = createContext(VoucherStatus.APPROVED);
    const result = policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should fail for draft voucher', () => {
    const context = createContext(VoucherStatus.DRAFT);
    const result: PolicyResult = policy.validate(context);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe('APPROVAL_REQUIRED');
      expect(result.error.message).toContain('must be approved');
      expect(result.error.fieldHints).toContain('status');
    }
  });

  it('should fail for rejected voucher', () => {
    const context = createContext(VoucherStatus.REJECTED);
    const result: PolicyResult = policy.validate(context);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe('APPROVAL_REQUIRED');
    }
  });
});
