import { PostStockAdjustmentUseCase } from '../../../application/inventory/use-cases/StockAdjustmentUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { StockAdjustment } from '../../../domain/inventory/entities/StockAdjustment';

const COMPANY_ID = 'cmp-adj-golden';
const USER_ID = 'u-adj-golden';

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  constructor(private readonly mode: 'full' | 'minimal' = 'full') {}

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return {
      mode: this.mode,
      voucher: this.mode === 'full' ? ({ id: `vch-adj-${this.events.length}` } as VoucherEntity) : null,
    };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Stock Adjustment should not send prebuilt voucher events');
  }
}

const makeAdjustment = () =>
  new StockAdjustment({
    id: 'adj-golden-1',
    companyId: COMPANY_ID,
    warehouseId: 'wh-golden-1',
    date: '2026-04-07',
    reason: 'CORRECTION',
    notes: 'count variance',
    lines: [
      {
        itemId: 'item-in',
        currentQty: 3,
        newQty: 5,
        adjustmentQty: 2,
        unitCostBase: 99,
        unitCostCCY: 99,
      },
      {
        itemId: 'item-out',
        currentQty: 8,
        newQty: 5,
        adjustmentQty: -3,
        unitCostBase: 88,
        unitCostCCY: 88,
      },
    ],
    status: 'DRAFT',
    adjustmentValueBase: 462,
    createdBy: USER_ID,
    createdAt: new Date('2026-04-07T00:00:00.000Z'),
  });

function buildUseCase(bridge: IAccountingBridge, opts: { mode?: 'PERIODIC' | 'PERPETUAL' } = {}) {
  const adjustment = makeAdjustment();
  const updateAdjustment = jest.fn(async () => undefined);
  const adjustmentRepo = {
    getAdjustment: jest.fn()
      .mockResolvedValueOnce(adjustment)
      .mockResolvedValueOnce(new StockAdjustment({
        ...adjustment.toJSON(),
        status: 'POSTED',
        voucherId: bridge instanceof CapturingBridge && bridge.events.length > 0 ? 'vch-adj-1' : null,
        adjustmentValueBase: 70,
        postedAt: new Date('2026-04-07T01:00:00.000Z'),
      } as any)),
    updateAdjustment,
  };
  const itemsById = new Map([
    ['item-in', {
      id: 'item-in',
      companyId: COMPANY_ID,
      code: 'IN-ITEM',
      costCurrency: 'USD',
      inventoryAssetAccountId: 'INV-IN-100',
      cogsAccountId: 'COGS-IN-100',
    }],
    ['item-out', {
      id: 'item-out',
      companyId: COMPANY_ID,
      code: 'OUT-ITEM',
      costCurrency: 'USD',
      inventoryAssetAccountId: 'INV-OUT-100',
      cogsAccountId: 'COGS-OUT-100',
    }],
  ]);
  const movementUseCase = {
    processIN: jest.fn(async () => ({ id: 'sm-in-1', direction: 'IN', totalCostBase: 20 })),
    processOUT: jest.fn(async () => ({ id: 'sm-out-1', direction: 'OUT', totalCostBase: 50 })),
    preFetchItemContext: jest.fn(async (_companyId: string, itemId: string) => ({
      item: itemsById.get(itemId),
      baseCurrency: 'USD',
    })),
    preFetchStockLevel: jest.fn(async () => null),
  };

  const useCase = new PostStockAdjustmentUseCase(
    adjustmentRepo as any,
    { getItem: jest.fn(async (itemId: string) => itemsById.get(itemId)) } as any,
    movementUseCase as any,
    { runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) => operation({ id: 'txn-adj' })) } as any,
    { get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized: true })) } as any,
    bridge,
    {
      getSettings: jest.fn(async () => ({
        accountingMode: opts.mode ?? 'PERPETUAL',
        inventoryAccountingMethod: opts.mode ?? 'PERPETUAL',
        defaultInventoryAssetAccountId: 'INV-DEFAULT-100',
        defaultInventoryGainAccountId: 'GAIN-100',
        defaultInventoryLossAccountId: 'LOSS-100',
        defaultCOGSAccountId: 'COGS-DEFAULT-100',
      })),
    } as any
  );

  return { useCase, adjustment, updateAdjustment };
}

