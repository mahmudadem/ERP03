import { PostPosReturnUseCase } from '../../../application/pos/use-cases/PostPosReturnUseCase';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { Party } from '../../../domain/shared/entities/Party';

const makeLevel = (qty: number, avg: number) => {
  const level = StockLevel.createNew('cmp_test', 'item_1', 'wh1');
  level.qtyOnHand = qty;
  level.avgCostBase = avg;
  level.avgCostCCY = avg;
  level.lastCostBase = avg;
  level.lastCostCCY = avg;
  return level;
};

const makeReceipt = () =>
  PosReceipt.fromJSON({
    id: 'rcp_1',
    companyId: 'cmp_test',
    shiftId: 'shift_1',
    registerId: 'reg_1',
    receiptNumber: 'R-000001',
    status: 'COMPLETED',
    customerId: 'cust_1',
    lines: [{
      itemId: 'item_1',
      itemCode: 'ITEM-1',
      itemName: 'Widget',
      qty: 2,
      uom: 'ea',
      unitPrice: 10,
      lineDiscount: 0,
      lineTotal: 20,
      salesInvoiceLineId: 'pos_line_1',
      revenueAccountId: 'rev-acc',
      taxAccountId: 'tax-acc',
      cogsAccountId: 'cogs-acc',
      inventoryAccountId: 'inv-acc',
      unitCostBase: 4,
      lineCostBase: 8,
    }],
    subtotal: 20,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 20,
    salesInvoiceId: 'pos_sale_1',
    salesInvoiceNumber: 'R-000001',
    createdBy: 'cashier_1',
    createdAt: new Date(),
  });

const makeItem = () =>
  Item.fromJSON({
    id: 'item_1',
    companyId: 'cmp_test',
    code: 'ITEM-1',
    name: 'Widget',
    type: 'PRODUCT',
    baseUom: 'ea',
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
    id: 'cust_1',
    companyId: 'cmp_test',
    code: 'CUST',
    legalName: 'Customer',
    displayName: 'Customer',
    roles: ['CUSTOMER'],
    defaultARAccountId: 'ar-acc',
    active: true,
    createdBy: 'seed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const setup = () => {
  const itemRepo = {
    getItem: jest.fn().mockResolvedValue(makeItem()),
    updateItemInTransaction: jest.fn().mockResolvedValue(undefined),
  };
  const itemCategoryRepo = { getCompanyCategories: jest.fn().mockResolvedValue([]) };
  const inventorySettingsRepo = { getSettings: jest.fn().mockResolvedValue({}) };
  const partyRepo = { getById: jest.fn().mockResolvedValue(makeParty()) };
  const companyCurrencyRepo = { getBaseCurrency: jest.fn().mockResolvedValue('USD') };
  // POS return now mirrors the sale: pre-fetch the level (bare read), compute the
  // RETURN_IN movement with the pure helper, then write inside the transaction.
  const inventoryCore = {
    preFetchStockLevel: jest.fn().mockResolvedValue(makeLevel(5, 4)),
    writeStockMovement: jest.fn().mockResolvedValue(undefined),
    writeStockLevel: jest.fn().mockResolvedValue(undefined),
  };
  const accountingBridge = { recordFinancialEvent: jest.fn().mockResolvedValue({ mode: 'full', voucher: { id: 'v_1' } }) };
  const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(null) };
  const useCase = new PostPosReturnUseCase(
    itemRepo as any,
    itemCategoryRepo as any,
    inventorySettingsRepo as any,
    partyRepo as any,
    companyCurrencyRepo as any,
    inventoryCore as any,
    accountingBridge as any,
    posSettingsRepo as any
  );
  return { useCase, inventoryCore, accountingBridge };
};

describe('PostPosReturnUseCase', () => {
  it('posts a POS return through inventory core and accounting bridge without Sales use-cases', async () => {
    const { useCase, inventoryCore, accountingBridge } = setup();

    const result = await useCase.execute({
      companyId: 'cmp_test',
      originalReceipt: makeReceipt(),
      returnId: 'ret_1',
      returnNumber: 'RET-000001',
      registerId: 'reg_1',
      warehouseId: 'wh1',
      date: '2026-06-21',
      lines: [{ itemId: 'item_1', qty: 1 }],
      refundMethod: 'CASH',
      settlementAccountId: 'cash-acc',
      createdBy: 'cashier_1',
      transaction: { tx: true },
    });

    expect(inventoryCore.writeStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item_1',
        warehouseId: 'wh1',
        qty: 1,
        direction: 'IN',
        movementType: 'RETURN_IN',
        referenceType: 'POS_RETURN',
        metadata: expect.objectContaining({ sourceModule: 'pos', documentPersona: 'POS_DIRECT_SALE' }),
      }),
      { tx: true }
    );
    expect(inventoryCore.writeStockLevel).toHaveBeenCalledWith(expect.anything(), { tx: true });
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'POS_RETURN_REVENUE',
      subledgerVoucher: expect.objectContaining({
        metadata: expect.objectContaining({
          sourceModule: 'pos',
          sourceType: 'POS_RETURN',
          documentPersona: 'POS_DIRECT_SALE',
        }),
      }),
    }));
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'POS_RETURN_COGS' }));
    expect(accountingBridge.recordFinancialEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'POS_RETURN_REFUND' }));
    expect(result.refundTotal).toBe(10);
    expect(result.lines[0].lineCostBase).toBe(4);
  });
});
