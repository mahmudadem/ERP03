import { describe, expect, it } from '@jest/globals';
import {
  buildCcyUomKey,
  buildDocumentPricePoint,
  buildUpdatedItemCostingStats,
  deriveAverageCostForDocumentLine,
} from '../../../../application/inventory/services/ItemCostingStatsService';

const makeItem = () => ({
  id: 'item-1',
  companyId: 'cmp-1',
  code: 'ITEM-1',
  costCurrency: 'USD',
  costingStats: {
    avgCost: {
      base: 1000,
      ccy: 1,
      currency: 'USD',
      fxRateToBase: 1000,
      asOf: '2026-06-19',
      uomId: 'uom_unit',
    },
  },
} as any);

describe('ItemCostingStatsService price memory helpers', () => {
  it('stores observed prices by currency and UOM without uppercasing the UOM id', () => {
    const item = makeItem();
    const point = buildDocumentPricePoint({
      unitPriceDoc: 10,
      currency: 'usd',
      exchangeRate: 1000,
      baseCurrency: 'SYP',
      asOf: '2026-06-19',
      refType: 'SALES_INVOICE',
      refId: 'si-1',
      qty: 1,
      uomId: 'uom_box',
    });

    const stats = buildUpdatedItemCostingStats(item, item.costingStats.avgCost, { lastSalePrice: point });

    expect(buildCcyUomKey('usd', 'uom_box')).toBe('USD__uom_box');
    expect(stats.lastSalePriceByCcyUom?.USD__uom_box?.ccy).toBe(10);
    expect(stats.lastSalePriceByCcyUom?.USD__uom_box?.uomId).toBe('uom_box');
  });

  it('derives average cost across UOM and FX without storing a parallel average', () => {
    const avgCost = {
      base: 8000,
      ccy: 1,
      currency: 'USD',
      fxRateToBase: 8000,
      asOf: '2026-06-19',
      uomId: 'uom_unit',
    };

    const replacement = deriveAverageCostForDocumentLine({
      avgCost,
      documentCurrency: 'USD',
      documentExchangeRate: 10000,
      baseCurrency: 'SYP',
      uomFactorToBase: 4,
      targetUomId: 'uom_box',
      inventoryFxCostBasis: 'REPLACEMENT',
    });

    const historical = deriveAverageCostForDocumentLine({
      avgCost,
      documentCurrency: 'USD',
      documentExchangeRate: 10000,
      baseCurrency: 'SYP',
      uomFactorToBase: 4,
      targetUomId: 'uom_box',
      inventoryFxCostBasis: 'HISTORICAL',
    });

    expect(replacement.base).toBe(32000);
    expect(replacement.ccy).toBe(4);
    expect(replacement.uomId).toBe('uom_box');
    expect(historical.base).toBe(32000);
    expect(historical.ccy).toBe(3.2);
    expect(historical.uomId).toBe('uom_box');
  });
});
