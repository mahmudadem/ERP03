/**
 * Entitlement Service Unit Test
 *
 * Tests the entitlement service using mocks:
 * - Company creation with bundle → creates CompanyEntitlement
 * - Bundle upgrade → adds modules to entitlement
 * - Bundle downgrade → removes modules from entitlement
 */

import { EntitlementService } from '../EntitlementService';
import { ICompanyEntitlementRepository } from '../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { CompanyEntitlement, CompanyEntitlementItem, EntitlementSourceType, EntitlementItemType } from '../../../domain/super-admin/EntitlementDefinition';

describe('EntitlementService - Unit', () => {
  let mockRepo: jest.Mocked<ICompanyEntitlementRepository>;
  let service: EntitlementService;

  const createEntitlement = (companyId: string, items: CompanyEntitlementItem[]): CompanyEntitlement => ({
    id: `ent_${companyId}`,
    companyId,
    sourceType: 'bundle' as EntitlementSourceType,
    sourceId: 'bundle_starter',
    validFrom: new Date(),
    isActive: true,
    items,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockRepo = {
      getByCompanyId: jest.fn(),
      getActiveByCompanyId: jest.fn(),
      getEntitlementById: jest.fn(),
      createEntitlement: jest.fn(),
      updateEntitlement: jest.fn(),
      deactivateEntitlement: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      getItemsByEntitlementId: jest.fn(),
      getEffectiveModules: jest.fn(),
      getEffectiveCapabilities: jest.fn(),
      hasModule: jest.fn(),
      hasCapability: jest.fn(),
    } as any;

    service = new EntitlementService(mockRepo);
  });

  describe('create company with bundle', () => {
    it('should create entitlement with bundle modules', async () => {
      mockRepo.getByCompanyId.mockResolvedValue([]);

      await service.grantModule('company_123', 'sales', 'bundle', 'bundle_starter');
      await service.grantModule('company_123', 'accounting', 'bundle', 'bundle_starter');

      expect(mockRepo.createEntitlement).toHaveBeenCalledTimes(2);
    });

    it('should add to existing entitlement if one exists', async () => {
      const existing = createEntitlement('company_123', [
        { id: 'item_1', entitlementId: 'ent_123', itemType: 'module', itemKey: 'sales', createdAt: new Date() }
      ]);
      mockRepo.getByCompanyId.mockResolvedValue([existing]);

      await service.grantModule('company_123', 'accounting', 'bundle', 'bundle_starter');

      expect(mockRepo.addItem).toHaveBeenCalled();
      expect(mockRepo.createEntitlement).not.toHaveBeenCalled();
    });
  });

  describe('query via service', () => {
    it('should return entitled modules', async () => {
      mockRepo.hasModule.mockResolvedValue(true);

      const hasSales = await service.companyHasModule('company_123', 'sales');

      expect(hasSales).toBe(true);
    });

    it('should return entitled capabilities', async () => {
      mockRepo.hasCapability.mockResolvedValue(true);

      const hasInvoice = await service.companyHasCapability('company_123', 'sales.invoice');

      expect(hasInvoice).toBe(true);
    });

    it('should return all entitled modules', async () => {
      mockRepo.getEffectiveModules.mockResolvedValue(['sales', 'accounting', 'inventory']);

      const modules = await service.getEntitledModules('company_123');

      expect(modules).toEqual(['sales', 'accounting', 'inventory']);
    });
  });

  describe('bundle upgrade', () => {
    it('should add new modules to entitlement', async () => {
      const existing = createEntitlement('company_123', [
        { id: 'item_1', entitlementId: 'ent_123', itemType: 'module', itemKey: 'sales', createdAt: new Date() },
        { id: 'item_2', entitlementId: 'ent_123', itemType: 'module', itemKey: 'accounting', createdAt: new Date() },
      ]);
      mockRepo.getByCompanyId.mockResolvedValue([existing]);

      await service.grantModule('company_123', 'inventory', 'bundle', 'bundle_pro');

      expect(mockRepo.addItem).toHaveBeenCalled();
    });
  });

  describe('bundle downgrade', () => {
    it('should remove modules not in new bundle', async () => {
      const existing = createEntitlement('company_123', [
        { id: 'item_1', entitlementId: 'ent_123', itemType: 'module', itemKey: 'sales', createdAt: new Date() },
        { id: 'item_2', entitlementId: 'ent_123', itemType: 'module', itemKey: 'accounting', createdAt: new Date() },
        { id: 'item_3', entitlementId: 'ent_123', itemType: 'module', itemKey: 'inventory', createdAt: new Date() },
      ]);
      mockRepo.getActiveByCompanyId.mockResolvedValue([existing]);

      await service.revokeModule('company_123', 'inventory');

      expect(mockRepo.removeItem).toHaveBeenCalled();
    });
  });

  describe('capabilities', () => {
    it('should support capability items', async () => {
      mockRepo.hasCapability.mockResolvedValue(true);

      const result = await service.companyHasCapability('company_123', 'sales.invoice');

      expect(result).toBe(true);
    });

    it('should return all entitled capabilities', async () => {
      mockRepo.getEffectiveCapabilities.mockResolvedValue(['sales.invoice', 'sales.receipt']);

      const capabilities = await service.getEntitledCapabilities('company_123');

      expect(capabilities).toEqual(['sales.invoice', 'sales.receipt']);
    });
  });
});