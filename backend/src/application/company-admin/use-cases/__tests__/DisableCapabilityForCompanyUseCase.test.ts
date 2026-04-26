import { DisableCapabilityForCompanyUseCase } from '../DisableCapabilityForCompanyUseCase';

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

describe('DisableCapabilityForCompanyUseCase', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('disables an enabled capability', async () => {
    const capabilityRepository = {
      getByCompanyAndCapability: jest.fn().mockResolvedValue({
        companyId: 'cmp_1',
        capabilityId: 'sales.ai',
        isEnabled: true,
      }),
      setEnabled: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new DisableCapabilityForCompanyUseCase(
      { findById: jest.fn().mockResolvedValue({ id: 'cmp_1' }) } as any,
      capabilityRepository as any
    );

    await expect(
      useCase.execute({ companyId: 'cmp_1', capabilityCode: 'sales.ai' })
    ).resolves.toEqual({ capabilityCode: 'sales.ai', status: 'disabled' });

    expect(capabilityRepository.setEnabled).toHaveBeenCalledWith('cmp_1', 'sales.ai', false);
  });

  it('throws when capability is not enabled', async () => {
    const capabilityRepository = {
      getByCompanyAndCapability: jest.fn().mockResolvedValue({
        companyId: 'cmp_1',
        capabilityId: 'sales.ai',
        isEnabled: false,
      }),
      setEnabled: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new DisableCapabilityForCompanyUseCase(
      { findById: jest.fn().mockResolvedValue({ id: 'cmp_1' }) } as any,
      capabilityRepository as any
    );

    await expect(
      useCase.execute({ companyId: 'cmp_1', capabilityCode: 'sales.ai' })
    ).rejects.toThrow('Capability is not enabled for this company');

    expect(capabilityRepository.setEnabled).not.toHaveBeenCalled();
  });

  it('throws when company not found', async () => {
    const capabilityRepository = {
      getByCompanyAndCapability: jest.fn().mockResolvedValue(null),
      setEnabled: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new DisableCapabilityForCompanyUseCase(
      { findById: jest.fn().mockResolvedValue(null) } as any,
      capabilityRepository as any
    );

    await expect(
      useCase.execute({ companyId: 'cmp_invalid', capabilityCode: 'sales.ai' })
    ).rejects.toThrow('Company not found');
  });

  it('throws when missing required fields', async () => {
    const useCase = new DisableCapabilityForCompanyUseCase(
      {} as any,
      {} as any
    );

    await expect(
      useCase.execute({ companyId: '', capabilityCode: '' })
    ).rejects.toThrow('Missing required fields');
  });
});