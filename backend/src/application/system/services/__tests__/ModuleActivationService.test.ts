import { ModuleActivationService } from '../ModuleActivationService';
import { ICompanyModuleRepository } from '../../../../repository/interfaces/company/ICompanyModuleRepository';

describe('ModuleActivationService', () => {
  let mockRepo: jest.Mocked<ICompanyModuleRepository>;
  let service: ModuleActivationService;
  const companyId = 'test-company-123';
  const userId = 'user-456';

  beforeEach(() => {
    mockRepo = {
      get: jest.fn(),
      listByCompany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchCreate: jest.fn(),
    };
    service = new ModuleActivationService(mockRepo);
  });

  test('activateModule should activate accounting implicitly when HR is activated', async () => {
    mockRepo.get.mockResolvedValue(null); // Nothing installed yet

    await service.activateModule(companyId, 'hr', userId);

    // Should create Accounting (Implicitly)
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      moduleCode: 'accounting',
      config: expect.objectContaining({ isImplicit: true })
    }));

    // Should create HR (Explicitly)
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      moduleCode: 'hr',
      config: expect.objectContaining({ isImplicit: false })
    }));
  });

  test('activateModule should not recreate module if already exists', async () => {
    mockRepo.get.mockResolvedValue({
      companyId,
      moduleCode: 'accounting',
      installedAt: new Date(),
      initialized: true,
      initializationStatus: 'complete',
      config: { isImplicit: false }
    } as any);

    await service.activateModule(companyId, 'accounting', userId);

    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  test('activateModule should promote implicit module to explicit when requested', async () => {
    mockRepo.get.mockResolvedValueOnce({
       moduleCode: 'accounting',
       config: { isImplicit: true }
    } as any);

    await service.activateModule(companyId, 'accounting', userId);

    expect(mockRepo.update).toHaveBeenCalledWith(companyId, 'accounting', expect.objectContaining({
      config: expect.objectContaining({ isImplicit: false })
    }));
  });

  test('getActiveModules should filter out implicit modules by default', async () => {
    mockRepo.listByCompany.mockResolvedValue([
      { moduleCode: 'accounting', config: { isImplicit: true } },
      { moduleCode: 'hr', config: { isImplicit: false } }
    ] as any);

    const active = await service.getActiveModules(companyId, false);
    expect(active).toEqual(['hr']);

    const all = await service.getActiveModules(companyId, true);
    expect(all).toEqual(['accounting', 'hr']);
  });
});
