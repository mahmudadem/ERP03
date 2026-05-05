import { IEntitlementService } from '../../platform/IEntitlementService';
import { ApiError } from '../../../api/errors/ApiError';

export class RevokeModuleFromCompanyUseCase {
  constructor(
    private entitlementService: IEntitlementService
  ) {}

  async execute(companyId: string, moduleKey: string): Promise<void> {
    const normalizedKey = moduleKey.toLowerCase();

    // Check if company has this module
    const hasModule = await this.entitlementService.companyHasModule(companyId, normalizedKey);
    if (!hasModule) {
      throw ApiError.badRequest(`Company does not have access to module '${moduleKey}'.`);
    }

    // Revoke via entitlement service
    await this.entitlementService.revokeModule(companyId, normalizedKey);
  }
}