import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { GetStockLevelsUseCase } from '../../../application/inventory/use-cases/StockLevelUseCases';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';

const makeLevel = (overrides: Partial<ConstructorParameters<typeof StockLevel>[0]> = {}) =>
  new StockLevel({
    id: StockLevel.compositeId(overrides.itemId || 'item-1', overrides.warehouseId || 'wh-1'),
    companyId: 'cmp-1',
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 10,
    reservedQty: 0,
    avgCostBase: 1200,
    avgCostCCY: 1200,
    lastCostBase: 1200,
    lastCostCCY: 1200,
    postingSeq: 1,
    maxBusinessDate: '2026-06-26',
    totalMovements: 1,
    lastMovementId: 'mov-1',
    version: 1,
    updatedAt: new Date('2026-06-26T00:00:00.000Z'),
    ...overrides,
  });

const buildRepo = (levels: StockLevel[]): IStockLevelRepository => ({
  getLevel: jest.fn(),
  getLevelsByItem: jest.fn(async (_companyId, itemId) => levels.filter((level) => level.itemId === itemId)),
  getLevelsByWarehouse: jest.fn(async (_companyId, warehouseId) => levels.filter((level) => level.warehouseId === warehouseId)),
  getAllLevels: jest.fn(async () => levels),
  upsertLevel: jest.fn(),
  getLevelInTransaction: jest.fn(),
  getLevelsByItemInTransaction: jest.fn(),
  upsertLevelInTransaction: jest.fn(),
});

describe('GetStockLevelsUseCase report valuation', () => {
  it('keeps positive stock valued from moving average', async () => {
    const useCase = new GetStockLevelsUseCase(buildRepo([makeLevel({ qtyOnHand: 3, avgCostBase: 1200, lastCostBase: 1300 })]));

    const rows = await useCase.executeReport('cmp-1');

    expect(rows[0]).toEqual(expect.objectContaining({
      qtyOnHand: 3,
      reportUnitCostBase: 1200,
      reportValueBase: 3600,
      costBasis: 'AVG',
      unvaluedNegativeStock: false,
    }));
  });

  it('values negative stock from last known cost when average is missing', async () => {
    const useCase = new GetStockLevelsUseCase(buildRepo([makeLevel({ qtyOnHand: -2, avgCostBase: 0, lastCostBase: 1200 })]));

    const rows = await useCase.executeReport('cmp-1');

    expect(rows[0]).toEqual(expect.objectContaining({
      qtyOnHand: -2,
      reportUnitCostBase: 1200,
      reportValueBase: -2400,
      costBasis: 'LAST_KNOWN',
      unvaluedNegativeStock: false,
    }));
  });

  it('flags negative stock with no cost basis instead of showing clean zero value', async () => {
    const useCase = new GetStockLevelsUseCase(buildRepo([makeLevel({ qtyOnHand: -2, avgCostBase: 0, lastCostBase: 0 })]));

    const rows = await useCase.executeReport('cmp-1');

    expect(rows[0]).toEqual(expect.objectContaining({
      qtyOnHand: -2,
      reportUnitCostBase: null,
      reportValueBase: null,
      costBasis: 'MISSING',
      unvaluedNegativeStock: true,
    }));
  });

  it('uses average cost again after later receipt restores positive stock', async () => {
    const useCase = new GetStockLevelsUseCase(buildRepo([makeLevel({ qtyOnHand: 3, avgCostBase: 1200, lastCostBase: 1200 })]));

    const rows = await useCase.executeReport('cmp-1');

    expect(rows[0]).toEqual(expect.objectContaining({
      qtyOnHand: 3,
      reportUnitCostBase: 1200,
      reportValueBase: 3600,
      costBasis: 'AVG',
      unvaluedNegativeStock: false,
    }));
  });
});
