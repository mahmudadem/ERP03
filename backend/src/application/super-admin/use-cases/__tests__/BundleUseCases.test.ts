import { ListAvailableBundlesUseCase } from '../../../company-admin/use-cases/ListAvailableBundlesUseCase';
import { CreateBundleUseCase } from '../CreateBundleUseCase';
import { UpdateBundleUseCase } from '../UpdateBundleUseCase';
import { IBundleRegistryRepository } from '../../../../repository/interfaces/super-admin/IBundleRegistryRepository';

describe('Bundle use cases', () => {
  let mockBundleRepo: jest.Mocked<IBundleRegistryRepository>;

  beforeEach(() => {
    mockBundleRepo = {
      getAll: jest.fn(),
      getById: jest.fn(),
      getByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getReady: jest.fn(),
    };
  });

  it('lists only ready bundles for company admin', async () => {
    mockBundleRepo.getReady.mockResolvedValue([
      {
        id: 'bundle_ready',
        name: 'Ready',
        description: 'Ready bundle',
        businessDomains: ['retail'],
        modulesIncluded: ['sales'],
        lifecycleStatus: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await new ListAvailableBundlesUseCase(mockBundleRepo).execute();

    expect(mockBundleRepo.getReady).toHaveBeenCalledTimes(1);
    expect(mockBundleRepo.getAll).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        bundleId: 'bundle_ready',
        lifecycleStatus: 'ready',
      }),
    ]);
  });

  it('passes module and capability items when creating a bundle', async () => {
    await new CreateBundleUseCase(mockBundleRepo).execute({
      id: 'bundle_crm',
      name: 'CRM',
      description: 'CRM bundle',
      businessDomains: ['service'],
      modulesIncluded: ['crm'],
      capabilities: ['crm.smartScoring'],
      lifecycleStatus: 'ready',
    });

    expect(mockBundleRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'bundle_crm',
      modulesIncluded: ['crm'],
      capabilities: ['crm.smartScoring'],
      lifecycleStatus: 'ready',
    }));
  });

  it('passes module and capability updates to the repository', async () => {
    await new UpdateBundleUseCase(mockBundleRepo).execute({
      id: 'bundle_crm',
      modulesIncluded: ['crm', 'sales'],
      capabilities: ['crm.smartScoring'],
    });

    expect(mockBundleRepo.update).toHaveBeenCalledWith('bundle_crm', expect.objectContaining({
      modulesIncluded: ['crm', 'sales'],
      capabilities: ['crm.smartScoring'],
    }));
  });
});
