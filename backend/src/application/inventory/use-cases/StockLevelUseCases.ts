import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';

export interface StockLevelFilters {
  itemId?: string;
  warehouseId?: string;
  includeZero?: boolean;
  includeNegative?: boolean;
  limit?: number;
  offset?: number;
}

export type StockLevelCostBasis = 'AVG' | 'LAST_KNOWN' | 'MISSING';

export interface StockLevelReportRow {
  id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  reservedQty: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  reportUnitCostBase: number | null;
  reportUnitCostCCY: number | null;
  reportValueBase: number | null;
  reportValueCCY: number | null;
  costBasis: StockLevelCostBasis;
  unvaluedNegativeStock: boolean;
  postingSeq: number;
  maxBusinessDate: string;
  totalMovements: number;
  lastMovementId: string;
  version: number;
  updatedAt: Date;
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const toStockLevelReportRow = (level: StockLevel): StockLevelReportRow => {
  const hasAverage = level.avgCostBase > 0;
  const hasLastKnown = level.lastCostBase > 0;

  let costBasis: StockLevelCostBasis = 'MISSING';
  let unitCostBase: number | null = null;
  let unitCostCCY: number | null = null;

  if (hasAverage) {
    costBasis = 'AVG';
    unitCostBase = level.avgCostBase;
    unitCostCCY = level.avgCostCCY;
  } else if (level.qtyOnHand < 0 && hasLastKnown) {
    costBasis = 'LAST_KNOWN';
    unitCostBase = level.lastCostBase;
    unitCostCCY = level.lastCostCCY;
  }

  const unvaluedNegativeStock = level.qtyOnHand < 0 && costBasis === 'MISSING';

  return {
    id: level.id,
    companyId: level.companyId,
    itemId: level.itemId,
    warehouseId: level.warehouseId,
    qtyOnHand: level.qtyOnHand,
    reservedQty: level.reservedQty,
    avgCostBase: level.avgCostBase,
    avgCostCCY: level.avgCostCCY,
    lastCostBase: level.lastCostBase,
    lastCostCCY: level.lastCostCCY,
    reportUnitCostBase: unitCostBase,
    reportUnitCostCCY: unitCostCCY,
    reportValueBase: unitCostBase === null ? null : roundMoney(level.qtyOnHand * unitCostBase),
    reportValueCCY: unitCostCCY === null ? null : roundMoney(level.qtyOnHand * unitCostCCY),
    costBasis,
    unvaluedNegativeStock,
    postingSeq: level.postingSeq,
    maxBusinessDate: level.maxBusinessDate,
    totalMovements: level.totalMovements,
    lastMovementId: level.lastMovementId,
    version: level.version,
    updatedAt: level.updatedAt,
  };
};

export class GetStockLevelsUseCase {
  constructor(private readonly stockLevelRepo: IStockLevelRepository) {}

  async execute(companyId: string, filters: StockLevelFilters = {}): Promise<StockLevel[]> {
    if (filters.itemId) {
      return this.stockLevelRepo.getLevelsByItem(companyId, filters.itemId, {
        limit: filters.limit,
        offset: filters.offset,
      });
    }

    if (filters.warehouseId) {
      return this.stockLevelRepo.getLevelsByWarehouse(companyId, filters.warehouseId, {
        limit: filters.limit,
        offset: filters.offset,
      });
    }

    return this.stockLevelRepo.getAllLevels(companyId, {
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  async executeReport(companyId: string, filters: StockLevelFilters = {}): Promise<StockLevelReportRow[]> {
    const levels = await this.execute(companyId, filters);
    return levels
      .filter((level) => filters.includeZero !== false || Math.abs(level.qtyOnHand) > 0.0000001)
      .filter((level) => filters.includeNegative !== false || level.qtyOnHand >= 0)
      .map(toStockLevelReportRow);
  }
}

export class GetInventoryValuationUseCase {
  constructor(private readonly stockLevelRepo: IStockLevelRepository) {}

  async execute(companyId: string): Promise<{
    totalValueBase: number;
    totalItems: number;
    levels: Array<{ itemId: string; warehouseId: string; qtyOnHand: number; avgCostBase: number; valueBase: number }>;
  }> {
    const levels = await this.stockLevelRepo.getAllLevels(companyId);

    const detailed = levels.map((level) => ({
      itemId: level.itemId,
      warehouseId: level.warehouseId,
      qtyOnHand: level.qtyOnHand,
      avgCostBase: level.avgCostBase,
      valueBase: level.qtyOnHand * level.avgCostBase,
    }));

    return {
      totalValueBase: detailed.reduce((sum, row) => sum + row.valueBase, 0),
      totalItems: detailed.length,
      levels: detailed,
    };
  }
}
