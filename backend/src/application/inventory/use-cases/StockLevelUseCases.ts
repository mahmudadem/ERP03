import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';

export interface StockLevelFilters {
  itemId?: string;
  warehouseId?: string;
  limit?: number;
  offset?: number;
}

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
