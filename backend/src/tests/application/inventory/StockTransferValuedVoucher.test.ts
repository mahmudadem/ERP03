import { CompleteStockTransferUseCase } from '../../../application/inventory/use-cases/StockTransferUseCases';
import { StockTransfer } from '../../../domain/inventory/entities/StockTransfer';

/**
 * Locks the VALUED stock-transfer GL posting: the cost uplift (landed − source)
 * is capitalized into inventory (Dr) against the Inventory Transfer Clearing
 * account (Cr). FLAT transfers post nothing.
 */
describe('CompleteStockTransferUseCase — valued transfer uplift voucher', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';

  const makeTransfer = (mode: 'FLAT' | 'VALUED') =>
    new StockTransfer({
      id: 'trf-1',
      companyId: COMPANY_ID,
      sourceWarehouseId: 'wh-A',
      destinationWarehouseId: 'wh-B',
      date: '2026-05-01',
      mode,
      lines: [{ itemId: 'item-1', qty: 5, unitCostBaseAtTransfer: 400, unitCostCCYAtTransfer: 400 }],
      status: 'DRAFT',
      transferPairId: 'pair-1',
      createdBy: USER_ID,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    });

  const buildDeps = (mode: 'FLAT' | 'VALUED') => {
    const transfer = makeTransfer(mode);
    const transferRepo = {
      getTransfer: jest
        .fn()
        .mockResolvedValueOnce(transfer)
        .mockResolvedValueOnce(new StockTransfer({ ...transfer.toJSON(), status: 'COMPLETED' } as any)),
      updateTransfer: jest.fn(async () => undefined),
    };
    const itemRepo = {
      getItem: jest.fn(async () => ({ id: 'item-1', companyId: COMPANY_ID, code: 'ITM-1', inventoryAssetAccountId: 'INV-100' })),
    };
    const stockLevelRepo = { getLevel: jest.fn(async () => null) };
    const movementUseCase = {
      // source issues at 320, destination lands at the 400 override → uplift 5*(400-320)=400.
      processTRANSFER: jest.fn(async () => ({
        outMov: { unitCostBase: 320, unitCostCCY: 320, totalCostBase: 1600 },
        inMov: { unitCostBase: 400, unitCostCCY: 400, totalCostBase: 2000 },
      })),
      preFetchItemContext: jest.fn(async () => ({ item: { id: 'item-1' }, baseCurrency: 'USD' })),
    };
    const transactionManager = {
      runTransaction: jest.fn(async (op: (t: unknown) => Promise<unknown>) => op({ id: 'txn' })),
    };
    const companyModuleRepo = { get: jest.fn(async () => ({ initialized: true })) };
    const inventorySettingsRepo = {
      getSettings: jest.fn(async () => ({ defaultInventoryTransferClearingAccountId: 'CLR-900', defaultInventoryAssetAccountId: 'INV-DEFAULT' })),
    };
    const accountingPostingService = { postInTransaction: jest.fn(async () => ({ id: 'vch-trf' })) };

    const useCase = new CompleteStockTransferUseCase(
      transferRepo as any,
      itemRepo as any,
      stockLevelRepo as any,
      movementUseCase as any,
      transactionManager as any,
      companyModuleRepo as any,
      inventorySettingsRepo as any,
      accountingPostingService as any
    );
    return { useCase, accountingPostingService, transferRepo };
  };

  it('capitalizes the uplift: Dr Inventory / Cr Transfer Clearing', async () => {
    const { useCase, accountingPostingService } = buildDeps('VALUED');
    await useCase.execute(COMPANY_ID, 'trf-1', USER_ID);

    expect(accountingPostingService.postInTransaction).toHaveBeenCalledTimes(1);
    const payload = (accountingPostingService.postInTransaction as jest.Mock).mock.calls[0][0];
    const lines = payload.lines as Array<any>;

    const debit = lines.find((l) => l.side === 'Debit');
    const credit = lines.find((l) => l.side === 'Credit');
    expect(debit.accountId).toBe('INV-100');
    expect(debit.baseAmount).toBe(400);
    expect(debit.amount).toBe(400);
    expect(debit.currency).toBe('USD');
    expect(debit.exchangeRate).toBe(1);
    expect(credit.accountId).toBe('CLR-900');
    expect(credit.baseAmount).toBe(400);
    expect(credit.amount).toBe(400);
    expect(credit.currency).toBe('USD');
    expect(credit.exchangeRate).toBe(1);
  });

  it('posts no voucher for a FLAT transfer', async () => {
    const { useCase, accountingPostingService } = buildDeps('FLAT');
    await useCase.execute(COMPANY_ID, 'trf-1', USER_ID);
    expect(accountingPostingService.postInTransaction).not.toHaveBeenCalled();
  });
});
