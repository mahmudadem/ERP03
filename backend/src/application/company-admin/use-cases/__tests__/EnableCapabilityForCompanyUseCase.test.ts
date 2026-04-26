import { EnableCapabilityForCompanyUseCase } from '../EnableCapabilityForCompanyUseCase';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../../platform/ModuleAvailabilityService';

const capability = {
  id: 'cap_sales_ai',
  code: 'sales.ai',
  moduleId: 'sales',
  name: 'Sales AI',
  lifecycleStatus: 'ready',
  runtimeStatus: 'available',
  implementationStatus: 'passed',
  enablementPolicy: 'company_admin_optional',
  requiresMigration: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('EnableCapabilityForCompanyUseCase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows legacy companies when the parent module is enabled through company.modules fallback', async () => {
    jest.spyOn(ModuleAvailabilityService, 'getInstance').mockReturnValue({
      isAvailableForCompany: jest.fn().mockResolvedValue({
        available: true,
        state: ModuleAvailabilityState.AVAILABLE,
      }),
    } as any);

    const capabilityRepository = {
      getByCode: jest.fn().mockResolvedValue(capability),
      setEnabled: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new EnableCapabilityForCompanyUseCase(
      { findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: ['sales'] }) } as any,
      capabilityRepository as any,
      {
        hasCapability: jest.fn().mockResolvedValue(true),
        getEffectiveModules: jest.fn().mockResolvedValue(['sales']),
      } as any,
      { listByCompany: jest.fn().mockResolvedValue([]) } as any
    );

    await expect(
      useCase.execute({ companyId: 'cmp_1', capabilityCode: 'sales.ai' })
    ).resolves.toEqual({ capabilityCode: 'sales.ai', status: 'enabled' });

    expect(capabilityRepository.setEnabled).toHaveBeenCalledWith('cmp_1', 'sales.ai', true);
  });

  it('blocks enable when the parent module is enabled but not runtime-available', async () => {
    jest.spyOn(ModuleAvailabilityService, 'getInstance').mockReturnValue({
      isAvailableForCompany: jest.fn().mockResolvedValue({
        available: false,
        state: ModuleAvailabilityState.SUSPENDED,
        reason: 'Module is temporarily suspended',
      }),
    } as any);

    const capabilityRepository = {
      getByCode: jest.fn().mockResolvedValue(capability),
      setEnabled: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new EnableCapabilityForCompanyUseCase(
      { findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: ['sales'] }) } as any,
      capabilityRepository as any,
      {
        hasCapability: jest.fn().mockResolvedValue(true),
        getEffectiveModules: jest.fn().mockResolvedValue(['sales']),
      } as any,
      { listByCompany: jest.fn().mockResolvedValue([]) } as any
    );

    await expect(
      useCase.execute({ companyId: 'cmp_1', capabilityCode: 'sales.ai' })
    ).rejects.toThrow('Parent module sales must be enabled and available first');

    expect(capabilityRepository.setEnabled).not.toHaveBeenCalled();
  });
});
