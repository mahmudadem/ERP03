import { SimpleTradingCompanyInitializer } from '../SimpleTradingCompanyInitializer';

const periodicAccounts = [
  ['1', 'Assets', 'asset', null],
  ['101', 'Cash & Petty Cash', 'asset', '1'],
  ['10101', 'Cash - Head Office', 'asset', '101'],
  ['102', 'Bank Accounts', 'asset', '1'],
  ['10201', 'Bank - Operating', 'asset', '102'],
  ['103', 'Goods Inventory', 'asset', '1'],
  ['10301', 'Goods / Opening Inventory', 'asset', '103'],
  ['10302', 'Goods / Closing Inventory', 'asset', '103'],
  ['10303', 'Inventory Transfer Clearing', 'asset', '103'],
  ['104', 'Accounts Receivable', 'asset', '1'],
  ['10401', 'Customers Receivable', 'asset', '104'],
  ['2', 'Liabilities', 'liability', null],
  ['201', 'Accounts Payable', 'liability', '2'],
  ['20100', 'Accounts Payable - General', 'liability', '201'],
  ['209', 'GRNI', 'liability', '2'],
  ['3', 'Equity', 'equity', null],
  ['303', 'Opening Balance Equity', 'equity', '3'],
  ['304', 'Inventory Revaluation Reserve', 'equity', '3'],
  ['4', 'Revenue', 'revenue', null],
  ['400', 'Sales', 'revenue', '4'],
  ['401', 'Sales Returns', 'revenue', '4'],
  ['402', 'Sales Discounts', 'revenue', '4'],
  ['406', 'Inventory Adjustment Gain', 'revenue', '4'],
  ['5', 'Expenses', 'expense', null],
  ['501', 'Cost of Goods Sold', 'expense', '5'],
  ['50101', 'Purchases', 'expense', '501'],
  ['50103', 'Purchase Returns', 'expense', '501'],
  ['50104', 'Purchase Discounts Received', 'expense', '501'],
  ['502', 'Operating Expenses', 'expense', '5'],
  ['50202', 'Sales Discounts', 'expense', '502'],
  ['50203', 'Inventory Adjustment Loss', 'expense', '502'],
  ['50204', 'Inventory Revaluation Expense', 'expense', '502'],
].map(([code, name, type, parentCode]) => ({ code, name, type, parentCode }));

