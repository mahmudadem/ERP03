/**
 * EnableCapabilityForCompanyUseCase
 *
 * Enables a capability for a company.
 * 
 * Gates:
 * 1. Capability exists in registry
 * 2. Lifecycle status = ready
 * 3. Runtime status = available
 * 4. Implementation status = passed
 * 5. Enablement policy allows company_admin_optional
 * 6. Company is entitled to the capability
 * 7. Parent module is enabled for company
 */
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICapabilityRegistryRepository } from '../../../repository/interfaces/company/ICapabilityRegistryRepository';
import { ICompanyEntitlementRepository } from '../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ApiError } from '../../../api/errors/ApiError';
import {
  filterRuntimeAvailableModules,
  resolveCompanyEnabledModules
} from '../services/CompanyModuleAccessResolver';

export class EnableCapabilityForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private capabilityRepository: ICapabilityRegistryRepository,
    private entitlementRepository: ICompanyEntitlementRepository,
    private companyModuleRepository: ICompanyModuleRepository
  ) {}

  async execute(input: { companyId: string; capabilityCode: string }): Promise<any> {
    const capabilityCode = String(input.capabilityCode || '').trim().toLowerCase();

    if (!input.companyId || !capabilityCode) {
      throw ApiError.badRequest('Missing required fields');
    }

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    const capability = await this.capabilityRepository.getByCode(capabilityCode);
    if (!capability) {
      throw ApiError.notFound('Capability not found');
    }

    if (capability.lifecycleStatus !== 'ready') {
      throw ApiError.badRequest(`Capability is not ready for use: ${capability.lifecycleStatus}`);
    }

    if (capability.runtimeStatus !== 'available') {
      throw ApiError.custom(423, `Capability is suspended`);
    }

    if (capability.implementationStatus !== 'passed') {
      throw ApiError.badRequest('Capability implementation check not passed');
    }

    if (capability.enablementPolicy !== 'company_admin_optional') {
      throw ApiError.forbidden('This capability cannot be enabled by Company Admin');
    }

    const isEntitled = await this.entitlementRepository.hasCapability(input.companyId, capabilityCode);
    if (!isEntitled) {
      throw ApiError.forbidden('Company is not entitled to this capability');
    }

    const [companyModules, entitledModules] = await Promise.all([
      this.companyModuleRepository.listByCompany(input.companyId),
      this.entitlementRepository.getEffectiveModules(input.companyId),
    ]);
    const companyEnabledModules = resolveCompanyEnabledModules({
      companyModules,
      legacyModules: (company.modules || []) as string[],
      entitledModules,
    });
    const availableParentModules = await filterRuntimeAvailableModules(input.companyId, companyEnabledModules);
    if (!availableParentModules.includes(capability.moduleId.toLowerCase())) {
      throw ApiError.badRequest(`Parent module ${capability.moduleId} must be enabled and available first`);
    }

    await this.capabilityRepository.setEnabled(input.companyId, capabilityCode, true);

    return { capabilityCode, status: 'enabled' };
  }
}
