import { IEntitlementService } from '../../platform/IEntitlementService';
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class GrantModuleToCompanyUseCase {
  constructor(
    private entitlementService: IEntitlementService,
    private moduleRepo: IModuleRegistryRepository
  ) {}

  async execute(companyId: string, moduleKey: string): Promise<void> {
    const normalizedKey = moduleKey.toLowerCase();

    // Validate module exists in registry
    const modules = await this.moduleRepo.getAll();
    const moduleExists = modules.some(m => m.id.toLowerCase() === normalizedKey);
    if (!moduleExists) {
      throw ApiError.badRequest(`Module '${moduleKey}' does not exist in the registry.`);
    }

    // Check if already entitled
    const alreadyEntitled = await this.entitlementService.companyHasModule(companyId, normalizedKey);
    if (alreadyEntitled) {
      throw ApiError.badRequest(`Company already has access to module '${moduleKey}'.`);
    }

    // Grant via entitlement service with superadmin_override source
    await this.entitlementService.grantModule(companyId, normalizedKey, 'superadmin_override', 'superadmin_manual');
  }
}