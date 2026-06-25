import { InventoryRevaluation } from '../../../domain/inventory/entities/InventoryRevaluation';
import {
  CreateInventoryRevaluationUseCase,
  GetInventoryRevaluationUseCase,
  PostInventoryRevaluationUseCase,
} from '../../../application/inventory/use-cases/InventoryRevaluationUseCases';
import { ReconcileStockUseCase } from '../../../application/inventory/use-cases/ReconcileStockUseCase';

const COMPANY_ID = 'cmp-223';
const USER_ID = 'u-223';

const baseItem = (overrides: Partial<any> = {}) => ({
  id: 'item-1',
  companyId: COMPANY_ID,
  code: 'ITM-1',
  name: 'Test Item',
  costCurrency: 'USD',
  inventoryAssetAccountId: 'ACC-INV-100',
  cogsAccountId: 'ACC-COGS-100',
  costingStats: {
    avgCost: {
      base: 5,
      ccy: 5,
      currency: 'USD',
      fxRateToBase: 1,
      asOf: '2026-06-01',
    },
  },
  ...overrides,
});

const buildSettings = (overrides: Partial<any> = {}) => ({
  costingBasis: 'WAREHOUSE',
  accountingMode: 'INVOICE_DRIVEN',
  defaultInventoryAssetAccountId: 'ACC-INV-DEFAULT',
  defaultInventoryRevaluationAccountId: 'ACC-REV-100',
  ...overrides,
});

const buildHarness = (opts: {
  settings: any;
  levels: Array<{ itemId: string; warehouseId: string; qtyOnHand: number; avgCostBase: number; avgCostCCY: number }>;
  item?: any;
}) => {
  const revaluationRepo = {
    createRevaluation: jest.fn(async () => undefined),
    updateRevaluation: jest.fn(async () => undefined),
    getRevaluation: jest.fn(),
    getCompanyRevaluations: jest.fn(async () => []),
    getByStatus: jest.fn(async () => []),
    deleteRevaluation: jest.fn(async () => undefined),
  };

  const item = opts.item || baseItem();
  const itemRepo = {
    getItem: jest.fn(async (id: string) => (id === item.id ? item : null)),
    updateItemInTransaction: jest.fn(async () => undefined),
  };

  const stockLevelRepo = {
    getLevel: jest.fn(async (_companyId: string, itemId: string, warehouseId: string) => {
      const found = opts.levels.find((l) => l.itemId === itemId && l.warehouseId === warehouseId);
      return found
        ? ({
            qtyOnHand: found.qtyOnHand,
            avgCostBase: found.avgCostBase,
            avgCostCCY: found.avgCostCCY,
            version: 0,
          } as any)
        : null;
    }),
    getLevelsByItem: jest.fn(async (_companyId: string, itemId: string) =>
      opts.levels.filter((l) => l.itemId === itemId).map((l) => ({
        qtyOnHand: l.qtyOnHand,
        avgCostBase: l.avgCostBase,
        avgCostCCY: l.avgCostCCY,
        version: 0,
      })) as any
    ),
    getLevelInTransaction: jest.fn(async (_tx: unknown, _companyId: string, itemId: string, warehouseId: string) => {
      const found = opts.levels.find((l) => l.itemId === itemId && l.warehouseId === warehouseId);
      return found
        ? ({
            qtyOnHand: found.qtyOnHand,
            avgCostBase: found.avgCostBase,
            avgCostCCY: found.avgCostCCY,
            version: 0,
          } as any)
        : null;
    }),
    getLevelsByItemInTransaction: jest.fn(async (_tx: unknown, _companyId: string, itemId: string) =>
      opts.levels.filter((l) => l.itemId === itemId).map((l) => ({
        qtyOnHand: l.qtyOnHand,
        avgCostBase: l.avgCostBase,
        avgCostCCY: l.avgCostCCY,
        version: 0,
        warehouseId: l.warehouseId,
        itemId: l.itemId,
        companyId: COMPANY_ID,
        updatedAt: new Date(),
      })) as any
    ),
    upsertLevelInTransaction: jest.fn(async () => undefined),
  };

  const inventorySettingsRepo = {
    getSettings: jest.fn(async () => opts.settings),
  };

  const transactionManager = {
    runTransaction: jest.fn(async (op: (t: unknown) => Promise<unknown>) => op({ id: 'txn' })),
  };

  const companyModuleRepo = {
    get: jest.fn(async (_companyId: string, moduleId: string) =>
      moduleId === 'accounting' ? ({ initialized: true }) : null
    ),
  };

  const accountingBridge = {
    recordFinancialEvent: jest.fn(async () => ({ mode: 'full', voucher: { id: 'vch-1' } })),
    recordPreBuiltVoucher: jest.fn(async () => {
      throw new Error('Inventory Revaluation should not send prebuilt voucher events');
    }),
  };

  return {
    revaluationRepo,
    itemRepo,
    stockLevelRepo,
    inventorySettingsRepo,
    transactionManager,
    companyModuleRepo,
    accountingBridge,
  };
};

