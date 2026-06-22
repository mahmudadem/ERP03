import { PostPosSaleUseCase } from '../../../application/pos/use-cases/PostPosSaleUseCase';
import { CommercialCore, __setPromotionsEnabledForTest } from '../../../application/system-core/commercial/CommercialCore';
import { TaxEngine } from '../../../application/system-core/tax/TaxEngine';
import { Item } from '../../../domain/inventory/entities/Item';
import { Party } from '../../../domain/shared/entities/Party';

const makeItem = (overrides: Record<string, any> = {}) =>
  Item.fromJSON({
    id: overrides.id || 'item_1',
    companyId: 'cmp_test',
    code: overrides.code || 'ITEM-1',
    name: overrides.name || 'Widget',
    type: 'PRODUCT',
    baseUom: 'ea',
    salesUom: 'ea',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    revenueAccountId: 'rev-acc',
    cogsAccountId: 'cogs-acc',
    inventoryAssetAccountId: 'inv-acc',
    active: true,
    createdBy: 'seed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeParty = () =>
  Party.fromJSON({
    id: 'walk-in-cust',
    companyId: 'cmp_test',
    code: 'WALKIN',
    legalName: 'Walk-in Customer',
    displayName: 'Walk-in',
    roles: ['CUSTOMER'],
    defaultARAccountId: 'ar-acc',
    active: true,
    createdBy: 'seed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const setup = (options: { commercialCore?: any; promotionRuleReader?: any; unitCostBase?: number; item?: Item } = {}) => {
  const itemRepo = { getItem: jest.fn().mockResolvedValue(options.item || makeItem()) };
  const itemCategoryRepo = { getCompanyCategories: jest.fn().mockResolvedValue([]) };
  const inventorySettingsRepo = { getSettings: jest.fn().mockResolvedValue({ defaultCOGSAccountId: 'cogs-default', defaultInventoryAssetAccountId: 'inv-default' }) };
  const partyRepo = { getById: jest.fn().mockResolvedValue(makeParty()) };
  const taxCodeRepo = { getById: jest.fn().mockResolvedValue(null) };
  const companyCurrencyRepo = { getBaseCurrency: jest.fn().mockResolvedValue('USD') };
  const inventoryCore = {
    processOUT: jest.fn().mockResolvedValue({
      id: 'sm_1',
      unitCostBase: options.unitCostBase ?? 4,
      totalCostBase: (options.unitCostBase ?? 4) * 2,
    }),
  };
  const accountingBridge = { recordFinancialEvent: jest.fn().mockResolvedValue({ mode: 'full', voucher: { id: 'v_1' } }) };
  const useCase = new PostPosSaleUseCase(
    itemRepo as any,
    itemCategoryRepo as any,
    inventorySettingsRepo as any,
    partyRepo as any,
    taxCodeRepo as any,
    companyCurrencyRepo as any,
    inventoryCore as any,
    accountingBridge as any,
    new TaxEngine(),
    options.commercialCore,
    options.promotionRuleReader
  );
  return { useCase, inventoryCore, accountingBridge };
};

describe('PostPosSaleUseCase', () => {
  // FUP-1: promotions are hard-gated OFF in production; these suites exercise the
  // application path, so they explicitly open the gate and reset it afterwards.
  beforeEach(() => __setPromotionsEnabledForTest(true));
  afterEach(() => __setPromotionsEnabledForTest(null));

  it('posts a POS sale through inventory core and accounting bridge without Sales use-cases', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup();

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_1',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
      transaction: { tx: true },
    });

    expect(inventoryCore.processOUT).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      itemId: 'item_1',
      warehouseId: 'wh1',
      qty: 2,
      movementType: 'SALES_DELIVERY',
      refs: expect.objectContaining({ type: 'POS_DIRECT_SALE' }),
      transaction: { tx: true },
      metadata: expect.objectContaining({ sourceModule: 'pos', documentPersona: 'POS_DIRECT_SALE' }),
    }));
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'POS_SALE_REVENUE',
      subledgerVoucher: expect.objectContaining({
        metadata: expect.objectContaining({
          sourceModule: 'pos',
          sourceType: 'POS_SALE',
          documentPersona: 'POS_DIRECT_SALE',
        }),
      }),
    }));
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'POS_SALE_COGS' }));
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'POS_SALE_SETTLEMENT' }));
    expect(result.grandTotal).toBe(20);
    expect(result.lines[0].lineCostBase).toBe(8);
  });

  it('dry-run computes totals without writing inventory or ledger', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup();

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [],
      paymentMethods: [],
      createdBy: 'cashier_1',
      dryRun: true,
    });

    expect(inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
    expect(result.grandTotal).toBe(20);
  });

  it('blocks inactive POS items before stock or ledger writes', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup({ item: makeItem({ active: false }) });

    await expect(useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/inactive and cannot be sold in POS/);

    expect(inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('blocks items disabled for POS through item metadata', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup({ item: makeItem({ metadata: { pos: { enabled: false } } }) });

    await expect(useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/not enabled for POS sale/);

    expect(inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('blocks manual discounts on non-discountable POS items', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup({ item: makeItem({ metadata: { pos: { discountable: false } } }) });

    await expect(useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, discountType: 'PERCENT', discountValue: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 18 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/not discountable in POS/);

    expect(inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('blocks expired POS items before stock or ledger writes', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup({
      item: makeItem({ metadata: { pos: { expiryDate: '2026-06-20' } } }),
    });

    await expect(useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/expired and cannot be sold in POS/);

    expect(inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('blocks expiry-tracked POS items without selected batch expiry before stock or ledger writes', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup({
      item: makeItem({ metadata: { pos: { expiryTracked: true } } }),
    });

    await expect(useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/expiry-tracked and cannot be sold in POS/);

    expect(inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('blocks batch and serial controlled POS items until POS captures the selected lot or serial', async () => {
    const batchScenario = setup({ item: makeItem({ metadata: { pos: { requiresBatch: true } } }) });

    await expect(batchScenario.useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/requires batch\/lot selection/);

    expect(batchScenario.inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(batchScenario.accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();

    const serialScenario = setup({ item: makeItem({ metadata: { pos: { serialRequired: true } } }) });

    await expect(serialScenario.useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentNumber: 'R-000002',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 10 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/requires serial selection/);

    expect(serialScenario.inventoryCore.processOUT).not.toHaveBeenCalled();
    expect(serialScenario.accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('250l-2 blocks a below-cost POS sale when approval is pending', async () => {
    const commercialCore = {
      validateCostMargin: jest.fn().mockResolvedValue({
        allowed: false,
        requiresApproval: true,
        reason: 'BELOW_COST',
      }),
    };
    const { useCase, accountingBridge } = setup({ commercialCore, unitCostBase: 12 });

    await expect(useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_1',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    })).rejects.toThrow(/below allowed cost\/margin/);

    expect(commercialCore.validateCostMargin).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      itemId: 'item_1',
      unitPriceBase: 10,
      unitCostBase: 12,
      source: 'pos',
    }));
    expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
  });

  it('250l-2 posts a below-cost POS sale when an approved override is present', async () => {
    const commercialCore = {
      validateCostMargin: jest.fn().mockResolvedValue({
        allowed: true,
        requiresApproval: false,
        reason: 'BELOW_COST',
      }),
    };
    const { useCase, accountingBridge } = setup({ commercialCore, unitCostBase: 12 });

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_1',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1', approvedCostMarginOverride: true }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    });

    expect(result.grandTotal).toBe(20);
    expect(commercialCore.validateCostMargin).toHaveBeenCalledWith(expect.objectContaining({
      approvedOverride: true,
    }));
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalled();
  });

  it('250l-3 applies a POS threshold promotion before posting totals', async () => {
    const promotionRuleReader = {
      list: jest.fn().mockResolvedValue([{
        id: 'promo_10',
        name: '10% off',
        type: 'THRESHOLD_DISCOUNT',
        status: 'ACTIVE',
        priority: 1,
        scope: 'ALL',
        thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 2, discountPct: 10 },
      }]),
    };
    const { useCase } = setup({
      commercialCore: new CommercialCore(),
      promotionRuleReader,
    });

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_1',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 18 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    });

    expect(result.grandTotal).toBe(18);
    expect(result.discountTotal).toBe(2);
    expect(result.lines[0]).toMatchObject({
      lineDiscount: 2,
      lineTotal: 18,
      appliedPromotionId: 'promo_10',
      appliedPromotionName: '10% off',
    });
  });

  it('FUP-1: hard gate OFF leaves ACTIVE promotions dormant (no discount applied)', async () => {
    __setPromotionsEnabledForTest(false);
    const promotionRuleReader = {
      list: jest.fn().mockResolvedValue([{
        id: 'promo_10',
        name: '10% off',
        type: 'THRESHOLD_DISCOUNT',
        status: 'ACTIVE',
        priority: 1,
        scope: 'ALL',
        thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 2, discountPct: 10 },
      }]),
    };
    const { useCase } = setup({
      commercialCore: new CommercialCore(),
      promotionRuleReader,
    });

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_gated',
      documentNumber: 'R-000002',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    });

    // Gate is OFF → rules are never read, full price stands, no promotion stamped.
    expect(promotionRuleReader.list).not.toHaveBeenCalled();
    expect(result.grandTotal).toBe(20);
    expect(result.discountTotal).toBe(0);
    expect(result.lines[0].appliedPromotionId).toBeUndefined();
  });

  it('250l-3 inserts POS free-goods promotion lines at zero price', async () => {
    const promotionRuleReader = {
      list: jest.fn().mockResolvedValue([{
        id: 'bxgy_1',
        name: 'Buy 2 Get 1',
        type: 'BUY_X_GET_Y',
        status: 'ACTIVE',
        priority: 1,
        scope: 'ALL',
        buyXGetY: { buyQty: 2, getQty: 1 },
      }]),
    };
    const { useCase, inventoryCore } = setup({
      commercialCore: new CommercialCore(),
      promotionRuleReader,
    });

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_1',
      documentNumber: 'R-000001',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
      createdBy: 'cashier_1',
    });

    expect(result.grandTotal).toBe(20);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1]).toMatchObject({
      itemId: 'item_1',
      qty: 1,
      unitPrice: 0,
      lineTotal: 0,
      appliedPromotionId: 'bxgy_1',
      appliedPromotionName: 'Buy 2 Get 1',
    });
    expect(inventoryCore.processOUT).toHaveBeenCalledTimes(2);
  });
});
