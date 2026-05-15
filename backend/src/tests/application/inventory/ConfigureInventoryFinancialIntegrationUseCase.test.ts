import { describe, expect, it, jest } from '@jest/globals';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';
import { ConfigureInventoryFinancialIntegrationUseCase } from '../../../application/inventory/use-cases/ConfigureInventoryFinancialIntegrationUseCase';

const COMPANY_ID = 'cmp-1';

const makeSettings = (overrides: Partial<InventorySettings> = {}) =>
  new InventorySettings({
    companyId: COMPANY_ID,
    accountingMode: 'INVOICE_DRIVEN',
    inventoryAccountingMethod: 'PERIODIC',
    defaultCostingMethod: 'MOVING_AVG',
    defaultCostCurrency: 'USD',
    defaultInventoryAssetAccountId: 'INV-DEFAULT',
    allowNegativeStock: true,
    defaultWarehouseId: 'wh-1',
    autoGenerateItemCode: false,
    itemCodePrefix: 'IT',
    itemCodeNextSeq: 7,
    defaultCOGSAccountId: 'COGS-DEFAULT',
    ...overrides,
  });

const makeCompanyModuleRepo = (initialized = true) => ({
  get: jest.fn(async () => ({
    companyId: COMPANY_ID,
    moduleKey: 'accounting',
    initialized,
  })),
});

const makeAccount = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc-1',
  status: 'ACTIVE',
  accountRole: 'POSTING',
  ...overrides,
});

