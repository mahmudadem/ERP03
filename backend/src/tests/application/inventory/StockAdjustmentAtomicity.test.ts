import { StockAdjustment } from '../../../domain/inventory/entities/StockAdjustment';
import { PostStockAdjustmentUseCase } from '../../../application/inventory/use-cases/StockAdjustmentUseCases';

describe('PostStockAdjustmentUseCase atomicity', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';

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
      processIN: jest.fn(async () => undefined),
      processOUT: jest.fn(async () => undefined),
    };

    const txn = { id: 'txn-1' };
    const transactionManager = {
      runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
        operation(txn)
      ),
    };

    const accountingPostingService = {
      postInTransaction: jest.fn(async () => ({ id: 'vch-1' })),
    };

    const useCase = new PostStockAdjustmentUseCase(
      adjustmentRepo as any,
      itemRepo as any,
      movementUseCase as any,
      transactionManager as any,
      accountingPostingService as any
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
    expect(accountingPostingService.postInTransaction).toHaveBeenCalledWith(expect.any(Object), txn);
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
      processIN: jest.fn(async () => undefined),
      processOUT: jest.fn(async () => undefined),
    };

    const txn = { id: 'txn-2' };
    const transactionManager = {
      runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
        operation(txn)
      ),
    };

    const accountingPostingService = {
      postInTransaction: jest.fn(async () => {
        throw new Error('Accounting failed');
      }),
    };

    const useCase = new PostStockAdjustmentUseCase(
      adjustmentRepo as any,
      itemRepo as any,
      movementUseCase as any,
      transactionManager as any,
      accountingPostingService as any
    );

    await expect(useCase.execute(COMPANY_ID, adjustment.id, USER_ID)).rejects.toThrow('Accounting failed');
    expect(movementUseCase.processIN).toHaveBeenCalled();
    expect(adjustmentRepo.updateAdjustment).not.toHaveBeenCalled();
  });
});

