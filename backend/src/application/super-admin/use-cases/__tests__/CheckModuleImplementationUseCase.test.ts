import { CheckModuleImplementationUseCase } from '../CheckModuleImplementationUseCase';
import { IModuleRegistryRepository } from '../../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleRegistry } from '../../../platform/ModuleRegistry';
import { IModule } from '../../../../domain/platform/IModule';

describe('CheckModuleImplementationUseCase', () => {
  let moduleRepo: jest.Mocked<IModuleRegistryRepository>;
  let codeRegistry: ModuleRegistry;

  const codeModule: IModule = {
    metadata: {
      id: 'sales',
      name: 'Sales',
      version: '1.0.0',
      description: 'Sales module',
    },
    permissions: ['sales.view'],
    getManifest: () => ({
      id: 'sales',
      name: 'Sales',
      version: '1.0.0',
      description: 'Sales module',
      requiredPermissions: ['sales.view'],
    }),
    getRouter: () => ({}) as any,
  };

  beforeEach(() => {
    moduleRepo = {
      getAll: jest.fn(),
      getById: jest.fn(),
      getByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateImplementationCheck: jest.fn(),
      updateLifecycleStatus: jest.fn(),
      updateRuntimeStatus: jest.fn(),
      delete: jest.fn(),
      getByLifecycleStatus: jest.fn(),
    } as any;

    codeRegistry = ModuleRegistry.getInstance();
    (codeRegistry as any).modules = new Map([['sales', codeModule]]);
  });

  it('updates implementation check using DB id when module is found by code', async () => {
    moduleRepo.getById.mockResolvedValue(null);
    moduleRepo.getByCode.mockResolvedValue({
      id: 'module-sales',
      code: 'sales',
      name: 'Sales',
      description: 'Sales module',
      version: '1.0.0',
      lifecycleStatus: 'draft',
      runtimeStatus: 'available',
      implementationStatus: 'unchecked',
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await new CheckModuleImplementationUseCase(moduleRepo, codeRegistry).execute('sales');

    expect(result.status).toBe('passed');
    expect(moduleRepo.updateImplementationCheck).toHaveBeenCalledWith(
      'module-sales',
      'passed',
      null,
      expect.any(Date)
    );
  });
});