describe('CreateInventoryRevaluationUseCase', () => {
  it('snapshots current qty/avg from the sub-ledger and computes valueDelta authoritatively', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const useCase = new CreateInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any
    );

    const revaluation = await useCase.execute({
      companyId: COMPANY_ID,
      date: '2026-06-20',
      reason: 'COST_CORRECTION',
      lines: [{ itemId: 'item-1', warehouseId: 'wh-1', newAvgCostBase: 7, newAvgCostCCY: 7 }],
      createdBy: USER_ID,
    });

    expect(revaluation.status).toBe('DRAFT');
    expect(revaluation.totalValueDeltaBase).toBeCloseTo(20, 6); // 10 * (7 - 5)
    expect(revaluation.totalValueDeltaCCY).toBeCloseTo(20, 6);
    expect(revaluation.lines[0].qtyOnHand).toBe(10);
    expect(revaluation.lines[0].currentAvgCostBase).toBe(5);
    expect(revaluation.lines[0].newAvgCostBase).toBe(7);
    expect(h.revaluationRepo.createRevaluation).toHaveBeenCalledTimes(1);
  });

  it('refuses to draft when all value deltas are zero', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const useCase = new CreateInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any
    );

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        date: '2026-06-20',
        reason: 'COST_CORRECTION',
        lines: [{ itemId: 'item-1', warehouseId: 'wh-1', newAvgCostBase: 5, newAvgCostCCY: 5 }],
        createdBy: USER_ID,
      })
    ).rejects.toThrow(/zero value delta/);
  });

  it('rejects GLOBAL revaluation lines that ship a warehouseId', async () => {
    const h = buildHarness({
      settings: buildSettings({ costingBasis: 'GLOBAL' }),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const useCase = new CreateInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any
    );

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        date: '2026-06-20',
        reason: 'COST_CORRECTION',
        lines: [{ itemId: 'item-1', warehouseId: 'wh-1', newAvgCostBase: 7, newAvgCostCCY: 7 }],
        createdBy: USER_ID,
      })
    ).rejects.toThrow(/GLOBAL/);
  });
});