describe('ConfigureInventoryFinancialIntegrationUseCase', () => {
  it('requires the accounting module to be initialized', async () => {
    const settingsRepo = {
      getSettings: jest.fn(async () => makeSettings()),
      saveSettings: jest.fn(async () => undefined),
    };

    const useCase = new ConfigureInventoryFinancialIntegrationUseCase(
      settingsRepo as any,
      makeCompanyModuleRepo(false) as any,
      { getById: jest.fn(async () => null) } as any,
      { getItemMovements: jest.fn(async () => []), getMovementsByDateRange: jest.fn(async () => []), hasAnyMovements: jest.fn(async () => false) } as any
    );

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        accountingMethod: 'PERPETUAL',
        accountingMode: 'PERPETUAL',
        defaultInventoryAssetAccountId: 'INV-100',
        defaultCOGSAccountId: 'COGS-100',
      })
    ).rejects.toThrow('Accounting module must be initialized');

    expect(settingsRepo.saveSettings).not.toHaveBeenCalled();
  });

  it('requires perpetual-mode default accounts', async () => {
    const useCase = new ConfigureInventoryFinancialIntegrationUseCase(
      {
        getSettings: jest.fn(async () => makeSettings()),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      makeCompanyModuleRepo() as any,
      { getById: jest.fn(async () => null) } as any,
      { getItemMovements: jest.fn(async () => []), getMovementsByDateRange: jest.fn(async () => []), hasAnyMovements: jest.fn(async () => false) } as any
    );

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        accountingMethod: 'PERPETUAL',
        accountingMode: 'PERPETUAL',
      })
    ).rejects.toThrow('Default Inventory Asset Account is required');
  });

  it('rejects invalid perpetual inventory accounts', async () => {
    const accountRepo = {
      getById: jest
        .fn(async (_companyId: string, accountId: string) =>
          accountId === 'INV-100' ? makeAccount({ status: 'INACTIVE' }) : makeAccount({ id: accountId })
        ),
    };

    const useCase = new ConfigureInventoryFinancialIntegrationUseCase(
      {
        getSettings: jest.fn(async () => makeSettings()),
        saveSettings: jest.fn(async () => undefined),
      } as any,
      makeCompanyModuleRepo() as any,
      accountRepo as any,
      { getItemMovements: jest.fn(async () => []), getMovementsByDateRange: jest.fn(async () => []), hasAnyMovements: jest.fn(async () => false) } as any
    );

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        accountingMethod: 'PERPETUAL',
        accountingMode: 'PERPETUAL',
        defaultInventoryAssetAccountId: 'INV-100',
        defaultCOGSAccountId: 'COGS-100',
      })
    ).rejects.toThrow('Invalid Inventory Asset Account');

    expect(accountRepo.getById).toHaveBeenCalledWith(COMPANY_ID, 'INV-100');
  });

  it('saves a perpetual configuration after validating both accounts', async () => {
    const existingSettings = makeSettings({
      allowNegativeStock: false,
      autoGenerateItemCode: true,
      itemCodePrefix: 'SKU',
      itemCodeNextSeq: 42,
    });
    const saveSettings = jest.fn(async (_settings: InventorySettings) => undefined);
    const settingsRepo = {
      getSettings: jest.fn(async () => existingSettings),
      saveSettings,
    };
    const accountRepo = {
      getById: jest.fn(async (_companyId: string, accountId: string) => makeAccount({ id: accountId })),
    };

    const useCase = new ConfigureInventoryFinancialIntegrationUseCase(
      settingsRepo as any,
      makeCompanyModuleRepo() as any,
      accountRepo as any,
      { getItemMovements: jest.fn(async () => []), getMovementsByDateRange: jest.fn(async () => []), hasAnyMovements: jest.fn(async () => false) } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      accountingMethod: 'PERPETUAL',
      accountingMode: 'PERPETUAL',
      defaultInventoryAssetAccountId: 'INV-200',
      defaultCOGSAccountId: 'COGS-200',
    });

    expect(accountRepo.getById).toHaveBeenCalledTimes(2);
    expect(saveSettings).toHaveBeenCalledTimes(1);
    const savedSettings = saveSettings.mock.calls[0][0];
    expect(savedSettings.inventoryAccountingMethod).toBe('PERPETUAL');
    expect(savedSettings.accountingMode).toBe('PERPETUAL');
    expect(savedSettings.defaultInventoryAssetAccountId).toBe('INV-200');
    expect(savedSettings.defaultCOGSAccountId).toBe('COGS-200');
    expect(savedSettings.allowNegativeStock).toBe(false);
    expect(savedSettings.autoGenerateItemCode).toBe(true);
    expect(savedSettings.itemCodePrefix).toBe('SKU');
    expect(savedSettings.itemCodeNextSeq).toBe(42);
  });

  it('saves invoice-driven configuration without looking up accounts', async () => {
    const saveSettings = jest.fn(async (_settings: InventorySettings) => undefined);
    const settingsRepo = {
      getSettings: jest.fn(async () => makeSettings({ accountingMode: 'PERPETUAL', inventoryAccountingMethod: 'PERPETUAL' })),
      saveSettings,
    };
    const accountRepo = { getById: jest.fn(async () => makeAccount()) };

    const useCase = new ConfigureInventoryFinancialIntegrationUseCase(
      settingsRepo as any,
      makeCompanyModuleRepo() as any,
      accountRepo as any,
      { getItemMovements: jest.fn(async () => []), getMovementsByDateRange: jest.fn(async () => []), hasAnyMovements: jest.fn(async () => false) } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      accountingMethod: 'PERIODIC',
      accountingMode: 'INVOICE_DRIVEN',
    });

    expect(accountRepo.getById).not.toHaveBeenCalled();
    const savedSettings = saveSettings.mock.calls[0][0];
    expect(savedSettings.inventoryAccountingMethod).toBe('PERIODIC');
    expect(savedSettings.accountingMode).toBe('INVOICE_DRIVEN');
    expect(savedSettings.defaultInventoryAssetAccountId).toBeUndefined();
    expect(savedSettings.defaultCOGSAccountId).toBeUndefined();
  });

  it('returns a historical summary with earliest movement date when data exists', async () => {
    const movementRepo = {
      getItemMovements: jest.fn(async () => [{ id: 'mov-1', date: '2026-01-15' }]),
      getMovementsByDateRange: jest.fn(async () => [{ id: 'mov-1', date: '2025-12-31' }]),
      hasAnyMovements: jest.fn(async () => true),
    };

    const useCase = new ConfigureInventoryFinancialIntegrationUseCase(
      { getSettings: jest.fn(async () => makeSettings()), saveSettings: jest.fn(async () => undefined) } as any,
      makeCompanyModuleRepo() as any,
      { getById: jest.fn(async () => null) } as any,
      movementRepo as any
    );

    await expect(useCase.getHistoricalSummary(COMPANY_ID)).resolves.toEqual({
      hasHistoricalData: true,
      movementCount: 1,
      earliestDate: '2025-12-31',
    });
  });
});
