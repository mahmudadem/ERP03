import { AuthPermissionsController } from '../controllers/auth/AuthPermissionsController';
import { tenantContextMiddleware } from '../middlewares/tenantContextMiddleware';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../application/platform/ModuleAvailabilityService';

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

function mockAvailabilityService(availableModules: string[]) {
  jest.spyOn(ModuleAvailabilityService, 'getInstance').mockReturnValue({
    isAvailableForCompany: jest.fn().mockImplementation(async (moduleId: string) => ({
      available: availableModules.includes(moduleId.toLowerCase()),
      state: availableModules.includes(moduleId.toLowerCase())
        ? ModuleAvailabilityState.AVAILABLE
        : ModuleAvailabilityState.NOT_READY,
    })),
    getAvailableModulesForCompany: jest.fn().mockResolvedValue(availableModules),
    getAvailabilityInfo: jest.fn((moduleId: string) => ({
      moduleId,
      state: ModuleAvailabilityState.AVAILABLE,
      hasRouter: true,
      entitlementsMissing: false,
    })),
  } as any);
}

describe('Phase 3 module access integration', () => {
  beforeEach(() => {
    overrideContainer('capabilityRegistryRepository', {
      getAll: jest.fn().mockResolvedValue([]),
      getByCompanyId: jest.fn().mockResolvedValue([]),
    });
    overrideContainer('companyEntitlementRepository', {
      getEffectiveCapabilities: jest.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('AuthPermissionsController intersects enabled modules with role grants', async () => {
    overrideContainer('rbacCompanyUserRepository', {
      getByUserAndCompany: jest.fn().mockResolvedValue({ userId: 'u1', companyId: 'cmp_1', roleId: 'MEMBER', isOwner: false }),
    });
    overrideContainer('companyRoleRepository', {
      getById: jest.fn().mockResolvedValue({ id: 'MEMBER', companyId: 'cmp_1', name: 'Member', moduleBundles: ['sales'], permissions: [] }),
    });
    overrideContainer('companyRepository', {
      findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: [] }),
    });
    overrideContainer('companyModuleRepository', {
      listByCompany: jest.fn().mockResolvedValue([
        { companyId: 'cmp_1', moduleCode: 'sales', isEnabled: true },
        { companyId: 'cmp_1', moduleCode: 'inventory', isEnabled: true },
      ]),
    });
    overrideContainer('entitlementService', {
      getEntitledModules: jest.fn().mockResolvedValue(['sales', 'inventory']),
    });
    mockAvailabilityService(['sales', 'inventory']);

    const req: any = { user: { uid: 'u1', companyId: 'cmp_1', isSuperAdmin: false } };
    const res: any = { json: jest.fn() };
    const next = jest.fn();

    await AuthPermissionsController.getMyPermissions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.moduleBundles).toEqual(['sales']);
  });

  it('tenantContextMiddleware does not treat an empty member role as wildcard', async () => {
    overrideContainer('companyRepository', {
      findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: [] }),
    });
    overrideContainer('companyRoleRepository', {
      getById: jest.fn().mockResolvedValue({ id: 'MEMBER', companyId: 'cmp_1', name: 'Member', moduleBundles: [], permissions: [] }),
    });
    overrideContainer('companyModuleRepository', {
      listByCompany: jest.fn().mockResolvedValue([
        { companyId: 'cmp_1', moduleCode: 'sales', isEnabled: true },
        { companyId: 'cmp_1', moduleCode: 'inventory', isEnabled: true },
      ]),
    });
    overrideContainer('entitlementService', {
      getEntitledModules: jest.fn().mockResolvedValue(['sales', 'inventory']),
    });
    mockAvailabilityService(['sales', 'inventory']);

    const req: any = { user: { uid: 'u1', companyId: 'cmp_1', roleId: 'MEMBER', isOwner: false } };
    const next = jest.fn();

    await tenantContextMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.tenantContext.modules).toEqual([]);
  });

  it('tenantContextMiddleware allows explicit owner wildcard only', async () => {
    overrideContainer('companyRepository', {
      findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: [] }),
    });
    overrideContainer('companyRoleRepository', {
      getById: jest.fn().mockResolvedValue({ id: 'OWNER', companyId: 'cmp_1', name: 'Owner', moduleBundles: [], permissions: [] }),
    });
    overrideContainer('companyModuleRepository', {
      listByCompany: jest.fn().mockResolvedValue([
        { companyId: 'cmp_1', moduleCode: 'sales', isEnabled: true },
        { companyId: 'cmp_1', moduleCode: 'inventory', isEnabled: true },
      ]),
    });
    overrideContainer('entitlementService', {
      getEntitledModules: jest.fn().mockResolvedValue(['sales', 'inventory']),
    });
    mockAvailabilityService(['sales', 'inventory']);

    const req: any = { user: { uid: 'u1', companyId: 'cmp_1', roleId: 'OWNER', isOwner: true } };
    const next = jest.fn();

    await tenantContextMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.tenantContext.modules).toEqual(['sales', 'inventory']);
  });

  it('tenantContextMiddleware does not fall back when all CompanyModule records are disabled', async () => {
    overrideContainer('companyRepository', {
      findById: jest.fn().mockResolvedValue({ id: 'cmp_1', modules: ['sales', 'inventory'] }),
    });
    overrideContainer('companyRoleRepository', {
      getById: jest.fn().mockResolvedValue({ id: 'OWNER', companyId: 'cmp_1', name: 'Owner', moduleBundles: [], permissions: [] }),
    });
    overrideContainer('companyModuleRepository', {
      listByCompany: jest.fn().mockResolvedValue([
        { companyId: 'cmp_1', moduleCode: 'sales', isEnabled: false },
        { companyId: 'cmp_1', moduleCode: 'inventory', isEnabled: false },
      ]),
    });
    overrideContainer('entitlementService', {
      getEntitledModules: jest.fn().mockResolvedValue(['sales', 'inventory']),
    });
    mockAvailabilityService(['sales', 'inventory']);

    const req: any = { user: { uid: 'u1', companyId: 'cmp_1', roleId: 'OWNER', isOwner: true } };
    const next = jest.fn();

    await tenantContextMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.tenantContext.modules).toEqual([]);
  });
});
