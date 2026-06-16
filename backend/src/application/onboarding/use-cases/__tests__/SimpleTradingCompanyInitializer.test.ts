import { SimpleTradingCompanyInitializer } from '../SimpleTradingCompanyInitializer';

const standardAccounts = [
  ['1', 'Assets', 'asset', null],
  ['101', 'Cash & Petty Cash', 'asset', '1'],
  ['10101', 'Cash - Head Office', 'asset', '101'],
  ['102', 'Bank Accounts', 'asset', '1'],
  ['10201', 'Bank - Operating', 'asset', '102'],
  ['103', 'Inventory', 'asset', '1'],
  ['10301', 'Finished Goods', 'asset', '103'],
  ['10302', 'In-Transit Inventory', 'asset', '103'],
  ['104', 'Accounts Receivable', 'asset', '1'],
  ['10401', 'Customers Receivable', 'asset', '104'],
  ['2', 'Liabilities', 'liability', null],
  ['201', 'Accounts Payable', 'liability', '2'],
  ['20100', 'Accounts Payable - General', 'liability', '201'],
  ['209', 'GRNI', 'liability', '2'],
  ['3', 'Equity', 'equity', null],
  ['4', 'Revenue', 'revenue', null],
  ['400', 'Sales Revenue', 'revenue', '4'],
  ['5', 'Expenses', 'expense', null],
  ['501', 'Cost of Goods Sold', 'expense', '5'],
  ['50100', 'Cost of Goods Sold - General', 'expense', '501'],
  ['50101', 'Purchases', 'expense', '501'],
  ['502', 'Operating Expenses', 'expense', '5'],
  ['50202', 'Sales & Marketing', 'expense', '502'],
].map(([code, name, type, parentCode]) => ({ code, name, type, parentCode }));

describe('SimpleTradingCompanyInitializer', () => {
  it('initializes a simple trading company and returns a linked-account policy summary', async () => {
    const accounts = new Map<string, any>();
    const modules = new Map<string, any>();
    const inventorySettings: any[] = [];
    const salesSettings: any[] = [];
    const purchaseSettings: any[] = [];
    const warehouses: any[] = [];

    const accountRepo: any = {
      list: jest.fn(async () => Array.from(accounts.values())),
      getById: jest.fn(async (_companyId: string, id: string) =>
        Array.from(accounts.values()).find((account) => account.id === id) || null
      ),
      getByCode: jest.fn(async (_companyId: string, code: string) => accounts.get(code.toUpperCase()) || null),
      getByUserCode: jest.fn(async (_companyId: string, code: string) => accounts.get(code.toUpperCase()) || null),
      create: jest.fn(async (_companyId: string, data: any) => {
        const code = String(data.userCode || data.code).toUpperCase();
        const account = {
          id: data.id || `acc-${code}`,
          userCode: code,
          name: data.name,
          classification: String(data.classification || data.type).toUpperCase(),
          accountRole: data.accountRole || 'POSTING',
          parentId: data.parentId,
        };
        accounts.set(code, account);
        return account;
      }),
    };

    const companyModuleRepo: any = {
      get: jest.fn(async (_companyId: string, moduleCode: string) => modules.get(moduleCode) || null),
      update: jest.fn(async (_companyId: string, moduleCode: string, data: any) => {
        modules.set(moduleCode, { moduleCode, ...data });
      }),
      create: jest.fn(async (data: any) => {
        modules.set(data.moduleCode, data);
      }),
    };

    const initializer = new SimpleTradingCompanyInitializer({
      companyRepo: {
        findById: jest.fn(async () => ({ id: 'cmp-1', baseCurrency: 'SYP' })),
        update: jest.fn(),
      } as any,
      companyModuleRepo,
      accountRepo,
      systemMetadataRepo: {
        getMetadata: jest.fn(async (key: string) => {
          if (key === 'coa_templates') return [{ id: 'standard', accounts: standardAccounts }];
          if (key === 'currencies') return [{ code: 'SYP', name: 'Syrian Pound', symbol: 'SYP', decimalPlaces: 2 }];
          return [];
        }),
      } as any,
      companyModuleSettingsRepo: { saveSettings: jest.fn() } as any,
      companySettingsRepo: { updateSettings: jest.fn() } as any,
      currencyRepo: { seedCurrencies: jest.fn() } as any,
      fiscalYearRepo: { findByCompany: jest.fn(async () => []), save: jest.fn() } as any,
      voucherTypeRepo: {
        getSystemTemplates: jest.fn(async () => []),
        getByCompanyId: jest.fn(async () => []),
        createVoucherType: jest.fn(),
      } as any,
      voucherFormRepo: {
        getAllByCompany: jest.fn(async () => []),
        create: jest.fn(),
        update: jest.fn(),
      } as any,
      inventorySettingsRepo: {
        getSettings: jest.fn(async () => null),
        saveSettings: jest.fn(async (settings: any) => inventorySettings.push(settings)),
      } as any,
      warehouseRepo: {
        getCompanyWarehouses: jest.fn(async () => warehouses),
        createWarehouse: jest.fn(async (warehouse: any) => warehouses.push(warehouse)),
      } as any,
      uomRepo: {
        getCompanyUoms: jest.fn(async () => []),
        createUom: jest.fn(),
      } as any,
      salesSettingsRepo: {
        saveSettings: jest.fn(async (settings: any) => salesSettings.push(settings)),
      } as any,
      purchaseSettingsRepo: {
        saveSettings: jest.fn(async (settings: any) => purchaseSettings.push(settings)),
      } as any,
    });

    const summary = await initializer.execute({
      companyId: 'cmp-1',
      userId: 'user-1',
      baseCurrency: 'SYP',
    });

    expect(summary.templateId).toBe('simple-trading-company');
    expect(summary.modulesInitialized).toEqual(['accounting', 'inventory', 'sales', 'purchase']);
    expect(summary.linkedAccounts.inventoryAsset.code).toBe('10301');
    expect(summary.linkedAccounts.inventoryGain.code).toBe('406');
    expect(summary.linkedAccounts.inventoryLoss.code).toBe('50203');
    expect(summary.linkedAccounts.revaluationReserve.code).toBe('304');

    expect(inventorySettings[0].defaultInventoryAssetAccountId).toBe(summary.linkedAccounts.inventoryAsset.id);
    expect(inventorySettings[0].defaultInventoryTransferClearingAccountId).toBe(summary.linkedAccounts.transferClearing.id);
    expect(inventorySettings[0].allowNegativeStock).toBe(false);
    expect(inventorySettings[0].costingBasis).toBe('GLOBAL');
    expect(summary.inventory.costingBasis).toBe('GLOBAL');
    expect(salesSettings[0].workflowMode).toBe('SIMPLE');
    expect(salesSettings[0].arParentAccountId).toBe(summary.linkedAccounts.arParent.id);
    expect(purchaseSettings[0].workflowMode).toBe('SIMPLE');
    expect(purchaseSettings[0].defaultAPAccountId).toBe(summary.linkedAccounts.apParent.id);
    expect(purchaseSettings[0].apParentAccountId).toBe(summary.linkedAccounts.apParent.id);
  });
});
