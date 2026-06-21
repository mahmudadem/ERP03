import { LegacyAccountingBridgeAdapter } from '../../../application/system-core';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';

const event = {
  kind: 'POS_SALE_REVENUE',
  transaction: { id: 'tx_1' },
  subledgerVoucher: {
    companyId: 'cmp_1',
    voucherType: VoucherType.SALES_INVOICE,
    voucherNo: 'POS-1',
    date: '2026-06-21',
    description: 'POS sale',
    currency: 'USD',
    exchangeRate: 1,
    lines: [],
    metadata: { sourceModule: 'pos', sourceType: 'POS_SALE', sourceId: 'receipt_1' },
    createdBy: 'user_1',
  },
};

describe('Accounting Bridge', () => {
  it('250k full mode preserves the existing subledger voucher posting path', async () => {
    const voucher = { id: 'v_1' };
    const postingService = { postInTransaction: jest.fn().mockResolvedValue(voucher) };
    const companyModuleRepo = { get: jest.fn().mockResolvedValue({ moduleCode: 'accounting', isEnabled: true }) };
    const postingLogRepo = { create: jest.fn() };
    const bridge = new LegacyAccountingBridgeAdapter(postingService as any, companyModuleRepo as any, postingLogRepo as any);

    const result = await bridge.recordFinancialEvent(event);

    expect(result).toEqual({ mode: 'full', voucher });
    expect(companyModuleRepo.get).toHaveBeenCalledWith('cmp_1', 'accounting');
    expect(postingService.postInTransaction).toHaveBeenCalledWith(event.subledgerVoucher, event.transaction);
    expect(postingLogRepo.create).not.toHaveBeenCalled();
  });

  it('250k minimal mode records a durable journal event when Accounting App is disabled', async () => {
    const postingService = { postInTransaction: jest.fn() };
    const companyModuleRepo = { get: jest.fn().mockResolvedValue({ moduleCode: 'accounting', isEnabled: false }) };
    const postingLogRepo = { create: jest.fn() };
    const bridge = new LegacyAccountingBridgeAdapter(postingService as any, companyModuleRepo as any, postingLogRepo as any);

    const result = await bridge.recordFinancialEvent(event);

    expect(result.mode).toBe('minimal');
    expect(result.voucher).toBeNull();
    expect(result.eventLogId).toMatch(/^fj_/);
    expect(postingService.postInTransaction).not.toHaveBeenCalled();
    expect(postingLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'cmp_1',
        sourceModule: 'pos',
        sourceType: 'POS_SALE',
        sourceId: 'receipt_1',
        strategy: 'MinimalJournal:POS_SALE_REVENUE',
        voucherIds: [],
        postedBy: 'user_1',
      }),
      event.transaction
    );
  });
});
