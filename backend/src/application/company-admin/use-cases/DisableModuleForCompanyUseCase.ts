/**
 * DisableModuleForCompanyUseCase
 *
 * Disables a module for a company (enabled state) - NOT entitlement.
 * This is the "company admin turned OFF" action.
 *
 * Gates:
 * - Only modifies CompanyModule enabled state (isEnabled = false)
 * - Does NOT remove bundle/trial/promotion entitlements
 * - Keeps data and config, just blocks runtime access
 *
 * The company remains entitled - they can re-enable anytime.
 */
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class DisableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private companyModuleRepository: ICompanyModuleRepository
  ) { }

  async execute(input: { companyId: string; moduleName: string }): Promise<any> {
    const moduleName = String(input.moduleName || '').trim().toLowerCase();
    if (!input.companyId || !moduleName) {
      throw ApiError.badRequest("Missing required fields");
    }

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    if (moduleName === 'core') {
      throw ApiError.forbidden("Cannot disable core module");
    }

    const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
    
    if (!moduleState || !moduleState.isEnabled) {
      throw ApiError.badRequest("Module is not enabled for this company");
    }

    await this.companyModuleRepository.update(input.companyId, moduleName, {
      isEnabled: false,
      updatedAt: new Date(),
    });

    return { moduleName, status: 'disabled' };
  }
}