const standardAccounts = [
  ['1', 'Assets', 'asset', null],
  ['101', 'Cash & Petty Cash', 'asset', '1'],
  ['10101', 'Cash - Head Office', 'asset', '101'],
  ['102', 'Bank Accounts', 'asset', '1'],
  ['10201', 'Bank - Operating', 'asset', '102'],
  ['103', 'Inventory', 'asset', '1'],
  ['10301', 'Finished Goods', 'asset', '103'],
  ['104', 'Accounts Receivable', 'asset', '1'],
  ['10401', 'Customers Receivable', 'asset', '104'],
  ['2', 'Liabilities', 'liability', null],
  ['201', 'Accounts Payable', 'liability', '2'],
  ['20100', 'Accounts Payable - General', 'liability', '201'],
  ['209', 'GRNI', 'liability', '2'],
  ['3', 'Equity', 'equity', null],
  ['301', 'Owner Capital', 'equity', '3'],
  ['302', 'Retained Earnings', 'equity', '3'],
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
          if (key === 'coa_templates') {
            return [
              { id: 'periodic_trading', accounts: periodicAccounts },
              { id: 'standard', accounts: standardAccounts },
            ];
          }
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
    expect(summary.accounting.coaTemplate).toBe('periodic_trading');
    expect(summary.inventory.accountingMode).toBe('PERIODIC');
    expect(summary.linkedAccounts.inventoryAsset.code).toBe('10301');
    expect(summary.linkedAccounts.transferClearing.code).toBe('10303');
    expect(summary.linkedAccounts.salesReturn.code).toBe('401');
    expect(summary.linkedAccounts.purchaseReturn.code).toBe('50103');
    expect(summary.linkedAccounts.purchaseDiscount.code).toBe('50104');
    expect(summary.linkedAccounts.inventoryGain.code).toBe('406');
    expect(summary.linkedAccounts.inventoryLoss.code).toBe('50203');
    expect(summary.linkedAccounts.revaluationReserve.code).toBe('304');

    expect(inventorySettings[0].defaultInventoryAssetAccountId).toBe(summary.linkedAccounts.inventoryAsset.id);
    expect(inventorySettings[0].defaultInventoryTransferClearingAccountId).toBe(summary.linkedAccounts.transferClearing.id);
    expect(inventorySettings[0].allowNegativeStock).toBe(false);
    expect(inventorySettings[0].costingBasis).toBe('GLOBAL');
    expect(inventorySettings[0].accountingMode).toBe('PERIODIC');
    expect(summary.inventory.costingBasis).toBe('GLOBAL');
    expect(salesSettings[0].workflowMode).toBe('SIMPLE');
    expect(salesSettings[0].arParentAccountId).toBe(summary.linkedAccounts.arParent.id);
    expect(salesSettings[0].defaultSalesReturnAccountId).toBe(summary.linkedAccounts.salesReturn.id);
    expect(purchaseSettings[0].workflowMode).toBe('SIMPLE');
    expect(purchaseSettings[0].defaultAPAccountId).toBe(summary.linkedAccounts.apParent.id);
    expect(purchaseSettings[0].apParentAccountId).toBe(summary.linkedAccounts.apParent.id);
    expect(purchaseSettings[0].defaultPurchaseReturnAccountId).toBe(summary.linkedAccounts.purchaseReturn.id);
    expect(purchaseSettings[0].defaultPurchaseDiscountAccountId).toBe(summary.linkedAccounts.purchaseDiscount.id);
  });

  it('re-seeds the starter policy when mode changes before any transaction history exists', async () => {
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
          if (key === 'coa_templates') {
            return [
              { id: 'periodic_trading', accounts: periodicAccounts },
              { id: 'standard', accounts: standardAccounts },
            ];
          }
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
        getSettings: jest.fn(async () => inventorySettings[inventorySettings.length - 1] || null),
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

    await initializer.execute({
      companyId: 'cmp-1',
      userId: 'user-1',
      baseCurrency: 'SYP',
      accountingMode: 'PERIODIC',
    });

    const summary = await initializer.execute({
      companyId: 'cmp-1',
      userId: 'user-1',
      baseCurrency: 'SYP',
      accountingMode: 'PERPETUAL',
    });

    expect(summary.accounting.coaTemplate).toBe('standard');
    expect(summary.inventory.accountingMode).toBe('PERPETUAL');
    expect(summary.inventory.costingBasis).toBe('WAREHOUSE');
    expect(summary.sales.workflowMode).toBe('OPERATIONAL');
    expect(summary.sales.allowDirectInvoicing).toBe(false);
    expect(summary.sales.defaultSalesInvoicePersona).toBe('linked');
    expect(summary.purchases.workflowMode).toBe('OPERATIONAL');
    expect(summary.purchases.allowDirectInvoicing).toBe(false);
    expect(summary.linkedAccounts.cogs?.code).toBe('50100');
    expect(summary.linkedAccounts.transferClearing?.code).toBe('10303');
    expect(summary.linkedAccounts.openingEquity?.code).toBe('303');

    expect(inventorySettings[inventorySettings.length - 1].accountingMode).toBe('PERPETUAL');
    expect(inventorySettings[inventorySettings.length - 1].costingBasis).toBe('WAREHOUSE');
    expect(salesSettings[salesSettings.length - 1].workflowMode).toBe('OPERATIONAL');
    expect(salesSettings[salesSettings.length - 1].allowDirectInvoicing).toBe(false);
    expect(purchaseSettings[purchaseSettings.length - 1].workflowMode).toBe('OPERATIONAL');
    expect(purchaseSettings[purchaseSettings.length - 1].allowDirectInvoicing).toBe(false);
  });

  it('preserves approval mode and fiscal-year settings on a reseed (preserveCompanyPolicy)', async () => {
    const accounts = new Map<string, any>();
    const modules = new Map<string, any>();
    const inventorySettings: any[] = [];
    const companySettingsUpdateCalls: any[] = [];
    const accountingModuleSaves: any[] = [];

    // The owner configured strict approval (and locked-down posting) before switching mode.
    const existingModuleSettings: Record<string, any> = {
      accounting: {
        coaTemplate: 'periodic_trading',
        approvalRequired: true,
        autoPostEnabled: false,
        allowEditDeletePosted: false,
      },
    };

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
          if (key === 'coa_templates') {
            return [
              { id: 'periodic_trading', accounts: periodicAccounts },
              { id: 'standard', accounts: standardAccounts },
            ];
          }
          if (key === 'currencies') return [{ code: 'SYP', name: 'Syrian Pound', symbol: 'SYP', decimalPlaces: 2 }];
          return [];
        }),
      } as any,
      companyModuleSettingsRepo: {
        getSettings: jest.fn(async (_companyId: string, moduleId: string) => existingModuleSettings[moduleId] || null),
        saveSettings: jest.fn(async (_companyId: string, moduleId: string, settings: any) => {
          if (moduleId === 'accounting') accountingModuleSaves.push(settings);
          existingModuleSettings[moduleId] = settings;
        }),
      } as any,
      companySettingsRepo: {
        updateSettings: jest.fn(async (_companyId: string, data: any) => companySettingsUpdateCalls.push(data)),
      } as any,
      currencyRepo: { seedCurrencies: jest.fn() } as any,
      fiscalYearRepo: { findByCompany: jest.fn(async () => [{ id: 'FY2026' }]), save: jest.fn() } as any,
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
        getSettings: jest.fn(async () => inventorySettings[inventorySettings.length - 1] || null),
        saveSettings: jest.fn(async (settings: any) => inventorySettings.push(settings)),
      } as any,
      warehouseRepo: {
        getCompanyWarehouses: jest.fn(async () => [{ id: 'wh-main', code: 'MAIN' }]),
        createWarehouse: jest.fn(),
      } as any,
      uomRepo: {
        getCompanyUoms: jest.fn(async () => [{ id: 'uom-pcs' }]),
        createUom: jest.fn(),
      } as any,
      salesSettingsRepo: { saveSettings: jest.fn() } as any,
      purchaseSettingsRepo: { saveSettings: jest.fn() } as any,
    });

    await initializer.execute({
      companyId: 'cmp-1',
      userId: 'user-1',
      baseCurrency: 'SYP',
      accountingMode: 'INVOICE_DRIVEN',
      preserveCompanyPolicy: true,
    });

    // Approval mode + fiscal-year configuration must NOT be reset on a reseed.
    expect(companySettingsUpdateCalls).toHaveLength(0);

    // COA template reference is refreshed for the new mode, but the owner's approval/posting
    // policy is carried forward, not reset to the flexible defaults.
    const lastAccountingSave = accountingModuleSaves[accountingModuleSaves.length - 1];
    expect(lastAccountingSave.coaTemplate).toBe('standard');
    expect(lastAccountingSave.approvalRequired).toBe(true);
    expect(lastAccountingSave.autoPostEnabled).toBe(false);
    expect(lastAccountingSave.allowEditDeletePosted).toBe(false);
  });
});
