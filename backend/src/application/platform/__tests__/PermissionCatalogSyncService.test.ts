import { PermissionCatalogSyncService } from '../PermissionCatalogSyncService';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../ModuleAvailabilityService';
import { ModuleRegistry } from '../ModuleRegistry';
import { CreatePermissionUseCase } from '../../super-admin/use-cases/CreatePermissionUseCase';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

function overrideContainer(key: string, value: any) {
  if (!originalDescriptors.has(key)) {
    originalDescriptors.set(key, Object.getOwnPropertyDescriptor(diContainer, key));
  }
  Object.defineProperty(diContainer, key, {
    configurable: true,
    get: () => value,
  });
}

function restoreContainer() {
  for (const [key, descriptor] of originalDescriptors) {
    if (descriptor) {
      Object.defineProperty(diContainer, key, descriptor);
    } else {
      delete (diContainer as any)[key];
    }
  }
  originalDescriptors.clear();
}

describe('PermissionCatalogSyncService', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('formats permission name correctly', () => {
    const service = new PermissionCatalogSyncService() as any;
    
    expect(service.formatPermissionName('test.view')).toBe('View Manage');
    expect(service.formatPermissionName('inventory.accounts.view')).toBe('Accounts View');
  });

  it('formats permission description correctly', () => {
    const service = new PermissionCatalogSyncService() as any;
    
    expect(service.formatPermissionDescription('test.view', 'test', 'view')).toBe('View test data');
    expect(service.formatPermissionDescription('test.accounts.manage', 'test', 'manage')).toBe('Manage test settings and configuration');
  });

  it('capitalizes correctly', () => {
    const service = new PermissionCatalogSyncService() as any;
    
    expect(service.capitalize('view')).toBe('View');
    expect(service.capitalize('manage')).toBe('Manage');
  });

  it('extracts permissions from compiled JavaScript route guard calls', () => {
    const routesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-routes-'));
    fs.writeFileSync(
      path.join(routesDir, 'accounting.routes.js'),
      [
        "router.get('/x', (0, permissionGuard_1.permissionGuard)('accounting.vouchers.post'), handler);",
        "router.use('/admin', (0, ownerOrPermissionGuard_1.ownerOrPermissionGuard)('system.company.manage'), handler);",
      ].join('\n')
    );

    const service = new PermissionCatalogSyncService() as any;
    service.routesDir = routesDir;

    expect(service.collectRoutePermissions().sort()).toEqual([
      'accounting.vouchers.post',
      'system.company.manage',
    ]);
  });

  it('returns only permissions for runtime-available modules and enabled capabilities', async () => {
    overrideContainer('permissionRegistryRepository', {
      getAll: jest.fn().mockResolvedValue([
        { id: 'sales.orders.manage', name: 'Sales Orders', description: '', createdAt: new Date(), updatedAt: new Date() },
        { id: 'inventory.items.manage', name: 'Inventory Items', description: '', createdAt: new Date(), updatedAt: new Date() },
        { id: 'sales.ai.use', name: 'Sales AI', description: '', createdAt: new Date(), updatedAt: new Date() },
        { id: 'system.company.manage', name: 'Company Admin', description: '', createdAt: new Date(), updatedAt: new Date() },
      ]),
    });
    overrideContainer('companyRepository', {
      findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: [] }),
    });
    overrideContainer('companyEntitlementRepository', {
      getEffectiveModules: jest.fn().mockResolvedValue(['sales', 'inventory']),
      getEffectiveCapabilities: jest.fn().mockResolvedValue(['sales.ai']),
    });
    overrideContainer('companyModuleRepository', {
      listByCompany: jest.fn().mockResolvedValue([
        { companyId: 'cmp_1', moduleCode: 'sales', isEnabled: true },
        { companyId: 'cmp_1', moduleCode: 'inventory', isEnabled: true },
      ]),
    });
    overrideContainer('capabilityRegistryRepository', {
      getAll: jest.fn().mockResolvedValue([
        {
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
        },
      ]),
      getByCompanyId: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(ModuleAvailabilityService, 'getInstance').mockReturnValue({
      isAvailableForCompany: jest.fn().mockImplementation(async (moduleId: string) => ({
        available: moduleId === 'sales',
        state: moduleId === 'sales' ? ModuleAvailabilityState.AVAILABLE : ModuleAvailabilityState.SUSPENDED,
      })),
    } as any);

    const permissions = await new PermissionCatalogSyncService().getAvailablePermissions('cmp_1');

    expect(permissions.map((p) => p.id).sort()).toEqual([
      'sales.orders.manage',
      'system.company.manage',
    ]);
  });

  it('blocks creating permissions owned by module manifests', async () => {
    const registry = ModuleRegistry.getInstance();
    const moduleId = `testmodule_${Date.now()}`;
    registry.register({
      metadata: {
        id: moduleId,
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test module',
      },
      permissions: [`${moduleId}.view`],
      getManifest: () => ({
        id: moduleId,
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test module',
        requiredPermissions: [`${moduleId}.view`],
      }),
      getRouter: jest.fn() as any,
    } as any);

    const useCase = new CreatePermissionUseCase({
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    } as any);

    await expect(
      useCase.execute({
        id: `${moduleId}.view`,
        name: 'Test View',
        description: 'Test view',
      })
    ).rejects.toThrow('Cannot create manifest-owned permission');
  });
});
