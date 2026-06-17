import { roundByCurrency } from '../../../domain/accounting/entities/CurrencyPrecisionHelpers';
import { CostPoint, Item, ItemCostingStats } from '../../../domain/inventory/entities/Item';
import { InventoryCostingBasis } from '../../../domain/inventory/entities/InventorySettings';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

export interface SalePricePointInput {
  unitPriceDoc: number;
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  asOf: string;
  refType: string;
  refId?: string;
}

const clonePoint = (point: CostPoint): CostPoint => ({
  base: point.base,
  ccy: point.ccy,
  currency: point.currency,
  fxRateToBase: point.fxRateToBase,
  asOf: point.asOf,
  source: point.source ? { ...point.source } : undefined,
});

export const mergeLevelSnapshot = (levels: StockLevel[], updatedLevel: StockLevel): StockLevel[] => {
  const cloned = levels.map((level) => StockLevel.fromJSON(level.toJSON()));
  const index = cloned.findIndex((level) => level.id === updatedLevel.id);
  const replacement = StockLevel.fromJSON(updatedLevel.toJSON());
  if (index >= 0) {
    cloned[index] = replacement;
    return cloned;
  }
  cloned.push(replacement);
  return cloned;
};

export const mergeLevelSnapshots = (levels: StockLevel[], updatedLevels: StockLevel[]): StockLevel[] => {
  let next = levels.map((level) => StockLevel.fromJSON(level.toJSON()));
  for (const updatedLevel of updatedLevels) {
    next = mergeLevelSnapshot(next, updatedLevel);
  }
  return next;
};

export const buildPurchaseCostPoint = (movement: StockMovement): CostPoint => ({
  base: movement.unitCostBase,
  ccy: roundByCurrency(
    movement.fxRateMovToBase > 0 ? movement.unitCostBase / movement.fxRateMovToBase : movement.unitCostBase,
    movement.movementCurrency
  ),
  currency: movement.movementCurrency,
  fxRateToBase: movement.fxRateMovToBase,
  asOf: movement.date,
  source: {
    movementId: movement.id,
    refType: movement.referenceType,
    refId: movement.referenceId,
  },
});

export const buildSalePricePoint = (input: SalePricePointInput): CostPoint => ({
  base: roundByCurrency(input.unitPriceDoc * input.exchangeRate, input.baseCurrency),
  ccy: input.unitPriceDoc,
  currency: input.currency.toUpperCase(),
  fxRateToBase: input.exchangeRate,
  asOf: input.asOf,
  source: {
    refType: input.refType,
    refId: input.refId,
  },
});

export const buildAverageCostPoint = (
  levels: StockLevel[],
  item: Item,
  baseCurrency: string,
  costingBasis: InventoryCostingBasis,
  fallback?: CostPoint
): CostPoint => {
  if (costingBasis === 'GLOBAL') {
    const sourceLevel = levels.find((level) => level.qtyOnHand !== 0) || levels[0];
    if (sourceLevel && sourceLevel.avgCostBase > 0) {
      return {
        base: roundByCurrency(sourceLevel.avgCostBase, baseCurrency),
        ccy: roundByCurrency(sourceLevel.avgCostCCY, item.costCurrency),
        currency: item.costCurrency,
        fxRateToBase: sourceLevel.avgCostCCY > 0 ? sourceLevel.avgCostBase / sourceLevel.avgCostCCY : 1,
        asOf: sourceLevel.maxBusinessDate,
      };
    }
  }

  let totalQty = 0;
  let totalValueBase = 0;
  let totalValueCCY = 0;
  let asOf = '1970-01-01';
  for (const level of levels) {
    totalQty += level.qtyOnHand;
    totalValueBase += level.qtyOnHand * level.avgCostBase;
    totalValueCCY += level.qtyOnHand * level.avgCostCCY;
    if (level.maxBusinessDate > asOf) {
      asOf = level.maxBusinessDate;
    }
  }

  if (totalQty > 0) {
    const avgBase = roundByCurrency(totalValueBase / totalQty, baseCurrency);
    const avgCCY = roundByCurrency(totalValueCCY / totalQty, item.costCurrency);
    return {
      base: avgBase,
      ccy: avgCCY,
      currency: item.costCurrency,
      fxRateToBase: avgCCY > 0 ? avgBase / avgCCY : 1,
      asOf,
    };
  }

  if (fallback) {
    return clonePoint(fallback);
  }

  const existingAvg = item.costingStats?.avgCost;
  if (existingAvg) {
    return clonePoint(existingAvg);
  }

  return {
    base: 0,
    ccy: 0,
    currency: item.costCurrency,
    fxRateToBase: 1,
    asOf,
  };
};

export const buildUpdatedItemCostingStats = (
  item: Item,
  avgCost: CostPoint,
  patch?: Partial<Omit<ItemCostingStats, 'avgCost'>>
): ItemCostingStats => ({
  avgCost,
  lastPurchaseCost: patch?.lastPurchaseCost
    ? clonePoint(patch.lastPurchaseCost)
    : item.costingStats?.lastPurchaseCost
      ? clonePoint(item.costingStats.lastPurchaseCost)
      : undefined,
  lastSalePrice: patch?.lastSalePrice
    ? clonePoint(patch.lastSalePrice)
    : item.costingStats?.lastSalePrice
      ? clonePoint(item.costingStats.lastSalePrice)
      : undefined,
  extra: item.costingStats?.extra
    ? Object.fromEntries(Object.entries(item.costingStats.extra).map(([key, value]) => [key, clonePoint(value)]))
    : undefined,
});
