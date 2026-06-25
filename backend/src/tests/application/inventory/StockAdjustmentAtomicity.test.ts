import { StockAdjustment } from '../../../domain/inventory/entities/StockAdjustment';
import { PostStockAdjustmentUseCase } from '../../../application/inventory/use-cases/StockAdjustmentUseCases';

describe('PostStockAdjustmentUseCase atomicity', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';
  const makeFullBridge = () => ({
    recordFinancialEvent: jest.fn(async () => ({ mode: 'full', voucher: { id: 'vch-1' } })),
    recordPreBuiltVoucher: jest.fn(async () => {
      throw new Error('Stock Adjustment should not send prebuilt voucher events');
    }),
  });

  const makeAdjustment = () =>
    new StockAdjustment({
      id: 'adj-1',
      companyId: COMPANY_ID,
      warehouseId: 'wh-1',
      date: '2026-04-07',
      reason: 'CORRECTION',
      notes: 'atomic test',
      lines: [
        {
          itemId: 'item-1',
          currentQty: 3,
          newQty: 5,
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

  it('runs stock, accounting, and adjustment status update in one transaction context', async () => {
    const adjustment = makeAdjustment();
    const postedAdjustment = new StockAdjustment({
      ...adjustment.toJSON(),
      status: 'POSTED',
      voucherId: 'vch-1',
      postedAt: new Date('2026-04-07T01:00:00.000Z'),
    } as any);

    const adjustmentRepo = {
      getAdjustment: jest
        .fn()
        .mockResolvedValueOnce(adjustment)
        .mockResolvedValueOnce(postedAdjustment),
      updateAdjustment: jest.fn(async () => undefined),
    };

    const itemRepo = {
      getItem: jest.fn(async () => ({
        id: 'item-1',
        companyId: COMPANY_ID,
        costCurrency: 'USD',
        inventoryAssetAccountId: 'INV-100',
        cogsAccountId: 'COGS-100',
      })),
    };

    const movementUseCase = {
      processIN: jest.fn(async () => ({ id: 'sm-in', direction: 'IN', totalCostBase: 20 })),
      processOUT: jest.fn(async () => ({ id: 'sm-out', direction: 'OUT', totalCostBase: 0 })),
      preFetchItemContext: jest.fn(async () => ({
        item: {
          id: 'item-1',
          companyId: COMPANY_ID,
          costCurrency: 'USD',
          inventoryAssetAccountId: 'INV-100',
          cogsAccountId: 'COGS-100',
        },
        baseCurrency: 'USD',
      })),
      preFetchStockLevel: jest.fn(async () => null),
    };

    const txn = { id: 'txn-1' };
    const transactionManager = {
      runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
        operation(txn)
      ),
    };

    const accountingBridge = makeFullBridge();

    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: true })),
    };

    const useCase = new PostStockAdjustmentUseCase(
      adjustmentRepo as any,
      itemRepo as any,
      movementUseCase as any,
      transactionManager as any,
      companyModuleRepo as any,
      accountingBridge as any
    );

    const result = await useCase.execute(COMPANY_ID, adjustment.id, USER_ID);

    expect(result.status).toBe('POSTED');
    expect(transactionManager.runTransaction).toHaveBeenCalledTimes(1);
    expect(movementUseCase.processIN).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        refs: expect.objectContaining({ type: 'STOCK_ADJUSTMENT', docId: adjustment.id }),
        transaction: txn,
      })
    );
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'STOCK_ADJUSTMENT', transaction: txn })
    );
    expect(adjustmentRepo.updateAdjustment).toHaveBeenCalledWith(
      COMPANY_ID,
      adjustment.id,
      expect.objectContaining({ status: 'POSTED', voucherId: 'vch-1' }),
      txn
    );
  });

  it('does not persist posted status when accounting posting fails', async () => {
    const adjustment = makeAdjustment();

    const adjustmentRepo = {
      getAdjustment: jest.fn().mockResolvedValueOnce(adjustment),
      updateAdjustment: jest.fn(async () => undefined),
    };

    const itemRepo = {
      getItem: jest.fn(async () => ({
        id: 'item-1',
        companyId: COMPANY_ID,
        costCurrency: 'USD',
        inventoryAssetAccountId: 'INV-100',
        cogsAccountId: 'COGS-100',
      })),
    };

    const movementUseCase = {
      processIN: jest.fn(async () => ({ id: 'sm-in', direction: 'IN', totalCostBase: 20 })),
      processOUT: jest.fn(async () => ({ id: 'sm-out', direction: 'OUT', totalCostBase: 0 })),
      preFetchItemContext: jest.fn(async () => ({
        item: {
          id: 'item-1',
          companyId: COMPANY_ID,
          costCurrency: 'USD',
          inventoryAssetAccountId: 'INV-100',
          cogsAccountId: 'COGS-100',
        },
        baseCurrency: 'USD',
      })),
      preFetchStockLevel: jest.fn(async () => null),
    };

    const txn = { id: 'txn-2' };
    const transactionManager = {
      runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
        operation(txn)
      ),
    };

    const accountingBridge = {
      recordFinancialEvent: jest.fn(async () => {
        throw new Error('Accounting failed');
      }),
      recordPreBuiltVoucher: jest.fn(async () => {
        throw new Error('Stock Adjustment should not send prebuilt voucher events');
      }),
    };

    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: true })),
    };

    const useCase = new PostStockAdjustmentUseCase(
      adjustmentRepo as any,
      itemRepo as any,
      movementUseCase as any,
      transactionManager as any,
      companyModuleRepo as any,
      accountingBridge as any
    );

    await expect(useCase.execute(COMPANY_ID, adjustment.id, USER_ID)).rejects.toThrow('Accounting failed');
    expect(movementUseCase.processIN).toHaveBeenCalled();
    expect(adjustmentRepo.updateAdjustment).not.toHaveBeenCalled();
  });
});

