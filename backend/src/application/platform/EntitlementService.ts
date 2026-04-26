/**
 * EntitlementService
 *
 * Real implementation using CompanyEntitlement tables.
 * Replaces the legacy EntitlementServiceAdapter.
 */
import { IEntitlementService } from './IEntitlementService';
import { ICompanyEntitlementRepository } from '../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { CompanyEntitlement, CompanyEntitlementItem } from '../../domain/super-admin/EntitlementDefinition';

export class EntitlementService implements IEntitlementService {
  constructor(private entitlementRepo: ICompanyEntitlementRepository) {}

  async companyHasModule(companyId: string, moduleId: string): Promise<boolean> {
    return this.entitlementRepo.hasModule(companyId, moduleId.toLowerCase());
  }

  async companyHasCapability(companyId: string, capabilityId: string): Promise<boolean> {
    return this.entitlementRepo.hasCapability(companyId, capabilityId.toLowerCase());
  }

  async getEntitledModules(companyId: string): Promise<string[]> {
    return this.entitlementRepo.getEffectiveModules(companyId);
  }

  async getEntitledCapabilities(companyId: string): Promise<string[]> {
    return this.entitlementRepo.getEffectiveCapabilities(companyId);
  }

  async grantModule(
    companyId: string,
    moduleId: string,
    sourceType: string,
    sourceId: string
  ): Promise<void> {
    const entitlements = await this.entitlementRepo.getByCompanyId(companyId);
    const normalizedModuleId = moduleId.toLowerCase();

    if (entitlements.length > 0) {
      const activeEntitlement = entitlements.find(e => e.isActive);
      if (activeEntitlement) {
        await this.entitlementRepo.addItem(activeEntitlement.id, {
          id: crypto.randomUUID(),
          entitlementId: activeEntitlement.id,
          itemType: 'module',
          itemKey: normalizedModuleId,
          createdAt: new Date(),
        });
        return;
      }
    }

    const entitlement: CompanyEntitlement = {
      id: crypto.randomUUID(),
      companyId,
      sourceType: sourceType as 'bundle' | 'superadmin_override' | 'trial' | 'promotion',
      sourceId,
      validFrom: new Date(),
      isActive: true,
      items: [
        {
          id: crypto.randomUUID(),
          entitlementId: '',
          itemType: 'module',
          itemKey: normalizedModuleId,
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const firstItem = { ...entitlement.items[0], entitlementId: entitlement.id };
    entitlement.items = [firstItem as CompanyEntitlementItem];

    await this.entitlementRepo.createEntitlement(entitlement);
  }

  async revokeModule(companyId: string, moduleId: string): Promise<void> {
    const entitlements = await this.entitlementRepo.getActiveByCompanyId(companyId);
    const normalizedModuleId = moduleId.toLowerCase();

    for (const entitlement of entitlements) {
      const hasItem = entitlement.items.some(
        (item) => item.itemType === 'module' && item.itemKey === normalizedModuleId
      );
      if (hasItem) {
        await this.entitlementRepo.removeItem(entitlement.id, normalizedModuleId);
      }
    }
  }
}