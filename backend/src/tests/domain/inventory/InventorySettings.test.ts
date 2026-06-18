import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';

describe('InventorySettings', () => {
  it('defaults new inventory settings to blocking negative stock', () => {
    const settings = InventorySettings.createDefault('cmp-1', 'usd');

    expect(settings.allowNegativeStock).toBe(false);
  });

  it('treats legacy settings with no negative-stock flag as blocked by default', () => {
    const settings = InventorySettings.fromJSON({
      companyId: 'cmp-1',
      accountingMode: 'PERPETUAL',
      inventoryAccountingMethod: 'PERPETUAL',
      defaultCostingMethod: 'MOVING_AVG',
      defaultCostCurrency: 'USD',
      autoGenerateItemCode: false,
      itemCodeNextSeq: 1,
    });

    expect(settings.allowNegativeStock).toBe(false);
  });

  it('keeps legacy PERIODIC data as real periodic mode', () => {
    const settings = InventorySettings.fromJSON({
      companyId: 'cmp-1',
      inventoryAccountingMethod: 'PERIODIC',
      defaultCostingMethod: 'MOVING_AVG',
      defaultCostCurrency: 'USD',
      autoGenerateItemCode: false,
      itemCodeNextSeq: 1,
    });

    expect(settings.accountingMode).toBe('PERIODIC');
    expect(settings.inventoryAccountingMethod).toBe('PERIODIC');
  });

  it('defaults negative inventory value shortcuts off and keeps revaluation account separate', () => {
    const settings = InventorySettings.fromJSON({
      companyId: 'cmp-1',
      accountingMode: 'PERPETUAL',
      inventoryAccountingMethod: 'PERPETUAL',
      defaultCostingMethod: 'MOVING_AVG',
      defaultCostCurrency: 'USD',
      defaultInventoryRevaluationAccountId: 'rev-1',
      defaultInventoryGainAccountId: 'gain-1',
      autoGenerateItemCode: false,
      itemCodeNextSeq: 1,
    });

    expect(settings.allowNegativeInventoryValue).toBe(false);
    expect(settings.defaultInventoryRevaluationAccountId).toBe('rev-1');
    expect(settings.defaultInventoryGainAccountId).toBe('gain-1');
  });
});
