import { CompleteStockTransferUseCase } from '../../../application/inventory/use-cases/StockTransferUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { StockTransfer } from '../../../domain/inventory/entities/StockTransfer';

const COMPANY_ID = 'cmp-trf-golden';
const USER_ID = 'u-trf-golden';

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  constructor(private readonly mode: 'full' | 'minimal' = 'full') {}

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return {
      mode: this.mode,
      voucher: this.mode === 'full' ? ({ id: `vch-trf-${this.events.length}` } as VoucherEntity) : null,
    };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Stock Transfer should not send prebuilt voucher events');
  }
}

const makeTransfer = (lineOverrides: Partial<StockTransfer['lines'][number]> = {}) =>
  new StockTransfer({
    id: 'trf-golden-1',
    companyId: COMPANY_ID,
    sourceWarehouseId: 'wh-A',
    destinationWarehouseId: 'wh-B',
    date: '2026-05-01',
    mode: 'VALUED',
    lines: [{
      itemId: 'item-1',
      qty: 5,
      unitCostBaseAtTransfer: 320,
      unitCostCCYAtTransfer: 320,
      ...lineOverrides,
    }],
    status: 'DRAFT',
    transferPairId: 'pair-golden-1',
    createdBy: USER_ID,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
  });

function buildUseCase(
  bridge: IAccountingBridge,
  lineOverrides: Partial<StockTransfer['lines'][number]> = {},
  movementCosts = { out: 320, in: 400 }
) {
  const transfer = makeTransfer(lineOverrides);
  const updateTransfer = jest.fn(async () => undefined);
  const transferRepo = {
    getTransfer: jest.fn()
      .mockResolvedValueOnce(transfer)
      .mockResolvedValueOnce(new StockTransfer({ ...transfer.toJSON(), status: 'COMPLETED' } as any)),
    updateTransfer,
  };
  const movementUseCase = {
    processTRANSFER: jest.fn(async () => ({
      outMov: { unitCostBase: movementCosts.out, unitCostCCY: movementCosts.out, totalCostBase: movementCosts.out * 5 },
      inMov: { unitCostBase: movementCosts.in, unitCostCCY: movementCosts.in, totalCostBase: movementCosts.in * 5 },
    })),
    preFetchItemContext: jest.fn(async () => ({ item: { id: 'item-1' }, baseCurrency: 'USD' })),
  };
  const useCase = new CompleteStockTransferUseCase(
    transferRepo as any,
    { getItem: jest.fn(async () => ({ id: 'item-1', companyId: COMPANY_ID, code: 'ITM-1', inventoryAssetAccountId: 'INV-100' })) } as any,
    { getLevel: jest.fn(async () => null) } as any,
    movementUseCase as any,
    { runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) => operation({ id: 'txn-trf' })) } as any,
    { get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized: true })) } as any,
    {
      getSettings: jest.fn(async () => ({
        defaultInventoryTransferClearingAccountId: 'CLR-900',
        defaultInventoryRevaluationAccountId: 'REV-700',
        defaultInventoryAssetAccountId: 'INV-DEFAULT',
      })),
    } as any,
    bridge
  );

  return { useCase, transfer, updateTransfer };
}

