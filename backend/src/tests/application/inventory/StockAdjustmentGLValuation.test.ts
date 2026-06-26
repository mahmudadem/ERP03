import { StockAdjustment } from '../../../domain/inventory/entities/StockAdjustment';
import { PostStockAdjustmentUseCase } from '../../../application/inventory/use-cases/StockAdjustmentUseCases';

/**
 * Locks the GP02 inventory-stabilization money-path fixes (F1 + F3):
 *  - F1: the GL voucher is valued from the ACTUAL posted movement
 *        (`movement.totalCostBase`), never from the user-typed unit cost.
 *  - F3: the offset uses the dedicated Inventory Gain/Loss accounts from
 *        Inventory Settings, falling back to the item COGS account only when
 *        no dedicated account is configured.
 */
describe('PostStockAdjustmentUseCase — GL valuation & gain/loss routing', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';
  const makeFullBridge = () => ({
    recordFinancialEvent: jest.fn(async () => ({ mode: 'full', voucher: { id: 'vch-1' } })),
    recordPreBuiltVoucher: jest.fn(async () => {
      throw new Error('Stock Adjustment should not send prebuilt voucher events');
    }),
  });

  const ITEM = {
    id: 'item-1',
    companyId: COMPANY_ID,
    code: 'ITM-1',
    costCurrency: 'USD',
    inventoryAssetAccountId: 'INV-100',
    cogsAccountId: 'COGS-100',
  };

  const buildHarness = (opts: {
    adjustmentQty: number;
    /** What the engine actually posted to the stock ledger (base currency). */
    movementTotalCostBase: number;
    /** Bogus user-typed unit cost that must NOT drive the GL. */
    typedUnitCost: number;
    settings: any;
  }) => {
    const adjustment = new StockAdjustment({
      id: 'adj-1',
      companyId: COMPANY_ID,
      warehouseId: 'wh-1',
      date: '2026-04-07',
      reason: opts.adjustmentQty < 0 ? 'DAMAGE' : 'FOUND',
      lines: [
        {
          itemId: ITEM.id,
          currentQty: 10,
          newQty: 10 + opts.adjustmentQty,
          adjustmentQty: opts.adjustmentQty,
          unitCostBase: opts.typedUnitCost,
          unitCostCCY: opts.typedUnitCost,
        },
      ],
      status: 'DRAFT',
      adjustmentValueBase: Math.abs(opts.adjustmentQty) * opts.typedUnitCost,
      createdBy: USER_ID,
      createdAt: new Date('2026-04-07T00:00:00.000Z'),
    });

    const direction = opts.adjustmentQty < 0 ? 'OUT' : 'IN';
    const movement = { id: 'sm-1', direction, totalCostBase: opts.movementTotalCostBase };

    const adjustmentRepo = {
      getAdjustment: jest
        .fn()
        .mockResolvedValueOnce(adjustment)
        .mockResolvedValueOnce(
          new StockAdjustment({ ...adjustment.toJSON(), status: 'POSTED', voucherId: 'vch-1' } as any)
        ),
      updateAdjustment: jest.fn(async () => undefined),
    };

    const movementUseCase = {
      processIN: jest.fn(async () => movement),
      processOUT: jest.fn(async () => movement),
      preFetchItemContext: jest.fn(async () => ({ item: ITEM, baseCurrency: 'USD' })),
      preFetchStockLevel: jest.fn(async () => null),
    };

    const transactionManager = {
      runTransaction: jest.fn(async (op: (t: unknown) => Promise<unknown>) => op({ id: 'txn' })),
    };

    const accountingBridge = makeFullBridge();

    const companyModuleRepo = { get: jest.fn(async () => ({ initialized: true })) };
    const inventorySettingsRepo = { getSettings: jest.fn(async () => opts.settings) };

    const useCase = new PostStockAdjustmentUseCase(
      adjustmentRepo as any,
      { getItem: jest.fn(async () => ITEM) } as any,
      movementUseCase as any,
      transactionManager as any,
      companyModuleRepo as any,
      accountingBridge as any,
      inventorySettingsRepo as any
    );

    return { useCase, adjustment, accountingBridge, adjustmentRepo };
  };

  it('values an OUT adjustment from the real avg cost (not the typed cost) and debits the Loss account', async () => {
    const { useCase, accountingBridge, adjustmentRepo } = buildHarness({
      adjustmentQty: -4,
      movementTotalCostBase: 50, // real avg cost: 4 units @ 12.50
      typedUnitCost: 999, // bogus — would have produced 3996 under the old bug
      settings: {
        defaultInventoryLossAccountId: 'LOSS-900',
        defaultInventoryGainAccountId: 'GAIN-800',
        defaultInventoryAssetAccountId: 'INV-DEFAULT',
      },
    });

    await useCase.execute(COMPANY_ID, 'adj-1', USER_ID);

    const payload = ((accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const lines = payload.lines as Array<any>;

    const debit = lines.find((l) => l.side === 'Debit');
    const credit = lines.find((l) => l.side === 'Credit');

    // F1: amount is the engine cost (50), never 999 * 4 = 3996.
    expect(debit.baseAmount).toBe(50);
    expect(credit.baseAmount).toBe(50);
    expect(debit.amount).toBe(50);
    expect(credit.amount).toBe(50);
    expect(debit.currency).toBe('USD');
    expect(credit.currency).toBe('USD');
    expect(debit.exchangeRate).toBe(1);
    expect(credit.exchangeRate).toBe(1);
    // F3: write-down debits Loss, credits Inventory Asset.
    expect(debit.accountId).toBe('LOSS-900');
    expect(credit.accountId).toBe('INV-100');

    // The stored adjustment value is restated to the real posted value.
    expect(adjustmentRepo.updateAdjustment).toHaveBeenCalledWith(
      COMPANY_ID,
      'adj-1',
      expect.objectContaining({ status: 'POSTED', adjustmentValueBase: 50 }),
      expect.anything()
    );
  });

  it('credits the Gain account on an IN write-up valued from the applied cost', async () => {
    const { useCase, accountingBridge } = buildHarness({
      adjustmentQty: 4,
      movementTotalCostBase: 40,
      typedUnitCost: 10,
      settings: {
        defaultInventoryLossAccountId: 'LOSS-900',
        defaultInventoryGainAccountId: 'GAIN-800',
      },
    });

    await useCase.execute(COMPANY_ID, 'adj-1', USER_ID);

    const payload = ((accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const lines = payload.lines as Array<any>;
    const debit = lines.find((l) => l.side === 'Debit');
    const credit = lines.find((l) => l.side === 'Credit');

    expect(debit.accountId).toBe('INV-100'); // Dr Inventory Asset
    expect(credit.accountId).toBe('GAIN-800'); // Cr Inventory Gain
    expect(debit.baseAmount).toBe(40);
    expect(credit.baseAmount).toBe(40);
    expect(debit.amount).toBe(40);
    expect(credit.amount).toBe(40);
  });

  it('falls back to the item COGS account when no dedicated gain/loss account is set', async () => {
    const { useCase, accountingBridge } = buildHarness({
      adjustmentQty: -2,
      movementTotalCostBase: 25,
      typedUnitCost: 12.5,
      settings: { defaultInventoryAssetAccountId: 'INV-DEFAULT' }, // no gain/loss configured
    });

    await useCase.execute(COMPANY_ID, 'adj-1', USER_ID);

    const payload = ((accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const lines = payload.lines as Array<any>;
    const debit = lines.find((l) => l.side === 'Debit');

    expect(debit.accountId).toBe('COGS-100'); // graceful fallback to item COGS
    expect(debit.baseAmount).toBe(25);
  });

  it('skips GL posting entirely in periodic mode while still posting the stock adjustment', async () => {
    const adjustment = new StockAdjustment({
      id: 'adj-periodic-1',
      companyId: COMPANY_ID,
      warehouseId: 'wh-1',
      date: '2026-04-07',
      reason: 'FOUND',
      lines: [
        {
          itemId: ITEM.id,
          currentQty: 10,
          newQty: 12,
          adjustmentQty: 2,
          unitCostBase: 10,
          unitCostCCY: 10,
        },
      ],
      status: 'DRAFT',
      adjustmentValueBase: 20,
      createdBy: USER_ID,
      createdAt: new Date('2026-04-07T00:00:00.000Z'),
    });

    const adjustmentRepo = {
      getAdjustment: jest
        .fn()
        .mockResolvedValueOnce(adjustment)
        .mockResolvedValueOnce(
          new StockAdjustment({ ...adjustment.toJSON(), status: 'POSTED', voucherId: null } as any)
        ),
      updateAdjustment: jest.fn(async () => undefined),
    };

    const movementUseCase = {
      processIN: jest.fn(async () => ({ id: 'sm-periodic-1', direction: 'IN', totalCostBase: 20 })),
      processOUT: jest.fn(async () => ({ id: 'sm-periodic-out', direction: 'OUT', totalCostBase: 0 })),
      preFetchItemContext: jest.fn(async () => ({ item: ITEM, baseCurrency: 'USD' })),
      preFetchStockLevel: jest.fn(async () => null),
    };

    const accountingBridge = makeFullBridge();

    const useCase = new PostStockAdjustmentUseCase(
      adjustmentRepo as any,
      { getItem: jest.fn(async () => ITEM) } as any,
      movementUseCase as any,
      { runTransaction: jest.fn(async (op: (t: unknown) => Promise<unknown>) => op({ id: 'txn-periodic' })) } as any,
      { get: jest.fn(async () => ({ initialized: true })) } as any,
      accountingBridge as any,
      { getSettings: jest.fn(async () => ({ accountingMode: 'PERIODIC', inventoryAccountingMethod: 'PERIODIC' })) } as any
    );

    const posted = await useCase.execute(COMPANY_ID, adjustment.id, USER_ID);

    expect(posted.status).toBe('POSTED');
    expect(movementUseCase.processIN).toHaveBeenCalledTimes(1);
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
    expect(adjustmentRepo.updateAdjustment).toHaveBeenCalledWith(
      COMPANY_ID,
      adjustment.id,
      expect.objectContaining({ status: 'POSTED', voucherId: null, adjustmentValueBase: 20 }),
      expect.anything()
    );
  });
});
