import { describe, expect, it, jest } from '@jest/globals';
import { AccountingPolicyRegistry } from '../AccountingPolicyRegistry';

const buildRegistry = (config: any) => {
  const configProvider = { getConfig: jest.fn().mockResolvedValue(config as never) } as any;
  return new AccountingPolicyRegistry(configProvider);
};

describe('AccountingPolicyRegistry.isApprovalRequiredForVoucherType (Stage 2b helper)', () => {
  it('returns false when approvalRequired is off (safe-by-default)', async () => {
    const reg = buildRegistry({ approvalRequired: false });
    expect(await reg.isApprovalRequiredForVoucherType('c1', 'sales_invoice')).toBe(false);
  });

  it('returns true for a non-exempt type when approvalRequired is on', async () => {
    const reg = buildRegistry({ approvalRequired: true });
    expect(await reg.isApprovalRequiredForVoucherType('c1', 'sales_invoice')).toBe(true);
  });

  it('returns false for a type listed in approvalExemptVoucherTypes', async () => {
    const reg = buildRegistry({
      approvalRequired: true,
      approvalExemptVoucherTypes: ['sales_invoice'],
    });
    expect(await reg.isApprovalRequiredForVoucherType('c1', 'sales_invoice')).toBe(false);
    expect(await reg.isApprovalRequiredForVoucherType('c1', 'purchase_invoice')).toBe(true);
  });
});