describe('Stock Transfer vouchers — golden bridge output (Task 267-F Inventory Stock Transfer slice)', () => {
  it('G1: added-cost VALUED transfer sends exact Inventory/Clearing voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, transfer, updateTransfer } = buildUseCase(bridge, {
      addedCostBaseAtTransfer: 400,
      addedCostCCYAtTransfer: 400,
    });

    await useCase.execute(COMPANY_ID, transfer.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    const event = bridge.events[0];
    const voucher = event.subledgerVoucher!;
    expect(event.kind).toBe('STOCK_TRANSFER');
    expect(event.transaction).toEqual({ id: 'txn-trf' });
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe('journal_entry');
    expect(voucher.voucherNo).toBe('TRF-trf-golden-1');
    expect(voucher.date).toBe('2026-05-01');
    expect(voucher.description).toBe('Stock transfer trf-golden-1 valuation entry');
    expect(voucher.currency).toBe('');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBe('trf-golden-1');
    expect(voucher.createdBy).toBe(USER_ID);
    expect(voucher.postingLockPolicy).toBe('FLEXIBLE_LOCKED');
    expect(voucher.baseCurrencyOverride).toBe('USD');
    expect(voucher.metadata).toEqual({
      sourceModule: 'inventory',
      referenceType: 'STOCK_TRANSFER',
      referenceId: 'trf-golden-1',
      transferId: 'trf-golden-1',
    });
    expect(voucher.lines).toEqual([
      {
        accountId: 'INV-100',
        side: 'Debit',
        amount: 400,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: 400,
        docAmount: 400,
        notes: 'Stock transfer trf-golden-1 added cost',
        metadata: { source: 'stock-transfer', transferId: 'trf-golden-1', role: 'inventory-added-cost' },
      },
      {
        accountId: 'CLR-900',
        side: 'Credit',
        amount: 400,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: 400,
        docAmount: 400,
        notes: 'Stock transfer trf-golden-1 clearing',
        metadata: { source: 'stock-transfer', transferId: 'trf-golden-1', role: 'transfer-clearing' },
      },
    ]);
    expect(updateTransfer).toHaveBeenCalledWith(
      'trf-golden-1',
      expect.objectContaining({ status: 'COMPLETED', voucherId: 'vch-trf-1' }),
      { id: 'txn-trf' }
    );
  });

  it('G2: explicit revaluation sends exact Inventory/Revaluation voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, transfer } = buildUseCase(bridge, {
      revaluationUnitCostBaseAtTransfer: 400,
      revaluationUnitCostCCYAtTransfer: 400,
    });

    await useCase.execute(COMPANY_ID, transfer.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.lines).toEqual([
      expect.objectContaining({
        accountId: 'INV-100',
        side: 'Debit',
        amount: 400,
        baseAmount: 400,
        metadata: { source: 'stock-transfer', transferId: 'trf-golden-1', role: 'inventory-revaluation' },
      }),
      expect.objectContaining({
        accountId: 'REV-700',
        side: 'Credit',
        amount: 400,
        baseAmount: 400,
        metadata: { source: 'stock-transfer', transferId: 'trf-golden-1', role: 'inventory-revaluation-variance' },
      }),
    ]);
  });

  it('G3: minimal mode sends the same event but links no GL voucher id', async () => {
    const bridge = new CapturingBridge('minimal');
    const { useCase, transfer, updateTransfer } = buildUseCase(bridge, {
      addedCostBaseAtTransfer: 400,
      addedCostCCYAtTransfer: 400,
    });

    await useCase.execute(COMPANY_ID, transfer.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    expect(updateTransfer).toHaveBeenCalledWith(
      'trf-golden-1',
      expect.not.objectContaining({ voucherId: expect.anything() }),
      { id: 'txn-trf' }
    );
  });

  it('G4: valued transfer without explicit added cost or revaluation creates no bridge event', async () => {
    const bridge = new CapturingBridge();
    const { useCase, transfer, updateTransfer } = buildUseCase(bridge, {}, { out: 320, in: 320 });

    await useCase.execute(COMPANY_ID, transfer.id, USER_ID);

    expect(bridge.events).toHaveLength(0);
    expect(updateTransfer).toHaveBeenCalledWith(
      'trf-golden-1',
      expect.not.objectContaining({ voucherId: expect.anything() }),
      { id: 'txn-trf' }
    );
  });

  it('G5: voucher output is stable across repeated postings', async () => {
    const bridge1 = new CapturingBridge();
    const { useCase: useCase1, transfer: transfer1 } = buildUseCase(bridge1, {
      addedCostBaseAtTransfer: 400,
      addedCostCCYAtTransfer: 400,
    });
    await useCase1.execute(COMPANY_ID, transfer1.id, USER_ID);

    const bridge2 = new CapturingBridge();
    const { useCase: useCase2, transfer: transfer2 } = buildUseCase(bridge2, {
      addedCostBaseAtTransfer: 400,
      addedCostCCYAtTransfer: 400,
    });
    await useCase2.execute(COMPANY_ID, transfer2.id, USER_ID);

    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
  });
});
