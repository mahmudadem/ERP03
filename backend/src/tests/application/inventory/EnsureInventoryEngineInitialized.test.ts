import { EnsureInventoryEngineInitialized } from '../../../application/inventory/use-cases/EnsureInventoryEngineInitialized';

describe('EnsureInventoryEngineInitialized (Task 254)', () => {
  const makeDeps = (moduleState: any, company: any = { id: 'cmp_1', baseCurrency: 'USD' }) => {
    const companyModuleRepo = { get: jest.fn().mockResolvedValue(moduleState) } as any;
    const companyRepo = { findById: jest.fn().mockResolvedValue(company) } as any;
    const initializeInventoryUseCase = { execute: jest.fn().mockResolvedValue({ settings: {}, defaultWarehouse: null }) } as any;
    return { companyModuleRepo, companyRepo, initializeInventoryUseCase };
  };

  it('no-ops when the inventory engine is already initialized', async () => {
    const { companyModuleRepo, companyRepo, initializeInventoryUseCase } = makeDeps({ moduleCode: 'inventory', initialized: true });
    const ensure = new EnsureInventoryEngineInitialized(companyModuleRepo, companyRepo, initializeInventoryUseCase);

    await ensure.execute('cmp_1');

    expect(initializeInventoryUseCase.execute).not.toHaveBeenCalled();
    expect(companyRepo.findById).not.toHaveBeenCalled();
  });

  it('initializes the engine (with base currency, no GL accounts required) when not initialized', async () => {
    const { companyModuleRepo, companyRepo, initializeInventoryUseCase } = makeDeps({ moduleCode: 'inventory', initialized: false });
    const ensure = new EnsureInventoryEngineInitialized(companyModuleRepo, companyRepo, initializeInventoryUseCase);

    await ensure.execute('cmp_1', 'user_7');

    expect(initializeInventoryUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'cmp_1', userId: 'user_7', defaultCostCurrency: 'USD' })
    );
  });

  it('treats a disabled-but-initialized module as ready (isEnabled is irrelevant)', async () => {
    const { companyModuleRepo, companyRepo, initializeInventoryUseCase } = makeDeps({ moduleCode: 'inventory', isEnabled: false, initialized: true });
    const ensure = new EnsureInventoryEngineInitialized(companyModuleRepo, companyRepo, initializeInventoryUseCase);

    await ensure.execute('cmp_1');

    expect(initializeInventoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('throws when the company is missing', async () => {
    const { companyModuleRepo, companyRepo, initializeInventoryUseCase } = makeDeps({ moduleCode: 'inventory', initialized: false }, null);
    const ensure = new EnsureInventoryEngineInitialized(companyModuleRepo, companyRepo, initializeInventoryUseCase);

    await expect(ensure.execute('cmp_1')).rejects.toThrow(/company not found/i);
    expect(initializeInventoryUseCase.execute).not.toHaveBeenCalled();
  });
});
