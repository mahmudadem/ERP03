import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { InventoryPricingPolicy, Item } from '../../../domain/inventory/entities/Item';
import { InventoryCostingBasis } from '../../../domain/inventory/entities/InventorySettings';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';

export interface InventoryValuationLine {
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastPurchaseCostBase: number;
  lastPurchaseCostCCY: number;
  pricingUnitCostBase: number;
  pricingUnitCostCCY: number;
  valueBase: number;
}

export interface InventoryValuationResult {
  asOfDate: string;
  pricingPolicy: InventoryPricingPolicy;
  totalValueBase: number;
  totalItems: number;
  items: InventoryValuationLine[];
}

interface ReplayLevelState {
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
}

interface LastInboundCostState {
  unitCostBase: number;
  unitCostCCY: number;
}

const LEVEL_KEY_SEPARATOR = '__';
const MIN_DATE = '1900-01-01';

const buildLevelKey = (itemId: string, warehouseId: string) =>
  `${itemId}${LEVEL_KEY_SEPARATOR}${warehouseId}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const compareMovementOrder = (a: StockMovement, b: StockMovement): number => {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;

  const postedCmp = a.postedAt.getTime() - b.postedAt.getTime();
  if (postedCmp !== 0) return postedCmp;

  return a.id.localeCompare(b.id);
};

export class InventoryValuationService {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly stockMovementRepo: IStockMovementRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository
  ) {}

  async value(
    companyId: string,
    asOfDate: string,
    pricingPolicy: InventoryPricingPolicy = 'AVERAGE',
    warehouseId?: string
  ): Promise<InventoryValuationResult> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      throw new Error('asOfDate must be in YYYY-MM-DD format');
    }

    const normalizedPolicy = pricingPolicy === 'LAST_PURCHASE' ? 'LAST_PURCHASE' : 'AVERAGE';
    const [items, settings] = await Promise.all([
      this.itemRepo.getCompanyItems(companyId, { limit: 100000 }),
      this.inventorySettingsRepo.getSettings(companyId),
    ]);

    const itemById = new Map(items.map((item) => [item.id, item]));
    const costingBasis: InventoryCostingBasis = settings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';

    const lines = asOfDate >= todayIso()
      ? await this.buildCurrentLines(companyId, itemById, normalizedPolicy, warehouseId)
      : await this.buildHistoricalLines(companyId, itemById, costingBasis, asOfDate, normalizedPolicy, warehouseId);

    const totalValueBase = roundMoney(lines.reduce((sum, line) => sum + line.valueBase, 0));

    return {
      asOfDate,
      pricingPolicy: normalizedPolicy,
      totalValueBase,
      totalItems: lines.length,
      items: lines,
    };
  }

  private async buildCurrentLines(
    companyId: string,
    itemById: Map<string, Item>,
    pricingPolicy: InventoryPricingPolicy,
    warehouseId?: string
  ): Promise<InventoryValuationLine[]> {
    const levels = warehouseId
      ? await this.stockLevelRepo.getLevelsByWarehouse(companyId, warehouseId)
      : await this.stockLevelRepo.getAllLevels(companyId);

    return levels
      .filter((level) => Math.abs(level.qtyOnHand) > 0.0000001)
      .map((level) => this.toCurrentLine(level, itemById.get(level.itemId), pricingPolicy))
      .sort((a, b) => {
        if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
        return a.warehouseId.localeCompare(b.warehouseId);
      });
  }

  private async buildHistoricalLines(
    companyId: string,
    itemById: Map<string, Item>,
    costingBasis: InventoryCostingBasis,
    asOfDate: string,
    pricingPolicy: InventoryPricingPolicy,
    warehouseId?: string
  ): Promise<InventoryValuationLine[]> {
    const movements = await this.stockMovementRepo.getMovementsByDateRange(companyId, MIN_DATE, asOfDate);
    movements.sort(compareMovementOrder);

    const levelsByKey = new Map<string, ReplayLevelState>();
    const lastInboundByItem = new Map<string, LastInboundCostState>();

    for (const movement of movements) {
      if (movement.date > asOfDate) continue;

      const key = buildLevelKey(movement.itemId, movement.warehouseId);
      const existing = levelsByKey.get(key) || {
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        qtyOnHand: 0,
        avgCostBase: 0,
        avgCostCCY: 0,
      };

      existing.qtyOnHand = movement.qtyAfter;
      existing.avgCostBase = movement.avgCostBaseAfter;
      existing.avgCostCCY = movement.avgCostCCYAfter;
      levelsByKey.set(key, existing);

      if (movement.direction === 'IN') {
        lastInboundByItem.set(movement.itemId, {
          unitCostBase: movement.unitCostBase,
          unitCostCCY: movement.unitCostCCY,
        });
      }

      if (costingBasis === 'GLOBAL') {
        for (const level of levelsByKey.values()) {
          if (level.itemId !== movement.itemId) continue;
          level.avgCostBase = movement.avgCostBaseAfter;
          level.avgCostCCY = movement.avgCostCCYAfter;
        }
      }
    }

    return Array.from(levelsByKey.values())
      .filter((level) => Math.abs(level.qtyOnHand) > 0.0000001)
      .filter((level) => !warehouseId || level.warehouseId === warehouseId)
      .map((level) => this.toHistoricalLine(level, itemById.get(level.itemId), pricingPolicy, lastInboundByItem.get(level.itemId)))
      .sort((a, b) => {
        if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
        return a.warehouseId.localeCompare(b.warehouseId);
      });
  }

  private toCurrentLine(
    level: StockLevel,
    item: Item | undefined,
    pricingPolicy: InventoryPricingPolicy
  ): InventoryValuationLine {
    const avgCostBase = level.avgCostBase;
    const avgCostCCY = level.avgCostCCY;
    const lastPurchaseCostBase = item?.costingStats?.lastPurchaseCost?.base ?? level.lastCostBase ?? avgCostBase;
    const lastPurchaseCostCCY = item?.costingStats?.lastPurchaseCost?.ccy ?? level.lastCostCCY ?? avgCostCCY;
    const pricingUnitCostBase = pricingPolicy === 'LAST_PURCHASE' ? lastPurchaseCostBase : avgCostBase;
    const pricingUnitCostCCY = pricingPolicy === 'LAST_PURCHASE' ? lastPurchaseCostCCY : avgCostCCY;

    return {
      itemId: level.itemId,
      warehouseId: level.warehouseId,
      qtyOnHand: level.qtyOnHand,
      avgCostBase,
      avgCostCCY,
      lastPurchaseCostBase,
      lastPurchaseCostCCY,
      pricingUnitCostBase,
      pricingUnitCostCCY,
      valueBase: roundMoney(level.qtyOnHand * pricingUnitCostBase),
    };
  }

  private toHistoricalLine(
    level: ReplayLevelState,
    item: Item | undefined,
    pricingPolicy: InventoryPricingPolicy,
    lastInbound: LastInboundCostState | undefined
  ): InventoryValuationLine {
    const avgCostBase = level.avgCostBase;
    const avgCostCCY = level.avgCostCCY;
    const lastPurchaseCostBase = lastInbound?.unitCostBase
      ?? item?.costingStats?.lastPurchaseCost?.base
      ?? avgCostBase;
    const lastPurchaseCostCCY = lastInbound?.unitCostCCY
      ?? item?.costingStats?.lastPurchaseCost?.ccy
      ?? avgCostCCY;
    const pricingUnitCostBase = pricingPolicy === 'LAST_PURCHASE' ? lastPurchaseCostBase : avgCostBase;
    const pricingUnitCostCCY = pricingPolicy === 'LAST_PURCHASE' ? lastPurchaseCostCCY : avgCostCCY;

    return {
      itemId: level.itemId,
      warehouseId: level.warehouseId,
      qtyOnHand: level.qtyOnHand,
      avgCostBase,
      avgCostCCY,
      lastPurchaseCostBase,
      lastPurchaseCostCCY,
      pricingUnitCostBase,
      pricingUnitCostCCY,
      valueBase: roundMoney(level.qtyOnHand * pricingUnitCostBase),
    };
  }
}
