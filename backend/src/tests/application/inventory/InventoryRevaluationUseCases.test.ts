import { InventoryRevaluation } from '../../../domain/inventory/entities/InventoryRevaluation';
import {
  CreateInventoryRevaluationUseCase,
  GetInventoryRevaluationUseCase,
  ListInventoryRevaluationsUseCase,
  PostInventoryRevaluationUseCase,
} from '../../../application/inventory/use-cases/InventoryRevaluationUseCases';

const COMPANY_ID = 'cmp-223';
const USER_ID = 'u-223';

const buildItem = (overrides: Partial<any> = {}) => ({
  id: 'item-1',
  companyId: COMPANY_ID,
  code: 'ITM-1',
  costCurrency: 'SYP',
  inventoryAssetAccountId: 'INV-100',
  costingStats: {
    avgCost: { base: 0, ccy: 0, currency: 'SYP', fxRateToBase: 1, asOf: '2026-06-19' },
  },
  ...overrides,
});

const buildLevel = (overrides: Partial<any> = {}) => ({
  id: 'item-1_wh-1',
  companyId: COMPANY_ID,
  itemId: 'item-1',
  warehouseId: 'wh-1',
  qtyOnHand: 100,
  reservedQty: 0,
  avgCostBase: 12.5,
  avgCostCCY: 12.5,
  lastCostBase: 12.5,
  lastCostCCY: 12.5,
  postingSeq: 1,
  maxBusinessDate: '2026-06-19',
  totalMovements: 1,
  lastMovementId: 'm-1',
  version: 1,
  updatedAt: new Date(),
  ...overrides,
});

describe('CreateInventoryRevaluationUseCase', () => {
  it('computes valueDelta = qty * (newAvg - currentAvg) and refuses zero-delta submissions', async () => {
    const item = buildItem();
    const revaluationRepo = { createRevaluation: jest.fn(async () => undefined) };
    const itemRepo = { getItem: jest.fn(async () => item) };
    const level = buildLevel();
    const stockLevelRepo = {
      getLevel: jest.fn(async () => level),
      getLevelsByItem: jest.fn(async () => [level]),
    };
    const settings = {
      costingBasis: 'WAREHOUSE',
      defaultInventoryRevaluationAccountId: 'REV-900',
    };
    const inventorySettingsRepo = { getSettings: jest.fn(async () => settings) };

    const useCase = new CreateInventoryRevaluationUseCase(
      revaluationRepo as any,
      itemRepo as any,
      stockLevelRepo as any,
      inventorySettingsRepo as any
    );

    const created = await useCase.execute({
      companyId: COMPANY_ID,
      date: '2026-06-19',
      reason: 'COST_CORRECTION',
      notes: 'fix wrong avg cost',
      createdBy: USER_ID,
      lines: [
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          newAvgCostBase: 13,
          newAvgCostCCY: 13,
        },
      ],
    });

    expect(revaluationRepo.createRevaluation).toHaveBeenCalledTimes(1);
    expect(created.status).toBe('DRAFT');
    expect(created.lines[0].qtyOnHand).toBe(100);
    expect(created.lines[0].currentAvgCostBase).toBe(12.5);
    expect(created.lines[0].valueDeltaBase).toBe(50);
    expect(created.totalValueDeltaBase).toBe(50);

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        date: '2026-06-19',
        reason: 'COST_CORRECTION',
        createdBy: USER_ID,
        lines: [
          { itemId: 'item-1', warehouseId: 'wh-1', newAvgCostBase: 12.5, newAvgCostCCY: 12.5 },
        ],
      })
    ).rejects.toThrow(/zero value delta/);
  });

  it('uses the company-wide average under GLOBAL costing and refuses warehouseId on lines', async () => {
    const item = buildItem();
    const revaluationRepo = { createRevaluation: jest.fn(async () => undefined) };
    const itemRepo = { getItem: jest.fn(async () => item) };
    const wh1 = buildLevel({ warehouseId: 'wh-1', qtyOnHand: 100, avgCostBase: 10, avgCostCCY: 10 });
    const wh2 = buildLevel({
      id: 'item-1_wh-2',
      warehouseId: 'wh-2',
      qtyOnHand: 100,
      avgCostBase: 14,
      avgCostCCY: 14,
    });
    const stockLevelRepo = {
      getLevel: jest.fn(),
      getLevelsByItem: jest.fn(async () => [wh1, wh2]),
    };
    const settings = { costingBasis: 'GLOBAL' };
    const inventorySettingsRepo = { getSettings: jest.fn(async () => settings) };

    const useCase = new CreateInventoryRevaluationUseCase(
      revaluationRepo as any,
      itemRepo as any,
      stockLevelRepo as any,
      inventorySettingsRepo as any
    );

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        date: '2026-06-19',
        reason: 'COST_CORRECTION',
        createdBy: USER_ID,
        lines: [
          { itemId: 'item-1', warehouseId: 'wh-1', newAvgCostBase: 15, newAvgCostCCY: 15 },
        ],
      })
    ).rejects.toThrow(/GLOBAL/);

    const created = await useCase.execute({
      companyId: COMPANY_ID,
      date: '2026-06-19',
      reason: 'COST_CORRECTION',
      createdBy: USER_ID,
      lines: [
        { itemId: 'item-1', newAvgCostBase: 15, newAvgCostCCY: 15 },
      ],
    });

    expect(created.lines[0].qtyOnHand).toBe(200);
    expect(created.lines[0].currentAvgCostBase).toBe(12);
    expect(created.lines[0].valueDeltaBase).toBe(600);
  });
});

