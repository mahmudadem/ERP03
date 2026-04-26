/**
 * UpgradeCompanyBundleUseCase Tests
 *
 * Tests for Phase 2 bundle upgrade with proper entitlement handling.
 */
import { UpgradeCompanyBundleUseCase } from '../UpgradeCompanyBundleUseCase';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { IBundleRegistryRepository } from '../../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ICompanyEntitlementRepository, IBundleItemRepository } from '../../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { BundleDefinition, BundleLifecycleStatus } from '../../../../domain/super-admin/BundleDefinition';

describe('UpgradeCompanyBundleUseCase - Phase 2', () => {
  let mockCompanyRepo: jest.Mocked<ICompanyRepository>;
  let mockBundleRepo: jest.Mocked<IBundleRegistryRepository>;
  let mockBundleItemRepo: jest.Mocked<IBundleItemRepository>;
  let mockEntitlementRepo: jest.Mocked<ICompanyEntitlementRepository>;

  let useCase: UpgradeCompanyBundleUseCase;

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
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    mockBundleRepo = {
      getById: jest.fn(),
    } as any;

    mockBundleItemRepo = {
      getModuleKeysByBundleId: jest.fn(),
      getCapabilityKeysByBundleId: jest.fn(),
    } as any;

    mockEntitlementRepo = {
      getActiveByCompanyId: jest.fn(),
      getEntitlementById: jest.fn(),
      createEntitlement: jest.fn(),
      updateEntitlement: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      getEffectiveModules: jest.fn().mockResolvedValue([]),
      getEffectiveCapabilities: jest.fn().mockResolvedValue([]),
    } as any;

    useCase = new UpgradeCompanyBundleUseCase(
      mockCompanyRepo,
      mockBundleRepo,
      mockBundleItemRepo,
      mockEntitlementRepo
    );
  });

  describe('creates new entitlement when old one does not exist', () => {
    it('should create entitlement with all new bundle items when no old entitlement exists', async () => {
      const company = { id: 'cmp_123', subscriptionPlan: null };
      const newBundle = createMockBundle('bundle_new');
      newBundle.lifecycleStatus = 'ready';

      const createdEntitlement = {
        id: 'ent_cmp_123_bundle_new',
        companyId: 'cmp_123',
        sourceType: 'bundle',
        sourceId: 'bundle_new',
        isActive: true,
        items: [],
      };

      mockCompanyRepo.findById.mockResolvedValue(company as any);
      mockBundleRepo.getById.mockResolvedValue(newBundle);
      mockBundleItemRepo.getModuleKeysByBundleId.mockResolvedValue(['sales', 'inventory']);
      mockBundleItemRepo.getCapabilityKeysByBundleId.mockResolvedValue(['sales.invoice']);
      mockEntitlementRepo.getActiveByCompanyId.mockResolvedValue([]);
      mockEntitlementRepo.createEntitlement.mockResolvedValue(undefined);
      mockEntitlementRepo.getEntitlementById.mockResolvedValue(createdEntitlement as any);

      const result = await useCase.execute({ companyId: 'cmp_123', bundleId: 'bundle_new' });

      expect(mockEntitlementRepo.createEntitlement).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'cmp_123',
          sourceType: 'bundle',
          sourceId: 'bundle_new',
        })
      );
      expect(mockEntitlementRepo.addItem).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('upgraded');
    });
  });

  describe('rejects non-ready bundles', () => {
    it('should reject draft bundles', async () => {
      const company = { id: 'cmp_123', subscriptionPlan: 'bundle_old' };
      const draftBundle = createMockBundle('bundle_draft');
      draftBundle.lifecycleStatus = 'draft';

      mockCompanyRepo.findById.mockResolvedValue(company as any);
      mockBundleRepo.getById.mockResolvedValue(draftBundle);

      await expect(
        useCase.execute({ companyId: 'cmp_123', bundleId: 'bundle_draft' })
      ).rejects.toThrow("not available");
    });
  });

  describe('does not touch trial/promotion entitlements', () => {
    it('should only modify bundle-source entitlement', async () => {
      const company = { id: 'cmp_123', subscriptionPlan: 'bundle_old' };
      const newBundle = createMockBundle('bundle_new');
      newBundle.lifecycleStatus = 'ready';

      const bundleEntitlement = {
        id: 'ent_bundle_old',
        companyId: 'cmp_123',
        sourceType: 'bundle',
        sourceId: 'bundle_old',
        isActive: true,
        items: [{ itemType: 'module', itemKey: 'accounting' }],
      };

      mockCompanyRepo.findById.mockResolvedValue(company as any);
      mockBundleRepo.getById.mockResolvedValue(newBundle);
      mockBundleItemRepo.getModuleKeysByBundleId.mockResolvedValue(['sales', 'inventory']);
      mockBundleItemRepo.getCapabilityKeysByBundleId.mockResolvedValue([]);
      mockEntitlementRepo.getActiveByCompanyId.mockResolvedValue([bundleEntitlement] as any);
      mockEntitlementRepo.getEffectiveModules.mockResolvedValue(['sales', 'inventory']);

      const result = await useCase.execute({ companyId: 'cmp_123', bundleId: 'bundle_new' });

      expect(mockEntitlementRepo.removeItem).toHaveBeenCalledWith('ent_bundle_old', 'accounting');
      expect(mockEntitlementRepo.addItem).toHaveBeenCalledWith(
        'ent_bundle_old',
        expect.objectContaining({ itemType: 'module', itemKey: 'inventory' })
      );
    });
  });
});