/**
 * ModuleAvailabilityService Tests
 *
 * Tests for DB-only, code-only, version mismatch, suspended, deprecated, and ready cases.
 */
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../ModuleAvailabilityService';
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleRegistry as CodeModuleRegistry } from '../ModuleRegistry';
import { IEntitlementService } from '../IEntitlementService';
import { ModuleDefinition, LifecycleStatus, RuntimeStatus, ImplementationStatus } from '../../../domain/super-admin/ModuleDefinition';
import { IModule } from '../../../domain/platform/IModule';

describe('ModuleAvailabilityService', () => {
  let mockRepo: jest.Mocked<IModuleRegistryRepository>;
  let codeRegistry: CodeModuleRegistry;
  let mockEntitlementService: jest.Mocked<IEntitlementService>;

  const createMockModule = (id: string, version: string): IModule => ({
    metadata: {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      version,
      description: `${id} module`,
    },
    permissions: [`${id}.view`, `${id}.manage`],
    getManifest: () => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      version,
      description: `${id} module`,
      requiredPermissions: [`${id}.view`, `${id}.manage`],
    }),
    getRouter: () => ({}) as any,
  });

  const createMockModuleNoRouter = (id: string, version: string): IModule => ({
    metadata: {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      version,
      description: `${id} module`,
    },
    permissions: [`${id}.view`, `${id}.manage`],
    getManifest: () => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      version,
      description: `${id} module`,
      requiredPermissions: [`${id}.view`, `${id}.manage`],
    }),
    getRouter: () => null as any,
  });

  const createDbModule = (code: string, version: string, overrides: Partial<ModuleDefinition> = {}): ModuleDefinition => ({
    id: `id-${code}`,
    code,
    name: code.charAt(0).toUpperCase() + code.slice(1),
    description: `${code} module`,
    version,
    lifecycleStatus: 'ready' as LifecycleStatus,
    runtimeStatus: 'available' as RuntimeStatus,
    implementationStatus: 'passed' as ImplementationStatus,
    dependencies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockRepo = {
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

    codeRegistry = CodeModuleRegistry.getInstance();
    (codeRegistry as any).modules = new Map();

    mockEntitlementService = {
      companyHasModule: jest.fn(),
      companyHasCapability: jest.fn(),
      getEntitledModules: jest.fn(),
      getEntitledCapabilities: jest.fn(),
    } as any;

    ModuleAvailabilityService.create(mockRepo, codeRegistry, mockEntitlementService);
  });

  describe('buildAvailabilityMap - DB+Code cases', () => {
    it('should return AVAILABLE when all checks pass', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.AVAILABLE);
    });

    it('should return VERSION_MISMATCH when versions differ', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '2.0.0'));

      const report = await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.VERSION_MISMATCH);
      expect(report.versionMismatch).toHaveLength(1);
      expect(report.versionMismatch[0]).toEqual({
        moduleId: 'sales',
        dbVersion: '1.0.0',
        codeVersion: '2.0.0',
      });
    });

    it('should return IMPLEMENTATION_FAILED when router is missing', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModuleNoRouter('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.IMPLEMENTATION_FAILED);
    });

    it('should return IMPLEMENTATION_FAILED when implementationStatus=failed', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'failed',
          implementationError: 'Router not found',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.IMPLEMENTATION_FAILED);
      expect(info?.reason).toContain('Router not found');
    });

    it('should return IMPLEMENTATION_UNCHECKED when implementationStatus=unchecked', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'unchecked',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED);
    });

    it('should return NOT_READY when lifecycleStatus=draft', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'draft',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.NOT_READY);
    });

    it('should return NOT_READY when lifecycleStatus=deprecated', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'deprecated',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.NOT_READY);
    });

    it('should return NOT_READY when lifecycleStatus=inactive', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'inactive',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.NOT_READY);
    });

    it('should return SUSPENDED when runtimeStatus=suspended', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'suspended',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.SUSPENDED);
    });
  });

  describe('buildAvailabilityMap - DB-only and Code-only', () => {
    it('should return DB_ONLY when DB record exists but no code', async () => {
      mockRepo.getAll.mockResolvedValue([createDbModule('sales', '1.0.0')]);

      const report = await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.DB_ONLY);
      expect(report.dbOnly).toContain('sales');
    });

    it('should return CODE_ONLY when code exists but no DB record', async () => {
      mockRepo.getAll.mockResolvedValue([]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      const report = await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const info = ModuleAvailabilityService.getInstance().getAvailabilityInfo('sales');
      expect(info?.state).toBe(ModuleAvailabilityState.CODE_ONLY);
      expect(report.codeOnly).toContain('sales');
    });
  });

  describe('isAvailableForCompany', () => {
    beforeEach(async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('available', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
        createDbModule('suspended', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'suspended',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('available', createMockModule('available', '1.0.0'));
      (codeRegistry as any).modules.set('suspended', createMockModule('suspended', '1.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();
    });

    it('should return available=true when entitled and all checks pass', async () => {
      mockEntitlementService.companyHasModule.mockResolvedValue(true);

      const result = await ModuleAvailabilityService.getInstance().isAvailableForCompany('available', 'company-123');

      expect(result.available).toBe(true);
      expect(result.state).toBe(ModuleAvailabilityState.AVAILABLE);
    });

    it('should return available=false when not entitled', async () => {
      mockEntitlementService.companyHasModule.mockResolvedValue(false);

      const result = await ModuleAvailabilityService.getInstance().isAvailableForCompany('available', 'company-123');

      expect(result.available).toBe(false);
      expect(result.state).toBe(ModuleAvailabilityState.NOT_ENTITLED);
    });

    it('should return available=false for suspended module even if entitled', async () => {
      mockEntitlementService.companyHasModule.mockResolvedValue(true);

      const result = await ModuleAvailabilityService.getInstance().isAvailableForCompany('suspended', 'company-123');

      expect(result.available).toBe(false);
      expect(result.state).toBe(ModuleAvailabilityState.SUSPENDED);
    });
  });

  describe('getAvailableModulesForCompany', () => {
    it('should include only entitled modules that are available', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      mockEntitlementService.companyHasModule.mockResolvedValue(true);

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const available = await ModuleAvailabilityService.getInstance().getAvailableModulesForCompany('company-123');

      expect(available).toContain('sales');
    });

    it('should exclude modules company is not entitled to', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '1.0.0'));

      mockEntitlementService.companyHasModule.mockResolvedValue(false);

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const available = await ModuleAvailabilityService.getInstance().getAvailableModulesForCompany('company-123');

      expect(available).not.toContain('sales');
    });
  });

  describe('getSuperAdminView', () => {
    it('should include version mismatch in report', async () => {
      mockRepo.getAll.mockResolvedValue([
        createDbModule('sales', '1.0.0', {
          lifecycleStatus: 'ready',
          runtimeStatus: 'available',
          implementationStatus: 'passed',
        }),
      ]);
      (codeRegistry as any).modules.set('sales', createMockModule('sales', '2.0.0'));

      await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

      const view = ModuleAvailabilityService.getInstance().getSuperAdminView();

      expect(view.versionMismatch).toHaveLength(1);
      expect(view.versionMismatch[0].moduleId).toBe('sales');
    });
  });
});