import * as fs from 'fs';
import * as path from 'path';
import { PostPosSaleUseCase } from '../../../application/pos/use-cases/PostPosSaleUseCase';
import { TaxEngine } from '../../../application/system-core/tax/TaxEngine';
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

/**
 * Gate #10 — POS must work with the Sales App disabled.
 *
 * "Sales App disabled" means the Sales module's use-cases, controllers, and
 * settings are not part of the running wiring. The owner's POS spec requires a
 * test that proves POS still completes a sale in that world.
 *
 * This file proves it two ways:
 *
 *  1. BEHAVIORAL — the real PostPosSaleUseCase is constructed with ONLY System
 *     Core engine seams (inventory core, accounting bridge, tax engine) plus
 *     plain master-data repositories. No Sales use-case, Sales controller, or
 *     SalesSettings collaborator exists anywhere in the graph, yet a full POS
 *     sale posts: stock OUT + revenue + COGS + settlement, all stamped
 *     POS_DIRECT_SALE. If POS secretly needed the Sales App, this wiring could
 *     not post.
 *
 *  2. STRUCTURAL — the runtime sale-path source files import nothing from the
 *     Sales application or domain. (The folder-wide guard lives in
 *     architecture/SystemCoreBoundaries.test.ts; this is the gate-#10-named
 *     backstop so the intent is discoverable from the POS suite itself.)
 */

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

/**
 * Build the POS posting use-case with ONLY System Core engines + master-data
 * repositories. Deliberately nothing from the Sales App is wired in.
 */
const wirePosWithoutSalesApp = () => {
  const itemRepo = {
    getItem: jest.fn().mockResolvedValue(makeItem()),
    updateItemInTransaction: jest.fn().mockResolvedValue(undefined),
  };
  const itemCategoryRepo = { getCompanyCategories: jest.fn().mockResolvedValue([]) };
  const inventorySettingsRepo = {
    getSettings: jest.fn().mockResolvedValue({
      defaultCOGSAccountId: 'cogs-default',
      defaultInventoryAssetAccountId: 'inv-default',
    }),
  };
  const partyRepo = { getById: jest.fn().mockResolvedValue(makeParty()) };
  const taxCodeRepo = { getById: jest.fn().mockResolvedValue(null) };
  const companyCurrencyRepo = { getBaseCurrency: jest.fn().mockResolvedValue('USD') };
  const inventoryCore = {
    preFetchLevelsByItem: jest.fn().mockResolvedValue([makeLevel(100, 4)]),
    preFetchStockLevel: jest.fn().mockResolvedValue(null),
    writeStockMovement: jest.fn().mockResolvedValue(undefined),
    writeStockLevel: jest.fn().mockResolvedValue(undefined),
  };
  const accountingBridge = {
    recordFinancialEvent: jest.fn().mockResolvedValue({ mode: 'full', voucher: { id: 'v_1' } }),
  };
  const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(null) };

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
    posSettingsRepo as any
    // NOTE: no commercialCore, no promotionRuleReader, and crucially no Sales
    // collaborator of any kind.
  );

  return { useCase, inventoryCore, accountingBridge };
};

describe('Gate #10: POS is independent of the Sales App', () => {
  it('completes a full POS sale posting with no Sales App collaborators wired in', async () => {
    const { useCase, inventoryCore, accountingBridge } = wirePosWithoutSalesApp();

    const result = await useCase.execute({
      companyId: 'cmp_test',
      customerId: 'walk-in-cust',
      documentId: 'pos_sale_1',
      documentNumber: 'R-000001',
      date: '2026-06-22',
      lines: [{ itemId: 'item_1', qty: 2, unitPrice: 10, warehouseId: 'wh1' }],
      payments: [{ method: 'CASH', amount: 20 }],
      paymentMethods: [
        { code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true },
      ],
      createdBy: 'cashier_1',
      transaction: { tx: true },
    });

    // Sale posted end-to-end through engine seams only.
    expect(result.grandTotal).toBe(20);
    expect(result.voucherIds).toContain('v_1');

    // Stock OUT went through the inventory core, stamped with the POS persona.
    expect(inventoryCore.writeStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'OUT',
        movementType: 'SALES_DELIVERY',
        referenceType: 'POS_DIRECT_SALE',
        metadata: expect.objectContaining({ sourceModule: 'pos', documentPersona: 'POS_DIRECT_SALE' }),
      }),
      { tx: true }
    );

    // All financial events went through the accounting bridge, never a Sales poster.
    const kinds = accountingBridge.recordFinancialEvent.mock.calls.map((call: any[]) => call[0].kind);
    expect(kinds).toEqual(expect.arrayContaining(['POS_SALE_REVENUE', 'POS_SALE_COGS', 'POS_SALE_SETTLEMENT']));
    for (const call of accountingBridge.recordFinancialEvent.mock.calls) {
      expect(call[0].subledgerVoucher.metadata).toEqual(
        expect.objectContaining({ documentPersona: 'POS_DIRECT_SALE' }),
      );
    }
  });

  it('keeps the runtime POS sale path free of any Sales application/domain import', () => {
    const salePathFiles = [
      path.resolve(__dirname, '../../../application/pos/use-cases/CompletePosSaleUseCase.ts'),
      path.resolve(__dirname, '../../../application/pos/use-cases/PostPosSaleUseCase.ts'),
    ];

    const offenders: string[] = [];
    for (const file of salePathFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1].replace(/\\/g, '/');
        if (/(^|\/)(application\/sales|domain\/sales)\//.test(specifier) || /\/sales\/(use-cases|services|entities)\//.test(specifier)) {
          offenders.push(`${path.basename(file)} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
