import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubledgerVoucherPostingService } from '../SubledgerVoucherPostingService';
import { IPostingPolicy } from '../../../../domain/accounting/policies/IPostingPolicy';
import { PostingError } from '../../../../domain/shared/errors/AppError';
import { VoucherType } from '../../../../domain/accounting/types/VoucherTypes';

describe('SubledgerVoucherPostingService policy guard', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('runs accounting policies before ledger and voucher writes', async () => {
    const voucherRepo = {
      save: jest.fn(),
      delete: jest.fn(),
    } as any;
    const ledgerRepo = {
      recordForVoucher: jest.fn(),
      deleteForVoucher: jest.fn(),
    } as any;
    const companyCurrencyRepo = {
      getBaseCurrency: jest.fn().mockResolvedValue('USD' as never),
    } as any;

    const validatePolicy = jest.fn(async (_ctx: any) => ({
        ok: false,
        error: {
          code: 'COST_CENTER_REQUIRED',
          message: 'Cost center is required for this account',
          fieldHints: ['lines[0].costCenterId'] as string[],
        },
      }));

    const blockingPolicy: IPostingPolicy = {
      id: 'cost-center-required',
      name: 'Cost Center Required',
      validate: validatePolicy as unknown as IPostingPolicy['validate'],
    };

    const policyRegistry = {
      getConfig: jest.fn().mockResolvedValue({ policyErrorMode: 'FAIL_FAST' } as never),
      getEnabledPolicies: jest.fn().mockResolvedValue([blockingPolicy] as never),
    };

    const service = new SubledgerVoucherPostingService(
      voucherRepo,
      ledgerRepo,
      companyCurrencyRepo,
      undefined,
      undefined,
      undefined,
      policyRegistry as any
    );

    await expect(service.postInTransaction({
      companyId: 'company-1',
      voucherType: VoucherType.JOURNAL_ENTRY,
      voucherNo: 'AUTO-001',
      date: '2026-05-15',
      description: 'Automatic subledger voucher',
      currency: 'USD',
      exchangeRate: 1,
      createdBy: 'user-1',
      metadata: { source: 'test' },
      lines: [
        { accountId: 'cash-1', side: 'Debit', amount: 100, currency: 'USD', exchangeRate: 1 },
        { accountId: 'revenue-1', side: 'Credit', amount: 100, currency: 'USD', exchangeRate: 1 },
      ],
    })).rejects.toBeInstanceOf(PostingError);

    expect(policyRegistry.getConfig).toHaveBeenCalledWith('company-1');
    expect(policyRegistry.getEnabledPolicies).toHaveBeenCalledWith('company-1');
    expect(validatePolicy).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-1',
      userId: 'user-1',
      voucherType: VoucherType.JOURNAL_ENTRY,
      voucherDate: '2026-05-15',
      metadata: { source: 'test' },
    }));
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(voucherRepo.save).not.toHaveBeenCalled();
  });
});
