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

/**
 * FUP-5: settlement/payment receipts (SI/PI settlement + record-payment) are pre-assembled
 * VoucherEntities posted via PostingGateway, not the subledger assembler. recordPreBuiltVoucher
 * routes them through the same full-vs-minimal decision.
 */
describe('Accounting Bridge — FUP-5 recordPreBuiltVoucher', () => {
  const preBuiltVoucher = {
    companyId: 'cmp_1',
    voucherNo: 'RV-0001',
    createdBy: 'user_1',
    reference: 'SI-00002',
    metadata: { sourceModule: 'sales', sourceType: 'SALES_RECEIPT', sourceInvoiceId: 'si_1' },
  } as any;

  it('full mode (App enabled): runs the real postFull verbatim and returns the voucher', async () => {
    const postFull = jest.fn().mockResolvedValue(undefined);
    const companyModuleRepo = { get: jest.fn().mockResolvedValue({ moduleCode: 'accounting', isEnabled: true }) };
    const postingLogRepo = { create: jest.fn() };
    const bridge = new LegacyAccountingBridgeAdapter({} as any, companyModuleRepo as any, postingLogRepo as any);

    const result = await bridge.recordPreBuiltVoucher({
      companyId: 'cmp_1', kind: 'SALES_RECEIPT', voucher: preBuiltVoucher, postFull, transaction: { id: 'tx_1' },
    });

    expect(result).toEqual({ mode: 'full', voucher: preBuiltVoucher });
    expect(postFull).toHaveBeenCalledTimes(1);          // the exact legacy gateway.record + save ran
    expect(postingLogRepo.create).not.toHaveBeenCalled();
  });

  it('minimal mode (App disabled): skips postFull and records a minimal journal (no GL voucher)', async () => {
    const postFull = jest.fn().mockResolvedValue(undefined);
    const companyModuleRepo = { get: jest.fn().mockResolvedValue({ moduleCode: 'accounting', isEnabled: false }) };
    const postingLogRepo = { create: jest.fn() };
    const bridge = new LegacyAccountingBridgeAdapter({} as any, companyModuleRepo as any, postingLogRepo as any);

    const result = await bridge.recordPreBuiltVoucher({
      companyId: 'cmp_1', kind: 'SALES_RECEIPT', voucher: preBuiltVoucher, postFull, transaction: { id: 'tx_1' },
    });

    expect(result.mode).toBe('minimal');
    expect(result.voucher).toBeNull();
    expect(result.eventLogId).toMatch(/^fj_/);
    expect(postFull).not.toHaveBeenCalled();             // no GL voucher posted
    expect(postingLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'cmp_1',
        sourceModule: 'sales',
        sourceType: 'SALES_RECEIPT',
        sourceId: 'si_1',
        strategy: 'MinimalJournal:SALES_RECEIPT',
        postedBy: 'user_1',
      }),
      { id: 'tx_1' }
    );
  });
});