describe('PostInventoryRevaluationUseCase', () => {
  const buildRevaluation = (overrides: Partial<any> = {}) =>
    new InventoryRevaluation({
      id: 'rev-1',
      companyId: COMPANY_ID,
      date: '2026-06-19',
      reason: 'COST_CORRECTION',
      lines: [
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          qtyOnHand: 100,
          currentAvgCostBase: 12.5,
          currentAvgCostCCY: 12.5,
          newAvgCostBase: 13,
          newAvgCostCCY: 13,
          valueDeltaBase: 50,
          valueDeltaCCY: 50,
        },
      ],
      status: 'DRAFT',
      totalValueDeltaBase: 50,
      totalValueDeltaCCY: 50,
      createdBy: USER_ID,
      createdAt: new Date('2026-06-19T00:00:00.000Z'),
      ...overrides,
    });

  const buildHarness = (overrides: {
    revaluation?: InventoryRevaluation;
    level?: any;
    settings?: any;
    accountingEnabled?: boolean;
  }) => {
    const revaluation = overrides.revaluation || buildRevaluation();
    const level = overrides.level || buildLevel();
    const settings = overrides.settings === undefined
      ? {
          costingBasis: 'WAREHOUSE',
          defaultInventoryRevaluationAccountId: 'REV-900',
          defaultInventoryAssetAccountId: 'INV-DEFAULT',
        }
      : overrides.settings;

    const revaluationRepo = {
      getRevaluation: jest.fn(async () => revaluation),
      updateRevaluation: jest.fn(async () => undefined),
    };
    const item = buildItem();
    const itemRepo = {
      getItem: jest.fn(async () => item),
      updateItemInTransaction: jest.fn(async () => undefined),
    };
    const stockLevelRepo = {
      getLevelInTransaction: jest.fn(async () => level),
      getLevelsByItemInTransaction: jest.fn(async () => [level]),
      upsertLevelInTransaction: jest.fn(async () => undefined),
    };
    const inventorySettingsRepo = { getSettings: jest.fn(async () => settings) };
    const transactionManager = {
      runTransaction: jest.fn(async (op: (t: unknown) => Promise<unknown>) => op({ id: 'txn' })),
    };
    const companyModuleRepo = {
      get: jest.fn(async () => ({ initialized: overrides.accountingEnabled !== false })),
    };
    const accountingPostingService = {
      postInTransaction: jest.fn(async () => ({ id: 'vch-1' })),
    };

    return {
      revaluation,
      revaluationRepo,
      itemRepo,
      stockLevelRepo,
      inventorySettingsRepo,
      transactionManager,
      companyModuleRepo,
      accountingPostingService,
      item,
    };
  };

  it('recomputes valueDelta inside the transaction, posts the GL voucher, and writes stock levels + item costing stats in one atomic step', async () => {
    const draft = buildRevaluation();
    const posted = new InventoryRevaluation({
      ...draft.toJSON(),
      status: 'POSTED',
      voucherId: 'vch-1',
      postedAt: new Date('2026-06-19T01:00:00.000Z'),
    } as any);
    const h = buildHarness({});
    h.revaluationRepo.getRevaluation = jest
      .fn()
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(posted);
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    const result = await useCase.execute(COMPANY_ID, draft.id, USER_ID);

    expect(h.transactionManager.runTransaction).toHaveBeenCalledTimes(1);
    expect(h.accountingPostingService.postInTransaction).toHaveBeenCalledTimes(1);

    const voucherArgs = (h.accountingPostingService.postInTransaction as jest.Mock).mock.calls[0][0];
    expect(voucherArgs.metadata.sourceModule).toBe('inventory');
    expect(voucherArgs.metadata.referenceType).toBe('INVENTORY_REVALUATION');
    expect(voucherArgs.voucherNo).toBe('REV-rev-1');
    const lines = voucherArgs.lines as Array<any>;
    const debit = lines.find((l) => l.side === 'Debit');
    const credit = lines.find((l) => l.side === 'Credit');
    expect(debit.accountId).toBe('INV-100');
    expect(credit.accountId).toBe('REV-900');
    expect(debit.baseAmount).toBe(50);

    expect(h.stockLevelRepo.upsertLevelInTransaction).toHaveBeenCalledTimes(1);
    const levelWrite = (h.stockLevelRepo.upsertLevelInTransaction as jest.Mock).mock.calls[0][1];
    expect(levelWrite.avgCostBase).toBe(13);

    expect(h.itemRepo.updateItemInTransaction).toHaveBeenCalledTimes(1);
    const itemWrite = (h.itemRepo.updateItemInTransaction as jest.Mock).mock.calls[0][2];
    expect(itemWrite.costingStats.avgCost.base).toBe(13);
    expect(itemWrite.costingStats.avgCost.source?.refType).toBe('INVENTORY_REVALUATION');

    expect(h.revaluationRepo.updateRevaluation).toHaveBeenCalledWith(
      COMPANY_ID,
      draft.id,
      expect.objectContaining({
        status: 'POSTED',
        voucherId: 'vch-1',
        totalValueDeltaBase: 50,
      }),
      expect.anything()
    );

    expect(result.status).toBe('POSTED');
    expect(result.voucherId).toBe('vch-1');
  });

  it('refuses to post when no inventory revaluation account is configured', async () => {
    const h = buildHarness({
      settings: { costingBasis: 'WAREHOUSE', defaultInventoryRevaluationAccountId: undefined },
    });
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    await expect(useCase.execute(COMPANY_ID, h.revaluation.id, USER_ID)).rejects.toThrow(
      /no Inventory Revaluation \/ Variance account is configured/
    );

    expect(h.accountingPostingService.postInTransaction).not.toHaveBeenCalled();
    expect(h.revaluationRepo.updateRevaluation).not.toHaveBeenCalled();
  });

  it('routes a write-down through Dr Revaluation / Cr Asset', async () => {
    const revaluation = buildRevaluation({
      lines: [
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          qtyOnHand: 100,
          currentAvgCostBase: 12.5,
          currentAvgCostCCY: 12.5,
          newAvgCostBase: 10,
          newAvgCostCCY: 10,
          valueDeltaBase: -250,
          valueDeltaCCY: -250,
        },
      ],
      totalValueDeltaBase: -250,
      totalValueDeltaCCY: -250,
    });
    const h = buildHarness({ revaluation });
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    await useCase.execute(COMPANY_ID, h.revaluation.id, USER_ID);

    const voucherArgs = (h.accountingPostingService.postInTransaction as jest.Mock).mock.calls[0][0];
    const lines = voucherArgs.lines as Array<any>;
    const debit = lines.find((l) => l.side === 'Debit');
    const credit = lines.find((l) => l.side === 'Credit');
    expect(debit.accountId).toBe('REV-900');
    expect(credit.accountId).toBe('INV-100');
    expect(debit.baseAmount).toBe(250);
    expect(debit.metadata.direction).toBe('WRITE_DOWN');
  });

  it('skips GL posting in PERIODIC mode (qty never changes; the revaluation is sub-ledger only)', async () => {
    const draft = buildRevaluation();
    const posted = new InventoryRevaluation({
      ...draft.toJSON(),
      status: 'POSTED',
      voucherId: undefined,
      postedAt: new Date('2026-06-19T01:00:00.000Z'),
    } as any);
    const h = buildHarness({
      revaluation: draft,
      settings: {
        costingBasis: 'WAREHOUSE',
        accountingMode: 'PERIODIC',
        defaultInventoryRevaluationAccountId: 'REV-900',
      },
    });
    h.revaluationRepo.getRevaluation = jest
      .fn()
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(posted);
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    const result = await useCase.execute(COMPANY_ID, draft.id, USER_ID);

    expect(h.accountingPostingService.postInTransaction).not.toHaveBeenCalled();
    expect(result.status).toBe('POSTED');
    expect(result.voucherId).toBeUndefined();
    expect(h.stockLevelRepo.upsertLevelInTransaction).toHaveBeenCalledTimes(1);
  });

  it('refuses to re-post an already POSTED revaluation', async () => {
    const revaluation = buildRevaluation({ status: 'POSTED' });
    const h = buildHarness({ revaluation });
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    await expect(useCase.execute(COMPANY_ID, h.revaluation.id, USER_ID)).rejects.toThrow(
      /Only DRAFT inventory revaluations can be posted/
    );
  });

  it('rolls back level writes and item costing stats when the GL posting fails (no half-posted state)', async () => {
    const revaluation = buildRevaluation();
    const h = buildHarness({ revaluation });
    h.accountingPostingService.postInTransaction = jest.fn(async () => {
      throw new Error('PERIOD_LOCKED: 2026-06-19 is in a closed period');
    });
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    await expect(useCase.execute(COMPANY_ID, h.revaluation.id, USER_ID)).rejects.toThrow(
      /Failed to create GL voucher for revaluation/
    );

    expect(h.revaluationRepo.updateRevaluation).not.toHaveBeenCalled();
  });

  it('honors GLOBAL costing by re-pricing every warehouse to the new company average', async () => {
    // GLOBAL revaluation has no warehouseId on the line — it re-prices the whole company.
    const draft = buildRevaluation({
      lines: [
        {
          itemId: 'item-1',
          warehouseId: undefined,
          qtyOnHand: 100,
          currentAvgCostBase: 12,
          currentAvgCostCCY: 12,
          newAvgCostBase: 13,
          newAvgCostCCY: 13,
          valueDeltaBase: 100,
          valueDeltaCCY: 100,
        },
      ],
      totalValueDeltaBase: 100,
      totalValueDeltaCCY: 100,
    });
    const wh1 = buildLevel({ id: 'item-1_wh-1', warehouseId: 'wh-1', qtyOnHand: 60, avgCostBase: 10, avgCostCCY: 10 });
    const wh2 = buildLevel({ id: 'item-1_wh-2', warehouseId: 'wh-2', qtyOnHand: 40, avgCostBase: 14, avgCostCCY: 14 });
    const h = buildHarness({
      revaluation: draft,
      level: wh1,
      settings: {
        costingBasis: 'GLOBAL',
        defaultInventoryRevaluationAccountId: 'REV-900',
        defaultInventoryAssetAccountId: 'INV-DEFAULT',
      },
    });
    h.stockLevelRepo.getLevelsByItemInTransaction = jest.fn(async () => [wh1, wh2]);
    h.stockLevelRepo.getLevelInTransaction = jest.fn(async () => wh1);
    h.revaluationRepo.getRevaluation = jest
      .fn()
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingPostingService as any
    );

    await useCase.execute(COMPANY_ID, draft.id, USER_ID);

    const writes = (h.stockLevelRepo.upsertLevelInTransaction as jest.Mock).mock.calls.map((c) => c[1]);
    expect(writes).toHaveLength(2);
    for (const lvl of writes) {
      expect(lvl.avgCostBase).toBe(13);
      expect(lvl.avgCostCCY).toBe(13);
    }

    const voucherArgs = (h.accountingPostingService.postInTransaction as jest.Mock).mock.calls[0][0];
    expect(voucherArgs.lines.length).toBe(2);
    const totalDebit = (voucherArgs.lines as Array<any>)
      .filter((l) => l.side === 'Debit')
      .reduce((s, l) => s + l.baseAmount, 0);
    const totalCredit = (voucherArgs.lines as Array<any>)
      .filter((l) => l.side === 'Credit')
      .reduce((s, l) => s + l.baseAmount, 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.001);
  });
});

describe('ListInventoryRevaluationsUseCase / GetInventoryRevaluationUseCase', () => {
  it('forwards status + paging to the repository', async () => {
    const revaluationRepo = {
      getCompanyRevaluations: jest.fn(async () => []),
      getByStatus: jest.fn(async () => []),
      getRevaluation: jest.fn(async () => null),
    };
    const list = new ListInventoryRevaluationsUseCase(revaluationRepo as any);
    await list.execute(COMPANY_ID, { status: 'POSTED', limit: 5, offset: 10 });
    expect(revaluationRepo.getByStatus).toHaveBeenCalledWith(COMPANY_ID, 'POSTED', {
      limit: 5,
      offset: 10,
    });

    await list.execute(COMPANY_ID, { limit: 3 });
    expect(revaluationRepo.getCompanyRevaluations).toHaveBeenCalledWith(COMPANY_ID, {
      limit: 3,
      offset: undefined,
    });

    const get = new GetInventoryRevaluationUseCase(revaluationRepo as any);
    await get.execute('rev-x');
    expect(revaluationRepo.getRevaluation).toHaveBeenCalledWith('rev-x');
  });
});
