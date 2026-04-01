import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';

export class GetInventoryDashboardUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly itemRepo: IItemRepository,
    private readonly movementRepo: IStockMovementRepository
  ) {}

  async execute(companyId: string): Promise<{
    totalInventoryValueBase: number;
    totalTrackedItems: number;
    totalStockLevels: number;
    lowStockAlerts: number;
    negativeStockCount: number;
    unsettledMovementsCount: number;
    recentMovements: any[];
  }> {
    const [levels, items, unsettledMovements, allMovements] = await Promise.all([
      this.stockLevelRepo.getAllLevels(companyId),
      this.itemRepo.getCompanyItems(companyId),
      this.movementRepo.getUnsettledMovements(companyId),
      this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31', { limit: 200 }),
    ]);

    const itemMap = new Map(items.map((item) => [item.id, item]));

    const lowStockAlerts = levels.filter((level) => {
      const item = itemMap.get(level.itemId);
      if (!item || !item.trackInventory) return false;
      if (level.qtyOnHand < 0) return true;
      if (item.minStockLevel === undefined) return false;
      return level.qtyOnHand < item.minStockLevel;
    }).length;

    const recentMovements = [...allMovements]
      .sort((a, b) => {
        if (b.postingSeq !== a.postingSeq) return b.postingSeq - a.postingSeq;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 10);

    return {
      totalInventoryValueBase: levels.reduce((sum, level) => sum + (level.qtyOnHand * level.avgCostBase), 0),
      totalTrackedItems: items.filter((item) => item.trackInventory).length,
      totalStockLevels: levels.length,
      lowStockAlerts,
      negativeStockCount: levels.filter((level) => level.qtyOnHand < 0).length,
      unsettledMovementsCount: unsettledMovements.length,
      recentMovements,
    };
  }
}

export class GetLowStockAlertsUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly itemRepo: IItemRepository
  ) {}

  async execute(companyId: string): Promise<Array<{
    itemId: string;
    itemName: string;
    warehouseId: string;
    qtyOnHand: number;
    minStockLevel: number;
    deficit: number;
  }>> {
    const [levels, items] = await Promise.all([
      this.stockLevelRepo.getAllLevels(companyId),
      this.itemRepo.getCompanyItems(companyId),
    ]);

    const itemMap = new Map(items.map((item) => [item.id, item]));

    return levels
      .map((level) => {
        const item = itemMap.get(level.itemId);
        if (!item || !item.trackInventory) return null;

        const threshold = item.minStockLevel ?? 0;
        const isNegative = level.qtyOnHand < 0;
        const isLow = item.minStockLevel !== undefined && level.qtyOnHand < item.minStockLevel;
        if (!isNegative && !isLow) return null;

        const deficit = isNegative
          ? threshold - level.qtyOnHand
          : Math.max((item.minStockLevel ?? 0) - level.qtyOnHand, 0);

        return {
          itemId: level.itemId,
          itemName: item.name,
          warehouseId: level.warehouseId,
          qtyOnHand: level.qtyOnHand,
          minStockLevel: threshold,
          deficit,
        };
      })
      .filter((row): row is {
        itemId: string;
        itemName: string;
        warehouseId: string;
        qtyOnHand: number;
        minStockLevel: number;
        deficit: number;
      } => row !== null)
      .sort((a, b) => b.deficit - a.deficit);
  }
}

export class GetUnsettledCostReportUseCase {
  constructor(private readonly movementRepo: IStockMovementRepository) {}

  async execute(
    companyId: string,
    input: { itemId?: string; limit?: number; offset?: number } = {}
  ): Promise<{
    total: number;
    rows: Array<{
      id: string;
      date: string;
      itemId: string;
      warehouseId: string;
      movementType: string;
      qty: number;
      unsettledQty: number;
      unsettledCostBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING';
      unitCostBase: number;
      totalCostBase: number;
      referenceType: string;
      referenceId?: string;
      createdAt: Date;
    }>;
  }> {
    const unsettled = await this.movementRepo.getUnsettledMovements(companyId);

    const filtered = (input.itemId
      ? unsettled.filter((movement) => movement.itemId === input.itemId)
      : unsettled
    ).sort((a, b) => {
      if (b.postingSeq !== a.postingSeq) return b.postingSeq - a.postingSeq;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const offset = input.offset ?? 0;
    const limit = input.limit ?? 50;

    const rows = filtered.slice(offset, offset + limit).map((movement) => ({
      id: movement.id,
      date: movement.date,
      itemId: movement.itemId,
      warehouseId: movement.warehouseId,
      movementType: movement.movementType,
      qty: movement.qty,
      unsettledQty: movement.unsettledQty ?? 0,
      unsettledCostBasis: movement.unsettledCostBasis,
      unitCostBase: movement.unitCostBase,
      totalCostBase: movement.totalCostBase,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      createdAt: movement.createdAt,
    }));

    return {
      total: filtered.length,
      rows,
    };
  }
}