describe('Stock Adjustment vouchers — golden bridge output (Task 267-F Inventory Stock Adjustment slice)', () => {
  it('G1: PERPETUAL mode sends exact gain/loss and inventory voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, adjustment, updateAdjustment } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, adjustment.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    const event = bridge.events[0];
    const voucher = event.subledgerVoucher!;
    expect(event.kind).toBe('STOCK_ADJUSTMENT');
    expect(event.transaction).toEqual({ id: 'txn-adj' });
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe('journal_entry');
    expect(voucher.voucherNo).toBe('ADJ-adj-golden-1');
    expect(voucher.date).toBe('2026-04-07');
    expect(voucher.description).toBe('Inventory adjustment adj-golden-1 (CORRECTION)');
    expect(voucher.currency).toBe('');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBe('adj-golden-1');
    expect(voucher.createdBy).toBe(USER_ID);
    expect(voucher.postingLockPolicy).toBe('FLEXIBLE_LOCKED');
    expect(voucher.baseCurrencyOverride).toBe('USD');
    expect(voucher.metadata).toEqual({
      sourceModule: 'inventory',
      referenceType: 'STOCK_ADJUSTMENT',
      referenceId: 'adj-golden-1',
      adjustmentId: 'adj-golden-1',
      adjustmentReason: 'CORRECTION',
      adjustmentValueBase: 70,
    });
    expect(voucher.lines).toEqual([
      {
        accountId: 'INV-IN-100',
        side: 'Debit',
        amount: 20,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: 20,
        docAmount: 20,
        notes: 'Stock adjustment adj-golden-1 (item-in)',
        metadata: {
          source: 'inventory-adjustment',
          adjustmentId: 'adj-golden-1',
          itemId: 'item-in',
          warehouseId: 'wh-golden-1',
          movementId: 'sm-in-1',
          direction: 'ADJUSTMENT_IN',
        },
      },
      {
        accountId: 'GAIN-100',
        side: 'Credit',
        amount: 20,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: 20,
        docAmount: 20,
        notes: 'Stock adjustment adj-golden-1 (item-in)',
        metadata: {
          source: 'inventory-adjustment',
          adjustmentId: 'adj-golden-1',
          itemId: 'item-in',
          warehouseId: 'wh-golden-1',
          movementId: 'sm-in-1',
          direction: 'ADJUSTMENT_IN',
        },
      },
      {
        accountId: 'LOSS-100',
        side: 'Debit',
        amount: 50,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: 50,
        docAmount: 50,
        notes: 'Stock adjustment adj-golden-1 (item-out)',
        metadata: {
          source: 'inventory-adjustment',
          adjustmentId: 'adj-golden-1',
          itemId: 'item-out',
          warehouseId: 'wh-golden-1',
          movementId: 'sm-out-1',
          direction: 'ADJUSTMENT_OUT',
        },
      },
      {
        accountId: 'INV-OUT-100',
        side: 'Credit',
        amount: 50,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: 50,
        docAmount: 50,
        notes: 'Stock adjustment adj-golden-1 (item-out)',
        metadata: {
          source: 'inventory-adjustment',
          adjustmentId: 'adj-golden-1',
          itemId: 'item-out',
          warehouseId: 'wh-golden-1',
          movementId: 'sm-out-1',
          direction: 'ADJUSTMENT_OUT',
        },
      },
    ]);
    expect(updateAdjustment).toHaveBeenCalledWith(
      COMPANY_ID,
      'adj-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: 'vch-adj-1', adjustmentValueBase: 70 }),
      { id: 'txn-adj' }
    );
  });

  it('G2: minimal mode sends the same event but links no GL voucher id', async () => {
    const bridge = new CapturingBridge('minimal');
    const { useCase, adjustment, updateAdjustment } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, adjustment.id, USER_ID);

    expect(bridge.events).toHaveLength(1);
    expect(bridge.events[0].subledgerVoucher!.voucherNo).toBe('ADJ-adj-golden-1');
    expect(updateAdjustment).toHaveBeenCalledWith(
      COMPANY_ID,
      'adj-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: null, adjustmentValueBase: 70 }),
      { id: 'txn-adj' }
    );
  });

  it('G3: PERIODIC mode creates no bridge event and links no GL voucher', async () => {
    const bridge = new CapturingBridge();
    const { useCase, adjustment, updateAdjustment } = buildUseCase(bridge, { mode: 'PERIODIC' });

    await useCase.execute(COMPANY_ID, adjustment.id, USER_ID);

    expect(bridge.events).toHaveLength(0);
    expect(updateAdjustment).toHaveBeenCalledWith(
      COMPANY_ID,
      'adj-golden-1',
      expect.objectContaining({ status: 'POSTED', voucherId: null, adjustmentValueBase: 70 }),
      { id: 'txn-adj' }
    );
  });

  it('G4: voucher output is stable across repeated postings', async () => {
    const bridge1 = new CapturingBridge();
    const { useCase: useCase1, adjustment: adjustment1 } = buildUseCase(bridge1);
    await useCase1.execute(COMPANY_ID, adjustment1.id, USER_ID);

    const bridge2 = new CapturingBridge();
    const { useCase: useCase2, adjustment: adjustment2 } = buildUseCase(bridge2);
    await useCase2.execute(COMPANY_ID, adjustment2.id, USER_ID);

    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
  });
});
