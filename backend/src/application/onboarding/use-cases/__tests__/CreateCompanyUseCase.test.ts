/**
 * CreateCompanyUseCase Tests
 *
 * Tests for Phase 2 entitlement creation with BundleItem data.
 */
import { CreateCompanyUseCase } from '../CreateCompanyUseCase';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { IUserRepository } from '../../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ICompanyRoleRepository } from '../../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRolePermissionResolver } from '../../../rbac/CompanyRolePermissionResolver';
import { IBundleRegistryRepository } from '../../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ICompanyModuleRepository } from '../../../../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanySettingsRepository } from '../../../../repository/interfaces/core/ICompanySettingsRepository';
import { ICompanyEntitlementRepository, IBundleItemRepository } from '../../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { BundleDefinition, BundleLifecycleStatus } from '../../../../domain/super-admin/BundleDefinition';
import { BundleItem, CompanyEntitlement } from '../../../../domain/super-admin/EntitlementDefinition';

describe('CreateCompanyUseCase - Phase 2 Entitlements', () => {
  let mockCompanyRepo: jest.Mocked<ICompanyRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockRbacCompanyUserRepo: jest.Mocked<ICompanyUserRepository>;
  let mockRbacCompanyRoleRepo: jest.Mocked<ICompanyRoleRepository>;
  let mockRolePermissionResolver: jest.Mocked<CompanyRolePermissionResolver>;
  let mockBundleRepo: jest.Mocked<IBundleRegistryRepository>;
  let mockBundleItemRepo: jest.Mocked<IBundleItemRepository>;
  let mockCompanyModuleRepo: jest.Mocked<ICompanyModuleRepository>;
  let mockCompanySettingsRepo: jest.Mocked<ICompanySettingsRepository>;
  let mockEntitlementRepo: jest.Mocked<ICompanyEntitlementRepository>;

  let useCase: CreateCompanyUseCase;

  const createMockBundle = (id: string, status: BundleLifecycleStatus = 'ready'): BundleDefinition => ({
    id,
    name: `Bundle ${id}`,
    description: 'Test bundle',
    businessDomains: ['retail'],
    modulesIncluded: [],
    lifecycleStatus: status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockCompanyRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByNameAndOwner: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockUserRepo = {
      getUserById: jest.fn(),
      updateActiveCompany: jest.fn(),
    } as any;

    mockRbacCompanyUserRepo = {
      assignRole: jest.fn(),
    } as any;

    mockRbacCompanyRoleRepo = {
      getById: jest.fn(),
      create: jest.fn(),
    } as any;

    mockRolePermissionResolver = {
      resolveRoleById: jest.fn(),
    } as any;

    mockBundleRepo = {
      getById: jest.fn(),
    } as any;

    mockBundleItemRepo = {
      getByBundleId: jest.fn(),
      getModuleKeysByBundleId: jest.fn(),
      getCapabilityKeysByBundleId: jest.fn(),
    } as any;

    mockCompanyModuleRepo = {
      batchCreate: jest.fn(),
      listByCompany: jest.fn().mockResolvedValue([]),
    } as any;

    mockCompanySettingsRepo = {
      updateSettings: jest.fn(),
    } as any;

    mockEntitlementRepo = {
      createEntitlement: jest.fn(),
      getEffectiveModules: jest.fn().mockResolvedValue([]),
      getEffectiveCapabilities: jest.fn().mockResolvedValue([]),
    } as any;

    useCase = new CreateCompanyUseCase(
      mockCompanyRepo,
      mockUserRepo,
      mockRbacCompanyUserRepo,
      mockRbacCompanyRoleRepo,
      mockRolePermissionResolver,
      mockBundleRepo,
      mockBundleItemRepo,
      mockCompanyModuleRepo,
      mockCompanySettingsRepo,
      mockEntitlementRepo
    );
  });

  describe('subscriptionPlan is bundleId', () => {
    it('should store subscriptionPlan as bundleId, not bundle.name', async () => {
      const bundle = createMockBundle('bundle_123');
      bundle.lifecycleStatus = 'ready';
      mockBundleRepo.getById.mockResolvedValue(bundle);
      mockUserRepo.getUserById.mockResolvedValue({ uid: 'user_1' } as any);
      mockCompanyRepo.findByNameAndOwner.mockResolvedValue(null);
      
      mockBundleItemRepo.getByBundleId.mockResolvedValue([
        { id: 'bi_1', bundleId: 'bundle_123', itemType: 'module', itemKey: 'sales', createdAt: new Date() },
        { id: 'bi_2', bundleId: 'bundle_123', itemType: 'module', itemKey: 'accounting', createdAt: new Date() },
        { id: 'bi_3', bundleId: 'bundle_123', itemType: 'capability', itemKey: 'sales.invoice', createdAt: new Date() },
      ]);

      mockRbacCompanyRoleRepo.getById.mockResolvedValue(null);
      mockRbacCompanyRoleRepo.create.mockResolvedValue(undefined);

      try {
        await useCase.execute({
          userId: 'user_1',
          companyName: 'Test Company',
          country: 'US',
          email: 'test@test.com',
          bundleId: 'bundle_123',
        });
      } catch (e) {}

      expect(mockCompanyRepo.save).toHaveBeenCalled();
      const savedCompany = mockCompanyRepo.save.mock.calls[0][0];
      expect(savedCompany.subscriptionPlan).toBe('bundle_123');
    });
  });

  describe('creates entitlements from BundleItem rows', () => {
    it('should create entitlement items from BundleItem module rows', async () => {
      const bundle = createMockBundle('bundle_123');
      bundle.lifecycleStatus = 'ready';
      mockBundleRepo.getById.mockResolvedValue(bundle);
      mockUserRepo.getUserById.mockResolvedValue({ uid: 'user_1' } as any);
      mockCompanyRepo.findByNameAndOwner.mockResolvedValue(null);
      
      mockBundleItemRepo.getByBundleId.mockResolvedValue([
        { id: 'bi_1', bundleId: 'bundle_123', itemType: 'module', itemKey: 'sales', createdAt: new Date() },
        { id: 'bi_2', bundleId: 'bundle_123', itemType: 'module', itemKey: 'inventory', createdAt: new Date() },
        { id: 'bi_3', bundleId: 'bundle_123', itemType: 'capability', itemKey: 'sales.invoice', createdAt: new Date() },
      ]);

      mockRbacCompanyRoleRepo.getById.mockResolvedValue(null);
      mockRbacCompanyRoleRepo.create.mockResolvedValue(undefined);

      try {
        await useCase.execute({
          userId: 'user_1',
          companyName: 'Test Company',
          country: 'US',
          email: 'test@test.com',
          bundleId: 'bundle_123',
        });
      } catch (e) {}

      expect(mockEntitlementRepo.createEntitlement).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'bundle',
          sourceId: 'bundle_123',
          items: expect.arrayContaining([
            expect.objectContaining({ itemType: 'module', itemKey: 'sales' }),
            expect.objectContaining({ itemType: 'module', itemKey: 'inventory' }),
            expect.objectContaining({ itemType: 'capability', itemKey: 'sales.invoice' }),
          ]),
        })
      );
    });
  });

  describe('rejects draft bundles', () => {
    it('should reject draft bundles', async () => {
      const bundle = createMockBundle('bundle_draft');
      bundle.lifecycleStatus = 'draft';
      mockBundleRepo.getById.mockResolvedValue(bundle);
      mockUserRepo.getUserById.mockResolvedValue({ uid: 'user_1' } as any);
      mockCompanyRepo.findByNameAndOwner.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'user_1',
          companyName: 'Test Company',
          country: 'US',
          email: 'test@test.com',
          bundleId: 'bundle_draft',
        })
      ).rejects.toThrow("not available");
    });
  });
});