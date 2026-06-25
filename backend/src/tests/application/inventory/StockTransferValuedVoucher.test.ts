import {
  CompleteStockTransferUseCase,
  CreateStockTransferUseCase,
} from '../../../application/inventory/use-cases/StockTransferUseCases';
import { StockTransfer } from '../../../domain/inventory/entities/StockTransfer';

/**
 * Locks stock-transfer valuation posting. Value beyond source cost must come
 * from explicit added cost or explicit revaluation, never inferred IN − OUT.
 */
describe('CompleteStockTransferUseCase — journaled stock transfer valuation voucher', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';
  const makeFullBridge = () => ({
    recordFinancialEvent: jest.fn(async () => ({ mode: 'full', voucher: { id: 'vch-trf' } })),
    recordPreBuiltVoucher: jest.fn(async () => {
      throw new Error('Stock Transfer should not send prebuilt voucher events');
    }),
  });

  const makeTransfer = (
    mode: 'FLAT' | 'VALUED',
    lineOverrides: Partial<StockTransfer['lines'][number]> = {}
  ) =>
    new StockTransfer({
      id: 'trf-1',
      companyId: COMPANY_ID,
      sourceWarehouseId: 'wh-A',
      destinationWarehouseId: 'wh-B',
      date: '2026-05-01',
      mode,
      lines: [{
        itemId: 'item-1',
        qty: 5,
        unitCostBaseAtTransfer: 320,
        unitCostCCYAtTransfer: 320,
        ...lineOverrides,
      }],
      status: 'DRAFT',
      transferPairId: 'pair-1',
      createdBy: USER_ID,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    });

  const buildDeps = (
    mode: 'FLAT' | 'VALUED',
    lineOverrides: Partial<StockTransfer['lines'][number]> = {},
    movementCosts = { out: 320, in: 320 },
    settingsOverrides: Record<string, any> = {}
  ) => {
    const transfer = makeTransfer(mode, lineOverrides);
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
        outMov: { unitCostBase: movementCosts.out, unitCostCCY: movementCosts.out, totalCostBase: movementCosts.out * 5 },
        inMov: { unitCostBase: movementCosts.in, unitCostCCY: movementCosts.in, totalCostBase: movementCosts.in * 5 },
      })),
      preFetchItemContext: jest.fn(async () => ({ item: { id: 'item-1' }, baseCurrency: 'USD' })),
    };
    const transactionManager = {
      runTransaction: jest.fn(async (op: (t: unknown) => Promise<unknown>) => op({ id: 'txn' })),
    };
    const companyModuleRepo = { get: jest.fn(async () => ({ initialized: true })) };
    const inventorySettingsRepo = {
      getSettings: jest.fn(async () => ({
        defaultInventoryTransferClearingAccountId: 'CLR-900',
        defaultInventoryRevaluationAccountId: 'REV-700',
        defaultInventoryAssetAccountId: 'INV-DEFAULT',
        ...settingsOverrides,
      })),
    };
    const accountingBridge = makeFullBridge();

    const useCase = new CompleteStockTransferUseCase(
      transferRepo as any,
      itemRepo as any,
      stockLevelRepo as any,
      movementUseCase as any,
      transactionManager as any,
      companyModuleRepo as any,
      inventorySettingsRepo as any,
      accountingBridge as any
    );
    return { useCase, accountingBridge, transferRepo };
  };

  it('capitalizes explicit added cost: Dr Inventory / Cr Transfer Clearing', async () => {
    const { useCase, accountingBridge } = buildDeps(
      'VALUED',
      { addedCostBaseAtTransfer: 400, addedCostCCYAtTransfer: 400 },
      { out: 320, in: 400 }
    );
    await useCase.execute(COMPANY_ID, 'trf-1', USER_ID);

    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledTimes(1);
    const payload = ((accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
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

  it('posts explicit revaluation to the dedicated revaluation account', async () => {
    const { useCase, accountingBridge } = buildDeps(
      'VALUED',
      { revaluationUnitCostBaseAtTransfer: 400, revaluationUnitCostCCYAtTransfer: 400 },
      { out: 320, in: 400 }
    );
    await useCase.execute(COMPANY_ID, 'trf-1', USER_ID);

    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledTimes(1);
    const payload = ((accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const lines = payload.lines as Array<any>;

    const debit = lines.find((l) => l.metadata.role === 'inventory-revaluation');
    const credit = lines.find((l) => l.metadata.role === 'inventory-revaluation-variance');
    expect(debit.accountId).toBe('INV-100');
    expect(debit.side).toBe('Debit');
    expect(debit.baseAmount).toBe(400);
    expect(credit.accountId).toBe('REV-700');
    expect(credit.side).toBe('Credit');
    expect(credit.baseAmount).toBe(400);
  });

  it('requires transfer clearing for explicit added-cost transfers', async () => {
    const { useCase } = buildDeps(
      'VALUED',
      { addedCostBaseAtTransfer: 400, addedCostCCYAtTransfer: 400 },
      { out: 320, in: 400 },
      { defaultInventoryTransferClearingAccountId: undefined }
    );

    await expect(useCase.execute(COMPANY_ID, 'trf-1', USER_ID)).rejects.toThrow(
      'Inventory Transfer Clearing account'
    );
  });

  it('requires the dedicated revaluation account for explicit revaluation transfers', async () => {
    const { useCase } = buildDeps(
      'VALUED',
      { revaluationUnitCostBaseAtTransfer: 400, revaluationUnitCostCCYAtTransfer: 400 },
      { out: 320, in: 400 },
      { defaultInventoryRevaluationAccountId: undefined }
    );

    await expect(useCase.execute(COMPANY_ID, 'trf-1', USER_ID)).rejects.toThrow(
      'Inventory Revaluation account'
    );
  });

  it('posts no voucher for a VALUED transfer without explicit added cost or revaluation', async () => {
    const { useCase, accountingBridge } = buildDeps('VALUED');
    await useCase.execute(COMPANY_ID, 'trf-1', USER_ID);
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('posts no voucher for a FLAT transfer', async () => {
    const { useCase, accountingBridge } = buildDeps('FLAT');
    await useCase.execute(COMPANY_ID, 'trf-1', USER_ID);
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  describe('CreateStockTransferUseCase explicit costing input', () => {
    const buildCreate = () => {
      const transferRepo = { createTransfer: jest.fn(async () => undefined) };
      const warehouseRepo = {
        getWarehouse: jest.fn(async (id: string) => ({ id, companyId: COMPANY_ID })),
      };
      const itemRepo = {
        getItem: jest.fn(async () => ({
          id: 'item-1',
          companyId: COMPANY_ID,
          code: 'ITM-1',
          trackInventory: true,
        })),
      };
      const stockLevelRepo = {
        getLevel: jest.fn(async () => ({
          qtyOnHand: 10,
          avgCostBase: 320,
          avgCostCCY: 320,
          lastCostBase: 320,
          lastCostCCY: 320,
        })),
      };
      return new CreateStockTransferUseCase(transferRepo as any, warehouseRepo as any, itemRepo as any, stockLevelRepo as any);
    };

    const baseInput = {
      companyId: COMPANY_ID,
      sourceWarehouseId: 'wh-A',
      destinationWarehouseId: 'wh-B',
      date: '2026-05-01',
      mode: 'VALUED' as const,
      createdBy: USER_ID,
    };

    it('rejects old implicit landed-cost overrides', async () => {
      await expect(buildCreate().buildDraft({
        ...baseInput,
        lines: [{ itemId: 'item-1', qty: 1, unitCostBaseAtTransfer: 400 }],
      })).rejects.toThrow('landed cost is no longer accepted');
    });

    it('preserves explicit revaluation separately from the source cost snapshot', async () => {
      const draft = await buildCreate().buildDraft({
        ...baseInput,
        lines: [{ itemId: 'item-1', qty: 1, revaluationUnitCostBaseAtTransfer: 400 }],
      });

      expect(draft.lines[0].unitCostBaseAtTransfer).toBe(320);
      expect(draft.lines[0].revaluationUnitCostBaseAtTransfer).toBe(400);
    });
  });
});