describe('PostInventoryRevaluationUseCase', () => {
  const draftRevaluation = (lines: any[], overrides: Partial<any> = {}) =>
    new InventoryRevaluation({
      id: 'rev-1',
      companyId: COMPANY_ID,
      date: '2026-06-20',
      reason: 'COST_CORRECTION',
      lines,
      status: 'DRAFT',
      totalValueDeltaBase: 20,
      totalValueDeltaCCY: 20,
      createdBy: USER_ID,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      ...overrides,
    });

  it('revaluation up in INVOICE_DRIVEN: qty unchanged, avg updated, voucher balanced, GL moves by delta', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 20,
        valueDeltaCCY: 20,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft).mockResolvedValueOnce(
      new InventoryRevaluation({
        id: 'rev-1',
        companyId: COMPANY_ID,
        date: '2026-06-20',
        reason: 'COST_CORRECTION',
        lines: draft.lines,
        status: 'POSTED',
        totalValueDeltaBase: 20,
        totalValueDeltaCCY: 20,
        voucherId: 'vch-1',
        createdBy: USER_ID,
        createdAt: draft.createdAt,
        postedAt: new Date(),
      })
    );

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    const posted = await useCase.execute(COMPANY_ID, 'rev-1', USER_ID);

    expect(posted.status).toBe('POSTED');
    expect(posted.voucherId).toBe('vch-1');
    const payload = ((h.accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const debits = (payload.lines as any[]).filter((l) => l.side === 'Debit');
    const credits = (payload.lines as any[]).filter((l) => l.side === 'Credit');
    expect(debits.length).toBe(1);
    expect(credits.length).toBe(1);
    expect(debits[0].accountId).toBe('ACC-INV-100'); // asset side on write-up
    expect(credits[0].accountId).toBe('ACC-REV-100'); // variance side on write-up
    expect(debits[0].baseAmount).toBe(20);
    expect(credits[0].baseAmount).toBe(20);
  });

  it('revaluation down routes Dr Variance / Cr Asset and uses absolute value of the delta', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 7, avgCostCCY: 7 }],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 7,
        currentAvgCostCCY: 7,
        newAvgCostBase: 6,
        newAvgCostCCY: 6,
        valueDeltaBase: -10,
        valueDeltaCCY: -10,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft).mockResolvedValueOnce(
      new InventoryRevaluation({
        id: 'rev-1',
        companyId: COMPANY_ID,
        date: '2026-06-20',
        reason: 'COST_CORRECTION',
        lines: draft.lines,
        status: 'POSTED',
        totalValueDeltaBase: -10,
        totalValueDeltaCCY: -10,
        voucherId: 'vch-1',
        createdBy: USER_ID,
        createdAt: draft.createdAt,
        postedAt: new Date(),
      })
    );

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await useCase.execute(COMPANY_ID, 'rev-1', USER_ID);

    const payload = ((h.accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const debits = (payload.lines as any[]).filter((l) => l.side === 'Debit');
    const credits = (payload.lines as any[]).filter((l) => l.side === 'Credit');
    expect(debits[0].accountId).toBe('ACC-REV-100'); // variance on write-down
    expect(credits[0].accountId).toBe('ACC-INV-100'); // asset on write-down
    expect(debits[0].baseAmount).toBe(10);
  });

  it('GLOBAL costing re-prices every warehouse to the new company average', async () => {
    const h = buildHarness({
      settings: buildSettings({ costingBasis: 'GLOBAL' }),
      levels: [
        { itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 },
        { itemId: 'item-1', warehouseId: 'wh-2', qtyOnHand: 20, avgCostBase: 5, avgCostCCY: 5 },
      ],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        qtyOnHand: 30,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 6,
        newAvgCostCCY: 6,
        valueDeltaBase: 30,
        valueDeltaCCY: 30,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft).mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await useCase.execute(COMPANY_ID, 'rev-1', USER_ID);

    // Both warehouse levels should have been re-priced.
    const upserts = (h.stockLevelRepo.upsertLevelInTransaction as jest.Mock).mock.calls.map(
      ([, level]) => level
    );
    expect(upserts.length).toBe(2);
    expect(upserts.every((lvl) => lvl.avgCostBase === 6)).toBe(true);
    // Total voucher should value the full 30 units.
    const payload = ((h.accountingBridge.recordFinancialEvent as jest.Mock).mock.calls[0][0] as any).subledgerVoucher;
    const debits = (payload.lines as any[]).filter((l) => l.side === 'Debit');
    expect(debits[0].baseAmount).toBe(30);
  });

  it('WAREHOUSE costing revalues only the named warehouse', async () => {
    const h = buildHarness({
      settings: buildSettings({ costingBasis: 'WAREHOUSE' }),
      levels: [
        { itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 },
        { itemId: 'item-1', warehouseId: 'wh-2', qtyOnHand: 20, avgCostBase: 5, avgCostCCY: 5 },
      ],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 20,
        valueDeltaCCY: 20,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft).mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await useCase.execute(COMPANY_ID, 'rev-1', USER_ID);

    const upserts = (h.stockLevelRepo.upsertLevelInTransaction as jest.Mock).mock.calls.map(
      ([, level]) => level
    );
    expect(upserts.length).toBe(1);
    expect(upserts[0].warehouseId).toBe('wh-1');
    expect(upserts[0].avgCostBase).toBe(7);
  });

  it('WAREHOUSE costing keeps item-level average weighted across all warehouses', async () => {
    const h = buildHarness({
      settings: buildSettings({ costingBasis: 'WAREHOUSE', defaultCostCurrency: 'USD' }),
      levels: [
        { itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 },
        { itemId: 'item-1', warehouseId: 'wh-2', qtyOnHand: 30, avgCostBase: 5, avgCostCCY: 5 },
      ],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 9,
        newAvgCostCCY: 9,
        valueDeltaBase: 40,
        valueDeltaCCY: 40,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft).mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await useCase.execute(COMPANY_ID, 'rev-1', USER_ID);

    const [, , patch] = (h.itemRepo.updateItemInTransaction as jest.Mock).mock.calls[0];
    expect(patch.costingStats.avgCost.base).toBe(6);
    expect(patch.costingStats.avgCost.qty).toBe(40);
    expect(patch.costingStats.avgCost.source.docId).toBe('rev-1');
  });

  it('PERIODIC mode updates the sub-ledger but does not post a GL voucher', async () => {
    const h = buildHarness({
      settings: buildSettings({ accountingMode: 'PERIODIC' }),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 20,
        valueDeltaCCY: 20,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft).mockResolvedValueOnce(
      new InventoryRevaluation({
        id: 'rev-1',
        companyId: COMPANY_ID,
        date: '2026-06-20',
        reason: 'COST_CORRECTION',
        lines: draft.lines,
        status: 'POSTED',
        totalValueDeltaBase: 20,
        totalValueDeltaCCY: 20,
        createdBy: USER_ID,
        createdAt: draft.createdAt,
        postedAt: new Date(),
      })
    );

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await useCase.execute(COMPANY_ID, 'rev-1', USER_ID);

    expect(h.accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
    const upserts = (h.stockLevelRepo.upsertLevelInTransaction as jest.Mock).mock.calls.map(
      ([, level]) => level
    );
    expect(upserts.length).toBe(1);
    expect(upserts[0].avgCostBase).toBe(7);
  });

  it('refuses to post when no Inventory Revaluation account is configured', async () => {
    const h = buildHarness({
      settings: buildSettings({ defaultInventoryRevaluationAccountId: undefined }),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 20,
        valueDeltaCCY: 20,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await expect(useCase.execute(COMPANY_ID, 'rev-1', USER_ID)).rejects.toThrow(
      /Inventory Revaluation .* account is configured/
    );
    expect(h.accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('refuses to post a revaluation line whose item has zero on-hand quantity', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [], // no stock
    });
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 0,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 0,
        valueDeltaCCY: 0,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await expect(useCase.execute(COMPANY_ID, 'rev-1', USER_ID)).rejects.toThrow(/zero on-hand/);
  });

  it('refuses to re-post a revaluation that is no longer DRAFT', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const posted = new InventoryRevaluation({
      id: 'rev-1',
      companyId: COMPANY_ID,
      date: '2026-06-20',
      reason: 'COST_CORRECTION',
      lines: [
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          qtyOnHand: 10,
          currentAvgCostBase: 5,
          currentAvgCostCCY: 5,
          newAvgCostBase: 7,
          newAvgCostCCY: 7,
          valueDeltaBase: 20,
          valueDeltaCCY: 20,
        },
      ],
      status: 'POSTED',
      totalValueDeltaBase: 20,
      totalValueDeltaCCY: 20,
      voucherId: 'vch-1',
      createdBy: USER_ID,
      createdAt: new Date(),
      postedAt: new Date(),
    });
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(posted);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await expect(useCase.execute(COMPANY_ID, 'rev-1', USER_ID)).rejects.toThrow(/Only DRAFT/);
  });

  it('rolls the sub-ledger write back when the GL voucher post throws', async () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    h.accountingBridge.recordFinancialEvent.mockRejectedValueOnce(new Error('voucher failed'));
    const draft = draftRevaluation([
      {
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 20,
        valueDeltaCCY: 20,
      },
    ]);
    h.revaluationRepo.getRevaluation.mockResolvedValueOnce(draft);

    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );

    await expect(useCase.execute(COMPANY_ID, 'rev-1', USER_ID)).rejects.toThrow(/voucher failed/);
    // The repository update must NOT have flipped the revaluation to POSTED, because
    // the transaction is meant to roll back wholesale.
    const updateCalls = (h.revaluationRepo.updateRevaluation as jest.Mock).mock.calls;
    expect(updateCalls.length).toBe(0);
  });
});

describe('Inventory revaluation tenant scope and replay integration', () => {
  it('scopes detail reads by company id', async () => {
    const repo = {
      getRevaluation: jest.fn(async () => null),
    };
    const useCase = new GetInventoryRevaluationUseCase(repo as any);

    await useCase.execute(COMPANY_ID, 'rev-tenant-scope');

    expect(repo.getRevaluation).toHaveBeenCalledWith(COMPANY_ID, 'rev-tenant-scope');
  });

  it('stock reconciliation replays posted value-only revaluations', async () => {
    const movement = {
      id: 'm1',
      companyId: COMPANY_ID,
      date: '2026-06-01',
      postedAt: new Date('2026-06-01T00:00:00.000Z'),
      itemId: 'item-1',
      warehouseId: 'wh-1',
      direction: 'IN',
      qty: 10,
      unitCostBase: 5,
      unitCostCCY: 5,
    };
    const postedRevaluation = new InventoryRevaluation({
      id: 'rev-replay',
      companyId: COMPANY_ID,
      date: '2026-06-02',
      reason: 'COST_CORRECTION',
      lines: [{
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qtyOnHand: 10,
        currentAvgCostBase: 5,
        currentAvgCostCCY: 5,
        newAvgCostBase: 7,
        newAvgCostCCY: 7,
        valueDeltaBase: 20,
        valueDeltaCCY: 20,
      }],
      status: 'POSTED',
      totalValueDeltaBase: 20,
      totalValueDeltaCCY: 20,
      createdBy: USER_ID,
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      postedAt: new Date('2026-06-02T00:00:00.000Z'),
    });
    const useCase = new ReconcileStockUseCase(
      {
        getAllLevels: jest.fn(async () => [{
          itemId: 'item-1',
          warehouseId: 'wh-1',
          qtyOnHand: 10,
          avgCostBase: 7,
          avgCostCCY: 7,
        }]),
      } as any,
      {
        getMovementsByDateRange: jest.fn(async () => [movement]),
      } as any,
      {
        getByStatus: jest.fn(async () => [postedRevaluation]),
      } as any,
      {
        getSettings: jest.fn(async () => buildSettings({ costingBasis: 'WAREHOUSE' })),
      } as any
    );

    const result = await useCase.execute(COMPANY_ID);

    expect(result.matches).toBe(true);
    expect(result.mismatchCount).toBe(0);
  });
});

describe('Inventory Revaluation accounting bridge integration (smoke guard)', () => {
  it('PostInventoryRevaluationUseCase accepts the required accounting bridge dependency', () => {
    const h = buildHarness({
      settings: buildSettings(),
      levels: [{ itemId: 'item-1', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 5, avgCostCCY: 5 }],
    });
    const useCase = new PostInventoryRevaluationUseCase(
      h.revaluationRepo as any,
      h.itemRepo as any,
      h.stockLevelRepo as any,
      h.inventorySettingsRepo as any,
      h.transactionManager as any,
      h.companyModuleRepo as any,
      h.accountingBridge as any
    );
    expect(useCase).toBeInstanceOf(PostInventoryRevaluationUseCase);
    expect(typeof h.accountingBridge.recordFinancialEvent).toBe('function');
  });
});
