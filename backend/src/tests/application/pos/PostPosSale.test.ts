import { PostPosSaleUseCase } from '../../../application/pos/use-cases/PostPosSaleUseCase';
import { TaxEngine } from '../../../application/system-core/tax/TaxEngine';
import { Item } from '../../../domain/inventory/entities/Item';
import { Party } from '../../../domain/shared/entities/Party';

const makeItem = () =>
  Item.fromJSON({
    id: 'item_1',
    companyId: 'cmp_test',
    code: 'ITEM-1',
    name: 'Widget',
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

const setup = (options: { commercialCore?: any; unitCostBase?: number } = {}) => {
  const itemRepo = { getItem: jest.fn().mockResolvedValue(makeItem()) };
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
    options.commercialCore
  );
  return { useCase, inventoryCore, accountingBridge };
};

describe('PostPosSaleUseCase', () => {
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
});
