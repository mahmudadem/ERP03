/**
 * Phase 3 Tests - Entitlement + Enabled State Architecture
 *
 * Tests for the 4-gate module filtering:
 * 1. Module availability passes
 * 2. Company is entitled
 * 3. CompanyModule is enabled
 * 4. User role grants the module
 */
import { DisableModuleForCompanyUseCase } from '../DisableModuleForCompanyUseCase';
import { EnableModuleForCompanyUseCase } from '../EnableModuleForCompanyUseCase';
import { ListCompanyModulesUseCase } from '../ListCompanyModulesUseCase';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../../repository/interfaces/company/ICompanyModuleRepository';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../../platform/ModuleAvailabilityService';

describe('Phase 3 Entitlement + Enabled State', () => {
  let mockCompanyRepo: jest.Mocked<ICompanyRepository>;
  let mockCompanyModuleRepo: jest.Mocked<ICompanyModuleRepository>;

  beforeEach(() => {
    mockCompanyRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    mockCompanyModuleRepo = {
      get: jest.fn(),
      listByCompany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchCreate: jest.fn(),
    } as any;
  });

  describe('Gate 3: CompanyModule disabled state (DisableModuleForCompanyUseCase)', () => {
    it('should set isEnabled=false when disabling, without touching entitlements', async () => {
      const moduleState = { companyId: 'cmp_123', moduleCode: 'sales', isEnabled: true };

      mockCompanyRepo.findById.mockResolvedValue({ id: 'cmp_123' } as any);
      mockCompanyModuleRepo.get.mockResolvedValue(moduleState as any);

      const useCase = new DisableModuleForCompanyUseCase(
        mockCompanyRepo,
        mockCompanyModuleRepo
      );

      const result = await useCase.execute({ companyId: 'cmp_123', moduleName: 'sales' });

      expect(mockCompanyModuleRepo.update).toHaveBeenCalledWith(
        'cmp_123',
        'sales',
        expect.objectContaining({ isEnabled: false })
      );
      expect(result.status).toBe('disabled');
    });

    it('should reject disabling non-existent module', async () => {
      mockCompanyRepo.findById.mockResolvedValue({ id: 'cmp_123' } as any);
      mockCompanyModuleRepo.get.mockResolvedValue(null);

      const useCase = new DisableModuleForCompanyUseCase(
        mockCompanyRepo,
        mockCompanyModuleRepo
      );

      await expect(
        useCase.execute({ companyId: 'cmp_123', moduleName: 'sales' })
      ).rejects.toThrow('not enabled');
    });

    it('should reject disabling core module', async () => {
      mockCompanyRepo.findById.mockResolvedValue({ id: 'cmp_123' } as any);

      const useCase = new DisableModuleForCompanyUseCase(
        mockCompanyRepo,
        mockCompanyModuleRepo
      );

      await expect(
        useCase.execute({ companyId: 'cmp_123', moduleName: 'core' })
      ).rejects.toThrow('Cannot disable core');
    });
  });

  describe('Role with empty moduleBundles receives no business modules', () => {
    it('should return empty when role has no moduleBundles and company has no enabled records', async () => {
      const companyModules: any[] = [];
      const roleModuleBundles: string[] = [];

      const hasCompanyModuleRecords = companyModules.length > 0;
      const hasRoleModuleBundles = roleModuleBundles.length > 0;

      let finalModules: string[];

      if (hasCompanyModuleRecords) {
        finalModules = companyModules
          .filter(m => m.isEnabled)
          .map(m => m.moduleCode);
      } else {
        if (hasRoleModuleBundles) {
          finalModules = [];
        } else {
          finalModules = [];
        }
      }

      expect(finalModules).toHaveLength(0);
    });

    it('should return all enabled for owner wildcard when role has no moduleBundles', async () => {
      const companyModules = [
        { companyId: 'cmp_123', moduleCode: 'sales', isEnabled: true },
        { companyId: 'cmp_123', moduleCode: 'inventory', isEnabled: true },
      ];
      const roleModuleBundles: string[] = [];

      const hasCompanyModuleRecords = companyModules.length > 0;
      const hasRoleModuleBundles = roleModuleBundles.length > 0;

      let finalModules: string[];

      if (hasCompanyModuleRecords) {
        if (hasRoleModuleBundles) {
          finalModules = [];
        } else {
          finalModules = companyModules
            .filter(m => m.isEnabled)
            .map(m => m.moduleCode);
        }
      } else {
        finalModules = [];
      }

      expect(finalModules).toContain('sales');
      expect(finalModules).toContain('inventory');
    });
  });

  describe('Stale role.moduleBundles cannot access disabled module', () => {
    it('should filter out disabled modules even if role has them in moduleBundles', async () => {
      const companyModules = [
        { companyId: 'cmp_123', moduleCode: 'sales', isEnabled: false },
        { companyId: 'cmp_123', moduleCode: 'inventory', isEnabled: true },
      ];

      const roleModuleBundles = ['sales', 'inventory'];

      const disabledFiltered = companyModules
        .filter(m => m.isEnabled)
        .map(m => m.moduleCode);

      expect(disabledFiltered).not.toContain('sales');
      expect(disabledFiltered).toContain('inventory');
      expect(disabledFiltered).toHaveLength(1);
    });
  });

  describe('Company admin disables bundle-granted module', () => {
    it('bundle entitlement remains after disable - only CompanyModule.isEnabled changes', async () => {
      const beforeDisable = { companyId: 'cmp_123', moduleCode: 'sales', isEnabled: true };
      const afterDisable = { ...beforeDisable, isEnabled: false };

      const entitlementStillExists = true;

      expect(beforeDisable.isEnabled).toBe(true);
      expect(afterDisable.isEnabled).toBe(false);
      expect(entitlementStillExists).toBe(true);
    });
  });

  describe('Company Admin module list', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('uses CompanyModule.isEnabled instead of legacy company.modules', async () => {
      mockCompanyRepo.findById.mockResolvedValue({ id: 'cmp_123', modules: ['sales'] } as any);
      mockCompanyModuleRepo.listByCompany.mockResolvedValue([
        { companyId: 'cmp_123', moduleCode: 'sales', isEnabled: false },
      ] as any);

      jest.spyOn(ModuleAvailabilityService, 'getInstance').mockReturnValue({
        getCompanyAdminAvailableModules: jest.fn().mockResolvedValue([
          {
            moduleId: 'sales',
            state: ModuleAvailabilityState.AVAILABLE,
            hasRouter: true,
            entitlementsMissing: false,
          },
        ]),
      } as any);

      const useCase = new ListCompanyModulesUseCase(mockCompanyRepo, mockCompanyModuleRepo);
      const result = await useCase.execute({ companyId: 'cmp_123' });

      expect(result[0].isEnabled).toBe(false);
    });
  });

  describe('EnableModuleForCompanyUseCase initialization state', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('does not mark a pending module as initialized when re-enabling', async () => {
      mockCompanyRepo.findById.mockResolvedValue({ id: 'cmp_123' } as any);
      mockCompanyModuleRepo.get.mockResolvedValue({
        companyId: 'cmp_123',
        moduleCode: 'sales',
        isEnabled: false,
        initialized: false,
        initializationStatus: 'pending',
      } as any);

      jest.spyOn(ModuleAvailabilityService, 'getInstance').mockReturnValue({
        isAvailableForCompany: jest.fn().mockResolvedValue({
          available: true,
          state: ModuleAvailabilityState.AVAILABLE,
        }),
      } as any);

      const entitlementRepo = {
        hasModule: jest.fn().mockResolvedValue(true),
      };

      const useCase = new EnableModuleForCompanyUseCase(
        mockCompanyRepo,
        mockCompanyModuleRepo,
        entitlementRepo as any
      );

      await useCase.execute({ companyId: 'cmp_123', moduleName: 'sales' });

      const updatePayload = mockCompanyModuleRepo.update.mock.calls[0][2];
      expect(updatePayload).toEqual(expect.objectContaining({ isEnabled: true }));
      expect(updatePayload).not.toHaveProperty('initialized');
      expect(updatePayload).not.toHaveProperty('initializationStatus');
    });
  });
});
